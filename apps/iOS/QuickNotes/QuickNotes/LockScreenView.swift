import SwiftUI

struct LockScreenView: View {
    @ObservedObject var authenticator: BiometricAuthenticator
    
    var body: some View {
        VStack(spacing: 28) {
            Spacer(minLength: 32)
            
            VStack(spacing: 18) {
                Image(systemName: "faceid")
                    .font(.system(size: 58, weight: .light))
                    .foregroundColor(.blue)
                    .frame(width: 96, height: 96)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 30, style: .continuous))
                
                VStack(spacing: 8) {
                    Text("QuickNotes")
                        .font(.system(.largeTitle, design: .rounded, weight: .bold))
                    Text("I tuoi conti al sicuro")
                        .font(.headline)
                        .foregroundColor(.secondary)
                }
            }
            
            if let error = authenticator.errorMessage {
                Text(error)
                    .font(.subheadline)
                    .foregroundColor(.red)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 14)
                    .background(Color.red.opacity(0.08), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .padding(.horizontal, 20)
            }
            
            Spacer()
            
            Button(action: {
                authenticator.authenticate()
            }) {
                Label("Sblocca", systemImage: "lock.open")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(UnlockButtonStyle())
            .padding(.horizontal, 20)
            .padding(.bottom, 10)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemGroupedBackground))
        .onAppear {
            authenticator.authenticate()
        }
    }
}

private struct UnlockButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundColor(.white)
            .padding(.vertical, 16)
            .background(Color.blue.opacity(configuration.isPressed ? 0.78 : 1), in: Capsule())
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
    }
}
