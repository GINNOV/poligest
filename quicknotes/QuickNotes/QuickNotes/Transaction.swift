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
    var amount: Double
    var paymentMethod: PaymentMethod
    var type: TransactionType
    var date: Date
    
    var isUnlinkedSorrisoClient: Bool {
        type == .income && patientId == nil && !clientName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}

class TransactionStore: ObservableObject {
    @Published var transactions: [Transaction] = [] {
        didSet {
            save()
        }
    }
    
    private let fileURL: URL
    
    private static var defaultFileURL: URL {
        let paths = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)
        return paths[0].appendingPathComponent("transactions.json")
    }
    
    init(fileURL: URL = TransactionStore.defaultFileURL) {
        self.fileURL = fileURL
        load()
    }
    
    func add(_ transaction: Transaction) {
        transactions.append(transaction)
    }
    
    func update(_ transaction: Transaction) {
        guard let index = transactions.firstIndex(where: { $0.id == transaction.id }) else { return }
        transactions[index] = transaction
    }
    
    func delete(at offsets: IndexSet) {
        transactions.remove(atOffsets: offsets)
    }
    
    func configureICloudBackup(enabled: Bool) {
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return }
        
        do {
            var url = fileURL
            var values = URLResourceValues()
            values.isExcludedFromBackup = !enabled
            try url.setResourceValues(values)
        } catch {
            print("Error updating iCloud backup setting: \(error)")
        }
    }
    
    func save() {
        do {
            let data = try JSONEncoder().encode(transactions)
            try data.write(to: fileURL)
            configureICloudBackup(enabled: UserDefaults.standard.object(forKey: "icloudBackupEnabled") as? Bool ?? true)
        } catch {
            print("Error saving transactions: \(error)")
        }
    }
    
    func load() {
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return }
        do {
            let data = try Data(contentsOf: fileURL)
            transactions = try JSONDecoder().decode([Transaction].self, from: data)
        } catch {
            print("Error loading transactions: \(error)")
        }
    }
    
    func totals(for date: Date) -> (income: Double, expense: Double) {
        let calendar = Calendar.current
        let dayTransactions = transactions.filter { calendar.isDate($0.date, inSameDayAs: date) }
        
        let income = dayTransactions.filter { $0.type == .income }.reduce(0.0) { $0 + $1.amount }
        let expense = dayTransactions.filter { $0.type == .expense }.reduce(0.0) { $0 + $1.amount }
        
        return (income, expense)
    }
}
