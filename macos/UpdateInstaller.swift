import Foundation
import AppKit

enum UpdateInstallerError: LocalizedError {
    case noInstallTarget
    case scriptWriteFailed(Error)
    case launchFailed(Error)
    
    var errorDescription: String? {
        switch self {
        case .noInstallTarget:
            return "Could not determine where ScanID is installed."
        case .scriptWriteFailed(let error):
            return "Failed to prepare the update installer: \(error.localizedDescription)"
        case .launchFailed(let error):
            return "Failed to start the update installer: \(error.localizedDescription)"
        }
    }
}

enum UpdateInstaller {
    private static let logPath = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Logs/ScanID-update.log")
    
    static let updateCacheDirectory = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Caches/ScanID", isDirectory: true)
    
    static func resolvedInstallTarget() -> String {
        let bundlePath = Bundle.main.bundlePath
        let bundleURL = URL(fileURLWithPath: bundlePath).resolvingSymlinksInPath()
        
        // Gatekeeper App Translocation runs quarantined apps from a random path.
        // Always install to /Applications so the update survives relaunch.
        if bundlePath.contains("AppTranslocation") {
            return "/Applications/ScanID.app"
        }
        
        if bundleURL.path.hasPrefix("/Applications/") {
            return bundleURL.path
        }
        
        let applicationsPath = "/Applications/ScanID.app"
        if FileManager.default.fileExists(atPath: applicationsPath) {
            return applicationsPath
        }
        
        return bundleURL.path
    }
    
    /// Copies the downloaded update to a stable cache path the detached installer can read after quit.
    static func stageDownloadedFile(_ downloadedFile: URL) throws -> URL {
        try FileManager.default.createDirectory(at: updateCacheDirectory, withIntermediateDirectories: true)
        
        let ext = downloadedFile.pathExtension.isEmpty ? "dmg" : downloadedFile.pathExtension
        let stagedURL = updateCacheDirectory.appendingPathComponent("ScanID-Update.\(ext)")
        
        try? FileManager.default.removeItem(at: stagedURL)
        try FileManager.default.copyItem(at: downloadedFile, to: stagedURL)
        stripQuarantine(at: stagedURL)
        
        return stagedURL
    }
    
    /// Removes Gatekeeper quarantine so hdiutil can mount and ditto won't propagate it.
    static func stripQuarantine(at url: URL) {
        for arguments in [["-rd", "com.apple.quarantine", url.path], ["-cr", url.path]] {
            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/usr/bin/xattr")
            process.arguments = arguments
            process.standardOutput = nil
            process.standardError = nil
            try? process.run()
            process.waitUntilExit()
        }
    }
    
    static func launchInstall(downloadedFile: URL) throws {
        let installTarget = resolvedInstallTarget()
        let stagedFile = try stageDownloadedFile(downloadedFile)
        
        let pid = ProcessInfo.processInfo.processIdentifier
        let scriptURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("install-scanid-update-\(pid).sh")
        
        let script = installScript(
            pid: pid,
            installTarget: installTarget,
            downloadedFile: stagedFile.path,
            logPath: logPath.path
        )
        
        do {
            try script.write(to: scriptURL, atomically: true, encoding: .utf8)
        } catch {
            throw UpdateInstallerError.scriptWriteFailed(error)
        }
        
        let chmod = Process()
        chmod.executableURL = URL(fileURLWithPath: "/bin/chmod")
        chmod.arguments = ["+x", scriptURL.path]
        try chmod.run()
        chmod.waitUntilExit()
        
        let launcher = Process()
        launcher.executableURL = URL(fileURLWithPath: "/bin/bash")
        launcher.arguments = ["-c", "nohup \(shellQuote(scriptURL.path)) > \(shellQuote(logPath.path)) 2>&1 &"]
        launcher.standardInput = nil
        launcher.standardOutput = nil
        launcher.standardError = nil
        
        do {
            try launcher.run()
        } catch {
            throw UpdateInstallerError.launchFailed(error)
        }
    }
    
    private static func installScript(
        pid: Int32,
        installTarget: String,
        downloadedFile: String,
        logPath: String
    ) -> String {
        let qInstallTarget = shellQuote(installTarget)
        let qDownloadedFile = shellQuote(downloadedFile)
        let qLogPath = shellQuote(logPath)
        
        return """
        #!/bin/bash
        set -u
        exec >> \(qLogPath) 2>&1
        
        echo "=== ScanID update started at $(date) ==="
        PID=\(pid)
        INSTALL_TARGET=\(qInstallTarget)
        DOWNLOADED_FILE=\(qDownloadedFile)
        
        strip_quarantine() {
          /usr/bin/xattr -rd com.apple.quarantine "$1" 2>/dev/null || true
          /usr/bin/xattr -cr "$1" 2>/dev/null || true
        }

        strip_quarantine_with_elevation() {
          local target="$1"
          strip_quarantine "$target"
          if has_quarantine "$target"; then
            echo "Retrying quarantine removal with administrator privileges for $target"
            local esc_target="${target//\'/\'\\\'\'}"
            /usr/bin/osascript -e "do shell script \\"/usr/bin/xattr -rd com.apple.quarantine '$esc_target' && /usr/bin/xattr -cr '$esc_target'\\" with administrator privileges" 2>/dev/null || true
            strip_quarantine "$target"
          fi
        }

        sentinel_unquarantine() {
          local app="$1"
          local sentinel_app="/Applications/Sentinel.app"

          if [[ ! -d "$sentinel_app" ]]; then
            echo "Sentinel is not installed at $sentinel_app; falling back to direct quarantine removal."
            strip_quarantine_with_elevation "$app"
            return 0
          fi

          local encoded_path
          encoded_path=$(/usr/bin/python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$app")

          echo "Running Sentinel quarantine removal for $app"
          /usr/bin/open -g "sentinel://?path=${encoded_path}" || {
            echo "WARNING: Sentinel deep link failed; trying file open."
            /usr/bin/open -g -a "$sentinel_app" "$app" || {
              echo "WARNING: Sentinel launch failed; falling back to direct quarantine removal."
              strip_quarantine_with_elevation "$app"
              return 0
            }
          }

          for _ in {1..75}; do
            if ! has_quarantine "$app"; then
              echo "Sentinel removed quarantine from $app"
              return 0
            fi
            /bin/sleep 0.2
          done

          echo "WARNING: Sentinel did not clear quarantine within timeout; falling back to direct quarantine removal."
          strip_quarantine_with_elevation "$app"
        }

        has_quarantine() {
          /usr/bin/xattr -pr com.apple.quarantine "$1" >/dev/null 2>&1
        }

        verify_installed_app() {
          local app="$1"
          if has_quarantine "$app"; then
            echo "ERROR: Installed app is still quarantined: $app"
            return 1
          fi

          if ! /usr/bin/codesign --verify --deep "$app" 2>/dev/null; then
            echo "Re-signing installed app after update..."
            /usr/bin/codesign -s - --force --deep "$app" 2>/dev/null || true
          fi

          if ! /usr/bin/codesign --verify --deep "$app" 2>/dev/null; then
            echo "WARNING: Installed app failed basic codesign verification: $app"
          fi

          return 0
        }
        
        replace_app() {
          local src="$1"
          local dest="$2"
          strip_quarantine "$src"
          if /usr/bin/ditto "$src" "$dest"; then
            sentinel_unquarantine "$dest"
            if verify_installed_app "$dest"; then
              return 0
            fi
          fi
          /bin/rm -rf "$dest"
          if /usr/bin/ditto "$src" "$dest"; then
            sentinel_unquarantine "$dest"
            if verify_installed_app "$dest"; then
              return 0
            fi
          fi
          local esc_src="${src//\'/\'\\\'\'}"
          local esc_dest="${dest//\'/\'\\\'\'}"
          /usr/bin/osascript -e "do shell script \\"/bin/rm -rf '$esc_dest' && /usr/bin/ditto '$esc_src' '$esc_dest'\\" with administrator privileges"
          sentinel_unquarantine "$dest"
          verify_installed_app "$dest"
        }
        
        while /bin/kill -0 "$PID" 2>/dev/null; do
          /bin/sleep 0.2
        done
        
        if [[ ! -f "$DOWNLOADED_FILE" ]]; then
          echo "ERROR: Downloaded update file not found at $DOWNLOADED_FILE"
          exit 1
        fi
        
        sentinel_unquarantine "$DOWNLOADED_FILE"
        
        NEW_APP=""
        MOUNT_POINT=""
        
        if [[ "$DOWNLOADED_FILE" == *.dmg ]]; then
          MOUNT_POINT=$(/usr/bin/mktemp -d /tmp/scanid-update-mount.XXXXXX)
          if ! /usr/bin/hdiutil attach -nobrowse -readonly -mountpoint "$MOUNT_POINT" "$DOWNLOADED_FILE" >/dev/null; then
            echo "ERROR: Failed to mount DMG at $DOWNLOADED_FILE"
            /bin/rm -rf "$MOUNT_POINT"
            exit 1
          fi
          NEW_APP=$(/usr/bin/find "$MOUNT_POINT" -maxdepth 2 -name "ScanID.app" -type d | /usr/bin/head -n 1)
          if [[ -z "$NEW_APP" ]]; then
            NEW_APP=$(/usr/bin/find "$MOUNT_POINT" -maxdepth 2 -name "*.app" -type d | /usr/bin/head -n 1)
          fi
        elif [[ "$DOWNLOADED_FILE" == *.zip ]]; then
          TMP_UNZIP_DIR=$(/usr/bin/mktemp -d)
          /usr/bin/unzip -q "$DOWNLOADED_FILE" -d "$TMP_UNZIP_DIR"
          NEW_APP=$(/usr/bin/find "$TMP_UNZIP_DIR" -name "ScanID.app" -type d -maxdepth 4 | /usr/bin/grep -v "__MACOSX" | /usr/bin/head -n 1)
        fi
        
        if [[ -z "$NEW_APP" || ! -d "$NEW_APP" ]]; then
          echo "ERROR: Could not find ScanID.app in downloaded update."
          if [[ -n "$MOUNT_POINT" ]]; then
            /usr/bin/hdiutil detach "$MOUNT_POINT" -force || true
            /bin/rm -rf "$MOUNT_POINT"
          fi
          exit 1
        fi
        
        echo "Installing from $NEW_APP to $INSTALL_TARGET"
        if ! replace_app "$NEW_APP" "$INSTALL_TARGET"; then
          echo "ERROR: Failed to replace app bundle."
          if [[ -n "$MOUNT_POINT" ]]; then
            /usr/bin/hdiutil detach "$MOUNT_POINT" -force || true
            /bin/rm -rf "$MOUNT_POINT"
          fi
          exit 1
        fi
        
        if [[ -n "$MOUNT_POINT" ]]; then
          /usr/bin/hdiutil detach "$MOUNT_POINT" -force || true
          /bin/rm -rf "$MOUNT_POINT"
        fi
        
        sentinel_unquarantine "$INSTALL_TARGET"
        /usr/bin/open "$INSTALL_TARGET"
        echo "=== ScanID update finished at $(date) ==="
        /bin/rm -- "$0"
        """
    }
    
    private static func shellQuote(_ value: String) -> String {
        "'" + value.replacingOccurrences(of: "'", with: "'\\''") + "'"
    }
}
