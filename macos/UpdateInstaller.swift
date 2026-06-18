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
    
    static func resolvedInstallTarget() -> String? {
        let bundlePath = Bundle.main.bundlePath
        let bundleURL = URL(fileURLWithPath: bundlePath).resolvingSymlinksInPath()
        
        if bundlePath.contains("AppTranslocation") {
            let applicationsPath = "/Applications/ScanID.app"
            if FileManager.default.fileExists(atPath: applicationsPath) {
                return applicationsPath
            }
        }
        
        if FileManager.default.fileExists(atPath: bundleURL.path) {
            return bundleURL.path
        }
        
        let applicationsPath = "/Applications/ScanID.app"
        if FileManager.default.fileExists(atPath: applicationsPath) {
            return applicationsPath
        }
        
        return nil
    }
    
    static func launchInstall(downloadedFile: URL) throws {
        guard let installTarget = resolvedInstallTarget() else {
            throw UpdateInstallerError.noInstallTarget
        }
        
        let pid = ProcessInfo.processInfo.processIdentifier
        let scriptURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("install-scanid-update-\(pid).sh")
        
        let script = installScript(
            pid: pid,
            installTarget: installTarget,
            downloadedFile: downloadedFile.path,
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
        
        replace_app() {
          local src="$1"
          local dest="$2"
          if /usr/bin/ditto "$src" "$dest"; then
            return 0
          fi
          /bin/rm -rf "$dest"
          if /usr/bin/ditto "$src" "$dest"; then
            return 0
          fi
          local esc_src="${src//\'/\'\\\'\'}"
          local esc_dest="${dest//\'/\'\\\'\'}"
          /usr/bin/osascript -e "do shell script \\"/bin/rm -rf '$esc_dest' && /usr/bin/ditto '$esc_src' '$esc_dest'\\" with administrator privileges"
        }
        
        while /bin/kill -0 "$PID" 2>/dev/null; do
          /bin/sleep 0.2
        done
        
        NEW_APP=""
        MOUNT_POINT=""
        
        if [[ "$DOWNLOADED_FILE" == *.dmg ]]; then
          MOUNT_POINT=$(/usr/bin/hdiutil attach -nobrowse -readonly "$DOWNLOADED_FILE" | /usr/bin/tail -1 | /usr/bin/awk '{print $NF}')
          if [[ -n "$MOUNT_POINT" && -d "$MOUNT_POINT" ]]; then
            NEW_APP=$(/usr/bin/find "$MOUNT_POINT" -maxdepth 2 -name "ScanID.app" -type d | /usr/bin/head -n 1)
            if [[ -z "$NEW_APP" ]]; then
              NEW_APP=$(/usr/bin/find "$MOUNT_POINT" -maxdepth 2 -name "*.app" -type d | /usr/bin/head -n 1)
            fi
          fi
        elif [[ "$DOWNLOADED_FILE" == *.zip ]]; then
          TMP_UNZIP_DIR=$(/usr/bin/mktemp -d)
          /usr/bin/unzip -q "$DOWNLOADED_FILE" -d "$TMP_UNZIP_DIR"
          NEW_APP=$(/usr/bin/find "$TMP_UNZIP_DIR" -name "ScanID.app" -type d -maxdepth 4 | /usr/bin/grep -v "__MACOSX" | /usr/bin/head -n 1)
        fi
        
        if [[ -z "$NEW_APP" || ! -d "$NEW_APP" ]]; then
          echo "ERROR: Could not find ScanID.app in downloaded update."
          exit 1
        fi
        
        echo "Installing from $NEW_APP to $INSTALL_TARGET"
        if ! replace_app "$NEW_APP" "$INSTALL_TARGET"; then
          echo "ERROR: Failed to replace app bundle."
          exit 1
        fi
        
        if [[ -n "$MOUNT_POINT" ]]; then
          /usr/bin/hdiutil detach "$MOUNT_POINT" -force || true
        fi
        
        /usr/bin/open "$INSTALL_TARGET"
        echo "=== ScanID update finished at $(date) ==="
        /bin/rm -- "$0"
        """
    }
    
    private static func shellQuote(_ value: String) -> String {
        "'" + value.replacingOccurrences(of: "'", with: "'\\''") + "'"
    }
}