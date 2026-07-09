import Foundation
import LocalAuthentication

class BiometricAuthenticator: ObservableObject {
    @Published var isAuthenticated = false
    @Published var isBiometricsAvailable = false
    @Published var errorMessage: String? = nil
    private(set) var isAuthenticationInProgress = false

    private var authContext: LAContext?

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
        guard !isAuthenticated, !isAuthenticationInProgress else { return }

        #if targetEnvironment(simulator)
        DispatchQueue.main.async {
            self.isAuthenticated = true
            self.errorMessage = nil
        }
        #else
        let context = LAContext()
        authContext = context
        isAuthenticationInProgress = true
        var error: NSError?

        if context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) {
            let reason = "Sblocca l'applicazione per accedere ai tuoi conti."

            context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { success, authenticationError in
                DispatchQueue.main.async {
                    self.isAuthenticationInProgress = false
                    self.authContext = nil

                    if success {
                        self.isAuthenticated = true
                        self.errorMessage = nil
                    } else if let authenticationError = authenticationError as NSError?,
                              authenticationError.code == LAError.userCancel.rawValue
                              || authenticationError.code == LAError.systemCancel.rawValue
                              || authenticationError.code == LAError.appCancel.rawValue {
                        self.errorMessage = nil
                    } else if let authenticationError {
                        self.errorMessage = authenticationError.localizedDescription
                    } else {
                        self.errorMessage = "Impossibile verificare l'identità."
                    }
                }
            }
        } else {
            isAuthenticationInProgress = false
            authContext = nil
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