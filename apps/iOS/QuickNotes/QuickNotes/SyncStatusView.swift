import SwiftUI

struct SyncStatusView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var store: TransactionStore
    @AppStorage("serverUrl") private var serverUrl = "https://sorrisosplendente.com"
    @AppStorage("apiToken") private var apiToken = "poligest_macos_secret"
    
    @State private var retryingIds: Set<UUID> = []
    
    var body: some View {
        NavigationStack {
            List {
                if retryableTransactions.isEmpty {
                    emptyState
                } else {
                    Section {
                        Button {
                            Task {
                                await retryAll()
                            }
                        } label: {
                            Label("Riprova tutti", systemImage: "arrow.clockwise")
                                .font(.headline)
                                .frame(maxWidth: .infinity)
                        }
                        .disabled(!retryingIds.isEmpty)
                    }
                    
                    Section("Da sincronizzare") {
                        ForEach(retryableTransactions) { transaction in
                            SyncStatusRow(
                                transaction: transaction,
                                isRetrying: retryingIds.contains(transaction.id)
                            ) {
                                Task {
                                    await retry(transaction)
                                }
                            }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Sincronizzazione")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fine") {
                        dismiss()
                    }
                }
            }
        }
    }
    
    private var retryableTransactions: [Transaction] {
        store.transactions
            .filter { $0.shouldSyncToSorriso && $0.financeSyncedAt == nil }
            .sorted { $0.date > $1.date }
    }
    
    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "checkmark.icloud")
                .font(.largeTitle)
                .foregroundColor(.green)
            Text("Tutto sincronizzato")
                .font(.headline)
            Text("Non ci sono movimenti QuickNotes in attesa di Sorriso.")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 36)
    }
    
    @MainActor
    private func retryAll() async {
        for transaction in retryableTransactions where !Task.isCancelled {
            await retry(transaction)
        }
    }
    
    @MainActor
    private func retry(_ transaction: Transaction) async {
        guard !retryingIds.contains(transaction.id) else { return }
        retryingIds.insert(transaction.id)
        defer { retryingIds.remove(transaction.id) }
        
        await QuickNotesSyncCoordinator.retrySync(
            transaction,
            store: store,
            serverURL: serverUrl,
            apiToken: apiToken
        )
    }
}

private struct SyncStatusRow: View {
    let transaction: Transaction
    let isRetrying: Bool
    let onRetry: () -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: transaction.financeSyncError == nil ? "clock.arrow.circlepath" : "exclamationmark.triangle.fill")
                    .font(.headline)
                    .foregroundColor(transaction.financeSyncError == nil ? .orange : .red)
                    .frame(width: 30, height: 30)
                    .background((transaction.financeSyncError == nil ? Color.orange : Color.red).opacity(0.12), in: Circle())
                
                VStack(alignment: .leading, spacing: 4) {
                    Text(transaction.clientName)
                        .font(.headline)
                        .lineLimit(1)
                    Text(transaction.date.formatted(date: .abbreviated, time: .shortened))
                        .font(.caption)
                        .foregroundColor(.secondary)
                    if let note = transaction.displayNote {
                        Text(note)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .lineLimit(2)
                    }
                }
                
                Spacer(minLength: 8)
                
                Text(String(format: "€ %.2f", transaction.amount))
                    .font(.headline.monospacedDigit())
                    .foregroundColor(.green)
            }
            
            if let error = transaction.financeSyncError {
                Text(error)
                    .font(.caption)
                    .foregroundColor(.red)
            }
            
            Button(action: onRetry) {
                HStack {
                    if isRetrying {
                        ProgressView()
                    } else {
                        Image(systemName: "arrow.clockwise")
                    }
                    Text(isRetrying ? "Sincronizzo..." : "Riprova")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .disabled(isRetrying)
        }
        .padding(.vertical, 6)
    }
}
