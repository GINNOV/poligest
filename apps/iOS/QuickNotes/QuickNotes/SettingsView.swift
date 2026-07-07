import SwiftUI

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var store: TransactionStore

    @AppStorage("icloudBackupEnabled") private var iCloudBackupEnabled = true
    @AppStorage("showAmounts") private var showAmounts = true
    @AppStorage("showMesiShortcut") private var showMesiShortcut = true
    @AppStorage("showMonthlyReportShortcut") private var showMonthlyReportShortcut = true
    @AppStorage("serverUrl") private var serverUrl = "https://sorrisosplendente.com"
    @AppStorage("apiToken") private var apiToken = "poligest_macos_secret"
    @AppStorage("whatsappDailyReportMessage") private var whatsappDailyReportMessage = DailyReportWhatsApp.defaultMessageTemplate
    @State private var showApiToken = false
    @State private var restoreAlertTitle = ""
    @State private var restoreAlertMessage = ""
    @State private var showingRestoreAlert = false
    @State private var isRestoringBackup = false

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

                            Text("Usa il token registrato dentro Sorriso.")
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
                    Label {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Messaggio predefinito")
                                .font(.subheadline.weight(.semibold))

                            TextEditor(text: $whatsappDailyReportMessage)
                                .frame(minHeight: 92)
                                .scrollContentBackground(.hidden)
                                .padding(8)
                                .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12, style: .continuous))

                            Button("Ripristina messaggio standard") {
                                whatsappDailyReportMessage = DailyReportWhatsApp.defaultMessageTemplate
                            }
                            .font(.caption.weight(.semibold))
                        }
                    } icon: {
                        Image(systemName: "message")
                            .foregroundColor(.green)
                    }
                } header: {
                    Text("WhatsApp")
                } footer: {
                    Text("Usa {date} per inserire automaticamente la data del resoconto. L'invio va confermato dentro WhatsApp.")
                }

                Section {
                    Toggle(isOn: $iCloudBackupEnabled) {
                        Label {
                            VStack(alignment: .leading, spacing: 3) {
                                Text("Backup su iCloud")
                                Text("Salva una copia privata dei movimenti su iCloud.")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        } icon: {
                            Image(systemName: "icloud")
                                .foregroundColor(.blue)
                        }
                    }

                    Button {
                        Task {
                            await restoreICloudBackup()
                        }
                    } label: {
                        Label {
                            VStack(alignment: .leading, spacing: 3) {
                                Text("Ripristina backup iCloud")
                                Text("Ricarica i movimenti salvati nel backup iCloud privato.")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        } icon: {
                            if isRestoringBackup {
                                ProgressView()
                            } else {
                                Image(systemName: "icloud.and.arrow.down")
                                    .foregroundColor(.blue)
                            }
                        }
                    }
                    .disabled(isRestoringBackup)

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

                    Toggle(isOn: $showMesiShortcut) {
                        Label {
                            VStack(alignment: .leading, spacing: 3) {
                                Text("Mostra Mesi")
                                Text("Mostra o nasconde il collegamento Mesi nella schermata principale.")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        } icon: {
                            Image(systemName: "calendar.day.timeline.left")
                                .foregroundColor(.blue)
                        }
                    }

                    Toggle(isOn: $showMonthlyReportShortcut) {
                        Label {
                            VStack(alignment: .leading, spacing: 3) {
                                Text("Mostra resoconto mensile")
                                Text("Mostra o nasconde il collegamento Resoconti nella schermata principale.")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        } icon: {
                            Image(systemName: "calendar")
                                .foregroundColor(.blue)
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
            .alert(restoreAlertTitle, isPresented: $showingRestoreAlert) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(restoreAlertMessage)
            }
        }
    }

    @MainActor
    private func restoreICloudBackup() async {
        guard !isRestoringBackup else { return }
        isRestoringBackup = true
        let result = await store.restoreCloudBackup()
        isRestoringBackup = false

        switch result {
        case .restored(let transactionCount):
            restoreAlertTitle = "Backup ripristinato"
            restoreAlertMessage = "Movimenti caricati: \(transactionCount)."
        case .noBackupFound:
            restoreAlertTitle = "Nessun backup trovato"
            restoreAlertMessage = "Non ci sono movimenti salvati nel backup iCloud."
        case .failed(let message):
            restoreAlertTitle = "Ripristino non riuscito"
            restoreAlertMessage = message
        }

        showingRestoreAlert = true
    }

    private var appVersionText: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1"
        return "\(version) (\(build))"
    }
}
