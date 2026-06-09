import SwiftUI

@main
struct ScanIDApp: App {
    var body: some Scene {
        WindowGroup {
            MainView()
                .navigationTitle("Italian ID Scanner")
        }
        .windowStyle(.titleBar)
    }
}
