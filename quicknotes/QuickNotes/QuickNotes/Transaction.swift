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
    var amount: Double
    var paymentMethod: PaymentMethod
    var type: TransactionType
    var date: Date
}

class TransactionStore: ObservableObject {
    @Published var transactions: [Transaction] = [] {
        didSet {
            save()
        }
    }
    
    private var fileURL: URL {
        let paths = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)
        return paths[0].appendingPathComponent("transactions.json")
    }
    
    init() {
        load()
    }
    
    func add(_ transaction: Transaction) {
        transactions.append(transaction)
    }
    
    func delete(at offsets: IndexSet) {
        transactions.remove(atOffsets: offsets)
    }
    
    func save() {
        do {
            let data = try JSONEncoder().encode(transactions)
            try data.write(to: fileURL)
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
