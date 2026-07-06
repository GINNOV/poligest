import Foundation

enum PaymentMethod: String, Codable, CaseIterable, Identifiable {
    case cash = "Contanti"
    case pos = "POS"
    case wire = "Bonifico"

    var id: String { self.rawValue }

    var iconName: String {
        switch self {
        case .cash: return "banknote"
        case .pos: return "creditcard"
        case .wire: return "arrow.up.right.and.arrow.down.left.rectangle"
        }
    }
}

enum TransactionType: String, Codable, CaseIterable, Identifiable {
    case income = "Entrata"
    case expense = "Uscita"

    var id: String { self.rawValue }
}

struct Transaction: Identifiable, Codable {
    var id = UUID()
    var clientName: String
    var patientId: String?
    var patientMatchKind: String?
    var financePaymentId: String?
    var financeEntryId: String?
    var financeSyncedAt: Date?
    var financeSyncError: String?
    var note: String?
    var amount: Double
    var paymentMethod: PaymentMethod
    var type: TransactionType
    var date: Date

    var displayNote: String? {
        let trimmedNote = note?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmedNote.isEmpty ? nil : trimmedNote
    }

    var isUnlinkedSorrisoClient: Bool {
        type == .income && patientId == nil && !clientName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var shouldSyncToSorriso: Bool {
        type == .income && patientId != nil && paymentMethod != .cash
    }
}

enum ICloudBackupRestoreResult {
    case restored(transactionCount: Int)
    case noBackupFound
    case failed(message: String)
}

class TransactionStore: ObservableObject {
    @Published var transactions: [Transaction] = [] {
        didSet {
            guard !isApplyingStoredTransactions else { return }
            save()
        }
    }

    private let fileURL: URL
    private let backupFileURL: URL
    private var isApplyingStoredTransactions = false

    private static var defaultFileURL: URL {
        let paths = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)
        return paths[0].appendingPathComponent("transactions.json")
    }

    private static func defaultBackupFileURL(for fileURL: URL) -> URL {
        fileURL
            .deletingLastPathComponent()
            .appendingPathComponent("transactions.icloud-backup.json")
    }

    init(fileURL: URL = TransactionStore.defaultFileURL, backupFileURL: URL? = nil) {
        self.fileURL = fileURL
        self.backupFileURL = backupFileURL ?? TransactionStore.defaultBackupFileURL(for: fileURL)
        load()
    }

    func add(_ transaction: Transaction) {
        guard !transaction.clientName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        transactions.append(transaction)
    }

    func update(_ transaction: Transaction) {
        guard let index = transactions.firstIndex(where: { $0.id == transaction.id }) else { return }
        transactions[index] = transaction
    }

    func delete(at offsets: IndexSet) {
        for index in offsets.sorted(by: >) {
            transactions.remove(at: index)
        }
    }

    func configureICloudBackup(enabled: Bool) {
        for protectedFileURL in [fileURL, backupFileURL] where FileManager.default.fileExists(atPath: protectedFileURL.path) {
            do {
                var url = protectedFileURL
                var values = URLResourceValues()
                values.isExcludedFromBackup = !enabled
                try url.setResourceValues(values)
            } catch {
                print("Error updating iCloud backup setting: \(error)")
            }
        }
    }

    func save() {
        do {
            let data = try JSONEncoder().encode(transactions)
            try data.write(to: fileURL)
            if !transactions.isEmpty {
                try data.write(to: backupFileURL)
            }
            configureICloudBackup(enabled: UserDefaults.standard.object(forKey: "icloudBackupEnabled") as? Bool ?? true)
        } catch {
            print("Error saving transactions: \(error)")
        }
    }

    func load() {
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return }
        do {
            applyStoredTransactions(try loadTransactions(from: fileURL))
        } catch {
            print("Error loading transactions: \(error)")
        }
    }

    func restoreICloudBackup() -> ICloudBackupRestoreResult {
        guard FileManager.default.fileExists(atPath: backupFileURL.path) else {
            return .noBackupFound
        }

        do {
            let restoredTransactions = try loadTransactions(from: backupFileURL)
            applyStoredTransactions(restoredTransactions)
            save()
            return .restored(transactionCount: restoredTransactions.count)
        } catch {
            return .failed(message: error.localizedDescription)
        }
    }

    private func applyStoredTransactions(_ restoredTransactions: [Transaction]) {
        isApplyingStoredTransactions = true
        defer { isApplyingStoredTransactions = false }
        transactions = restoredTransactions
    }

    private func loadTransactions(from url: URL) throws -> [Transaction] {
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode([Transaction].self, from: data)
    }

    func totals(for date: Date) -> (income: Double, expense: Double) {
        let calendar = Calendar.current
        let dayTransactions = transactions.filter { calendar.isDate($0.date, inSameDayAs: date) }

        let income = dayTransactions.filter { $0.type == .income }.reduce(0.0) { $0 + $1.amount }
        let expense = dayTransactions.filter { $0.type == .expense }.reduce(0.0) { $0 + $1.amount }

        return (income, expense)
    }
}
