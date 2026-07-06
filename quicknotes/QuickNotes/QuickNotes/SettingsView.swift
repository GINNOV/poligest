import SwiftUI

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var store: TransactionStore
    
    @AppStorage("icloudBackupEnabled") private var iCloudBackupEnabled = true
    @AppStorage("showAmounts") private var showAmounts = true
    @AppStorage("serverUrl") private var serverUrl = "https://sorrisosplendente.com"
    @AppStorage("apiToken") private var apiToken = "poligest_macos_secret"
    @State private var showApiToken = false
    
    var body: some View {
        NavigationStack {
            List {
                Section {
                    Label {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Server Sorriso")
                            TextField("https://sorrisosplendente.com", text: $serverUrl)
                                .textInputAutocapitalization(.never)
                                .keyboardType(.URL)
                                .autocorrectionDisabled()
                                .font(.caption.monospaced())
                        }
                    } icon: {
                        Image(systemName: "network")
                            .foregroundColor(.blue)
                    }
                    
                    Label {
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                if showApiToken {
                                    TextField("Chiave API", text: $apiToken)
                                        .textInputAutocapitalization(.never)
                                        .autocorrectionDisabled()
                                        .font(.caption.monospaced())
                                } else {
                                    SecureField("Chiave API", text: $apiToken)
                                        .textInputAutocapitalization(.never)
                                        .autocorrectionDisabled()
                                        .font(.caption.monospaced())
                                }
                                
                                Button {
                                    showApiToken.toggle()
                                } label: {
                                    Image(systemName: showApiToken ? "eye.slash" : "eye")
                                }
                                .buttonStyle(.plain)
                                .foregroundColor(.secondary)
                                .accessibilityLabel(showApiToken ? "Nascondi chiave API" : "Mostra chiave API")
                            }
                            
                            Text("Usa la stessa chiave configurata in ScanID.")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    } icon: {
                        Image(systemName: "key")
                            .foregroundColor(.orange)
                    }
                } header: {
                    Text("Sorriso")
                }
                
                Section {
                    Toggle(isOn: $iCloudBackupEnabled) {
                        Label {
                            VStack(alignment: .leading, spacing: 3) {
                                Text("Backup su iCloud")
                                Text("Include i movimenti nel backup iCloud del dispositivo.")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        } icon: {
                            Image(systemName: "icloud")
                                .foregroundColor(.blue)
                        }
                    }
                    
                    Toggle(isOn: $showAmounts) {
                        Label {
                            VStack(alignment: .leading, spacing: 3) {
                                Text("Mostra importi movimenti")
                                Text("Nasconde solo gli importi nelle liste dei movimenti.")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        } icon: {
                            Image(systemName: showAmounts ? "eye" : "eye.slash")
                                .foregroundColor(.purple)
                        }
                    }
                }
                
                Section("Versione") {
                    HStack {
                        Text("App")
                        Spacer()
                        Text(appVersionText)
                            .foregroundColor(.secondary)
                    }
                }
            }
            .navigationTitle("Impostazioni")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fine") {
                        dismiss()
                    }
                }
            }
            .onAppear {
                store.configureICloudBackup(enabled: iCloudBackupEnabled)
            }
            .onChange(of: iCloudBackupEnabled) { enabled in
                store.configureICloudBackup(enabled: enabled)
            }
        }
    }
    
    private var appVersionText: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1"
        return "\(version) (\(build))"
    }
}
