import SwiftUI

@main
struct QuickNotesApp: App {
    @StateObject private var authenticator = BiometricAuthenticator()
    @Environment(\.scenePhase) private var scenePhase
    
    var body: some Scene {
        WindowGroup {
            Group {
                if authenticator.isAuthenticated {
                    ContentView(authenticator: authenticator)
                } else {
                    LockScreenView(authenticator: authenticator)
                }
            }
            .onChange(of: scenePhase) { newPhase in
                // Automatically lock the app when it is backgrounded
                if newPhase == .background {
                    authenticator.logOut()
                }
            }
        }
    }
}
