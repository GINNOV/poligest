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

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self)
        let normalizedValue = rawValue
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()

        switch normalizedValue {
        case "contanti", "cash":
            self = .cash
        case "pos", "card", "carta", "creditcard", "credit_card":
            self = .pos
        case "bonifico", "wire", "bank_transfer", "banktransfer", "transfer":
            self = .wire
        default:
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Metodo di pagamento non supportato: \(rawValue)"
            )
        }
    }
}

enum TransactionType: String, Codable, CaseIterable, Identifiable {
    case income = "Entrata"
    case expense = "Uscita"

    var id: String { self.rawValue }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self)
        let normalizedValue = rawValue
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()

        switch normalizedValue {
        case "entrata", "income":
            self = .income
        case "uscita", "expense":
            self = .expense
        default:
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Tipo movimento non supportato: \(rawValue)"
            )
        }
    }
}

enum EuroAmountFormatter {
    private static let formatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        formatter.usesGroupingSeparator = true
        formatter.groupingSeparator = ","
        formatter.decimalSeparator = "."
        return formatter
    }()

    static func string(_ value: Double, showAmounts: Bool = true, sign: String? = nil) -> String {
        let resolvedSign = sign ?? (value < 0 ? "-" : "")
        guard showAmounts else {
            return "\(resolvedSign)••••"
        }

        let formattedAmount = formatter.string(from: NSNumber(value: abs(value))) ?? String(format: "%.2f", abs(value))
        return "\(resolvedSign)€ \(formattedAmount)"
    }
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

enum TransactionJSONCoding {
    static func makeEncoder() -> JSONEncoder {
        JSONEncoder()
    }

    static func makeDecoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            try decodeDate(from: decoder)
        }
        return decoder
    }

    private static func decodeDate(from decoder: Decoder) throws -> Date {
        let container = try decoder.singleValueContainer()

        if let numericValue = try? container.decode(Double.self) {
            return Date(timeIntervalSinceReferenceDate: numericValue)
        }

        let stringValue = try container.decode(String.self)
        let trimmedValue = stringValue.trimmingCharacters(in: .whitespacesAndNewlines)

        if let date = iso8601WithFractionalSeconds.date(from: trimmedValue)
            ?? iso8601WithoutFractionalSeconds.date(from: trimmedValue)
            ?? dayFormatter.date(from: trimmedValue) {
            return date
        }

        throw DecodingError.dataCorruptedError(
            in: container,
            debugDescription: "Data movimento non supportata: \(stringValue)"
        )
    }

    private static let iso8601WithFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let iso8601WithoutFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
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
    private let cloudBackupService: CloudKitBackupServicing?
    private var isApplyingStoredTransactions = false
    private var shouldUpdateBackupOnSave = true

    private static var defaultFileURL: URL {
        let paths = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)
        return paths[0].appendingPathComponent("transactions.json")
    }

    private static func defaultBackupFileURL(for fileURL: URL) -> URL {
        fileURL
            .deletingLastPathComponent()
            .appendingPathComponent("transactions.icloud-backup.json")
    }

    init(fileURL: URL = TransactionStore.defaultFileURL, backupFileURL: URL? = nil, cloudBackupService: CloudKitBackupServicing? = nil) {
        self.fileURL = fileURL
        let resolvedBackupFileURL = backupFileURL ?? TransactionStore.defaultBackupFileURL(for: fileURL)
        self.backupFileURL = resolvedBackupFileURL
        self.cloudBackupService = cloudBackupService ?? (fileURL == TransactionStore.defaultFileURL ? CloudKitBackupService() : nil)
        load()
        WatchConnectivityManager.shared.sendTransactionsToWatch(transactions)
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
        shouldUpdateBackupOnSave = false
        defer { shouldUpdateBackupOnSave = true }
        for index in offsets.sorted(by: >) {
            transactions.remove(at: index)
        }
    }
    
    func replaceAll(with importedTransactions: [Transaction]) {
        transactions = importedTransactions
    }
    
    func mergeImportedTransactions(_ importedTransactions: [Transaction]) -> Int {
        let existingIds = Set(transactions.map(\.id))
        let newTransactions = importedTransactions.filter { !existingIds.contains($0.id) }
        guard !newTransactions.isEmpty else { return 0 }
        transactions.append(contentsOf: newTransactions)
        return newTransactions.count
    }

    func configureICloudBackup(enabled: Bool, uploadSnapshot: Bool = true) {
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

        if uploadSnapshot && enabled && !transactions.isEmpty {
            uploadCloudBackup(transactions)
        }
    }

    func save() {
        do {
            let data = try TransactionJSONCoding.makeEncoder().encode(transactions)
            try data.write(to: fileURL)
            if shouldUpdateBackupOnSave && !transactions.isEmpty {
                try data.write(to: backupFileURL)
            }
            configureICloudBackup(
                enabled: UserDefaults.standard.object(forKey: "icloudBackupEnabled") as? Bool ?? true,
                uploadSnapshot: shouldUpdateBackupOnSave
            )
            WatchConnectivityManager.shared.sendTransactionsToWatch(transactions)
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

    func restoreCloudBackup() async -> ICloudBackupRestoreResult {
        guard let cloudBackupService else {
            return restoreICloudBackup()
        }

        do {
            let restoredTransactions = try await cloudBackupService.restoreBackup()
            applyStoredTransactions(restoredTransactions)
            save()
            return .restored(transactionCount: restoredTransactions.count)
        } catch CloudKitBackupError.noBackupFound {
            return restoreICloudBackup()
        } catch {
            let localRestoreResult = restoreICloudBackup()
            if case .noBackupFound = localRestoreResult {
                return .failed(message: error.localizedDescription)
            }
            return localRestoreResult
        }
    }

    private func uploadCloudBackup(_ backupTransactions: [Transaction]) {
        guard let cloudBackupService else { return }

        Task {
            do {
                try await cloudBackupService.saveBackup(transactions: backupTransactions)
            } catch {
                print("Error saving CloudKit backup: \(error)")
            }
        }
    }

    private func applyStoredTransactions(_ restoredTransactions: [Transaction]) {
        isApplyingStoredTransactions = true
        defer { isApplyingStoredTransactions = false }
        transactions = restoredTransactions
    }

    private func loadTransactions(from url: URL) throws -> [Transaction] {
        let data = try Data(contentsOf: url)
        return try TransactionJSONCoding.makeDecoder().decode([Transaction].self, from: data)
    }

    func totals(for date: Date) -> (income: Double, expense: Double) {
        let calendar = Calendar.current
        let dayTransactions = transactions.filter { calendar.isDate($0.date, inSameDayAs: date) }

        let income = dayTransactions.filter { $0.type == .income }.reduce(0.0) { $0 + $1.amount }
        let expense = dayTransactions.filter { $0.type == .expense }.reduce(0.0) { $0 + $1.amount }

        return (income, expense)
    }
}

#if !os(iOS)
protocol CloudKitBackupServicing {
    func saveBackup(transactions: [Transaction]) async throws
    func restoreBackup() async throws -> [Transaction]
}

struct CloudKitBackupService: CloudKitBackupServicing {
    func saveBackup(transactions: [Transaction]) async throws {}
    func restoreBackup() async throws -> [Transaction] { return [] }
}

enum CloudKitBackupError: Error {
    case noBackupFound
}
#endif

struct TransactionFormRoute: Identifiable {
    let type: TransactionType
    let editingTransaction: Transaction?

    init(type: TransactionType, editingTransaction: Transaction? = nil) {
        self.type = type
        self.editingTransaction = editingTransaction
    }

    var id: String {
        if let tx = editingTransaction {
            return "edit-\(tx.id.uuidString)"
        } else {
            return "new-\(type.rawValue)"
        }
    }
}

