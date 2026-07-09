import Foundation
import LocalAuthentication

class BiometricAuthenticator: ObservableObject {
    @Published var isAuthenticated = false
    @Published var isBiometricsAvailable = false
    @Published var errorMessage: String? = nil
    
    init() {
        checkBiometrics()
    }
    
    func checkBiometrics() {
        let context = LAContext()
        var error: NSError?
        isBiometricsAvailable = context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error)
        if let error = error {
            print("Biometrics check error: \(error.localizedDescription)")
        }
    }
    
    func authenticate() {
        #if targetEnvironment(simulator)
        DispatchQueue.main.async {
            self.isAuthenticated = true
            self.errorMessage = nil
        }
        #else
        let context = LAContext()
        var error: NSError?
        
        // deviceOwnerAuthentication allows Face ID / Touch ID and falls back to Device Passcode if biometrics fail or are not set up.
        if context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) {
            let reason = "Sblocca l'applicazione per accedere ai tuoi conti."
            
            context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { success, authenticationError in
                DispatchQueue.main.async {
                    if success {
                        self.isAuthenticated = true
                        self.errorMessage = nil
                    } else {
                        if let error = authenticationError {
                            self.errorMessage = error.localizedDescription
                        } else {
                            self.errorMessage = "Impossibile verificare l'identità."
                        }
                    }
                }
            }
        } else {
            DispatchQueue.main.async {
                // If there are no biometrics or passcode configured on the device at all, we bypass to prevent lockout.
                self.isAuthenticated = true
                self.errorMessage = nil
            }
        }
        #endif
    }
    
    func logOut() {
        isAuthenticated = false
    }
}
