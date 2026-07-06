import SwiftUI

struct LockScreenView: View {
    @ObservedObject var authenticator: BiometricAuthenticator
    
    var body: some View {
        VStack(spacing: 28) {
            Spacer(minLength: 32)
            
            VStack(spacing: 20) {
                Image("StudioAgovinoAngrisanoLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: 300, maxHeight: 36)
                    .padding(.horizontal, 32)
                    .accessibilityLabel("Studio Agovino Angrisano")

                AppLogoLockIcon()
                
                VStack(spacing: 8) {
                    Text("Sorriso Mobile")
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

private struct AppLogoLockIcon: View {
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 30, style: .continuous)
                .fill(.regularMaterial)

            Image("AppLogo")
                .resizable()
                .scaledToFit()
                .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                .padding(10)
        }
        .frame(width: 112, height: 112)
        .shadow(color: Color.black.opacity(0.06), radius: 18, x: 0, y: 10)
        .accessibilityHidden(true)
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
