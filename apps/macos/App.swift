import SwiftUI
import AppKit

enum AppIconLoader {
    static var image: NSImage {
        if let icon = NSImage(named: "AppIcon") {
            return icon
        }
        if let url = Bundle.main.url(forResource: "AppIcon", withExtension: "icns"),
           let icon = NSImage(contentsOf: url) {
            return icon
        }
        return NSWorkspace.shared.icon(forFile: Bundle.main.bundlePath)
    }
}

@MainActor
final class AboutWindowController {
    static let shared = AboutWindowController()
    private var window: NSWindow?

    func show() {
        if window == nil {
            let hosting = NSHostingController(rootView: AboutView())
            let panel = NSPanel(
                contentRect: NSRect(x: 0, y: 0, width: 320, height: 280),
                styleMask: [.titled, .closable, .nonactivatingPanel],
                backing: .buffered,
                defer: false
            )
            panel.contentViewController = hosting
            panel.title = "About ScanID"
            panel.isReleasedWhenClosed = false
            panel.center()
            window = panel
        }

        NSApp.activate(ignoringOtherApps: true)
        window?.makeKeyAndOrderFront(nil)
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApplication.shared.applicationIconImage = AppIconLoader.image
    }
    
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }
}

struct AboutView: View {
    private var appVersion: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(version) (\(build))"
    }

    var body: some View {
        VStack(spacing: 14) {
            Image(nsImage: AppIconLoader.image)
                .resizable()
                .interpolation(.high)
                .frame(width: 128, height: 128)

            Text("ScanID")
                .font(.system(size: 24, weight: .semibold))

            Text("Version \(appVersion)")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            Text("Italian ID card scanner for Sorriso")
                .font(.caption)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 12)

            Text("Copyright © 2026 Poligest")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .padding(28)
        .frame(width: 320)
    }
}

@main
struct ScanIDApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        WindowGroup {
            MainView()
                .navigationTitle("ScanID")
        }
        .windowStyle(.titleBar)
        .commands {
            ScanCommands()
            CommandGroup(replacing: .appInfo) {
                Button("About ScanID") {
                    AboutWindowController.shared.show()
                }
            }
        }
    }
}