import Foundation

enum QuickNotesSyncCoordinator {
    @MainActor
    static func syncToFinanceIfNeeded(
        _ transaction: Transaction,
        store: TransactionStore,
        serverURL: String,
        apiToken: String
    ) {
        guard transaction.shouldSyncToSorriso else { return }
        
        Task {
            await retrySync(transaction, store: store, serverURL: serverURL, apiToken: apiToken)
        }
    }
    
    @MainActor
    @discardableResult
    static func retrySync(
        _ transaction: Transaction,
        store: TransactionStore,
        serverURL: String,
        apiToken: String
    ) async -> Bool {
        guard transaction.shouldSyncToSorriso else { return false }
        
        var syncedTransaction = transaction
        
        do {
            let service = FinanceSyncService(serverURL: serverURL, apiToken: apiToken)
            let result = try await service.syncPatientPayment(transaction: transaction)
            syncedTransaction.financePaymentId = result.paymentId
            syncedTransaction.financeEntryId = result.financeEntryId
            syncedTransaction.financeSyncedAt = Date()
            syncedTransaction.financeSyncError = nil
            store.update(syncedTransaction)
            return true
        } catch {
            syncedTransaction.financeSyncError = error.localizedDescription
            store.update(syncedTransaction)
            return false
        }
    }
}
