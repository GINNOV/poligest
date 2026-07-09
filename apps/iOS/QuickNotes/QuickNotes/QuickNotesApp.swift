import SwiftUI
import UserNotifications

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
                // Lock only after a successful unlock. Avoid racing with the Touch ID / passcode sheet.
                if newPhase == .background,
                   authenticator.isAuthenticated,
                   !authenticator.isAuthenticationInProgress {
                    authenticator.logOut()
                }
            }
            .onAppear {
                NotificationManager.shared.requestAuthorizationAndScheduleIfNeeded()
                #if !targetEnvironment(macCatalyst)
                _ = WatchConnectivityManager.shared
                #endif
            }
        }
    }
}

class NotificationManager {
    static let shared = NotificationManager()
    
    func requestAuthorizationAndScheduleIfNeeded() {
        let center = UNUserNotificationCenter.current()
        center.requestAuthorization(options: [.alert, .sound]) { granted, error in
            if granted {
                self.scheduleDaily9PMReminder()
            }
        }
    }
    
    private func scheduleDaily9PMReminder() {
        let center = UNUserNotificationCenter.current()
        let identifier = "daily_report_reminder"
        
        // Remove existing notification to avoid duplication
        center.removePendingNotificationRequests(withIdentifiers: [identifier])
        
        let content = UNMutableNotificationContent()
        content.title = "Invia Resoconto"
        content.body = "Ricordati di generare e inviare il resoconto giornaliero di oggi!"
        content.sound = .default
        
        var dateComponents = DateComponents()
        dateComponents.hour = 21 // 9 PM
        dateComponents.minute = 0
        
        let trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: true)
        
        let request = UNNotificationRequest(
            identifier: identifier,
            content: content,
            trigger: trigger
        )
        
        center.add(request) { error in
            if let error = error {
                print("Error scheduling reminder: \(error.localizedDescription)")
            }
        }
    }
}
