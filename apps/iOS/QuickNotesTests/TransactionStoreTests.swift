import XCTest
@testable import QuickNotes

final class TransactionStoreTests: XCTestCase {
    private var temporaryDirectory: URL!

    override func setUpWithError() throws {
        temporaryDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: temporaryDirectory, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        if let temporaryDirectory {
            try? FileManager.default.removeItem(at: temporaryDirectory)
        }
        temporaryDirectory = nil
    }

    func testPersistsTransactionsAndReloadsTotalsFromInjectedFile() throws {
        let storageURL = temporaryDirectory.appendingPathComponent("transactions.json")
        let store = TransactionStore(fileURL: storageURL)
        let day = try XCTUnwrap(Calendar.current.date(from: DateComponents(year: 2026, month: 7, day: 6, hour: 10)))
        let otherDay = try XCTUnwrap(Calendar.current.date(from: DateComponents(year: 2026, month: 7, day: 7, hour: 10)))

        store.add(Transaction(
            clientName: "Mario Rossi",
            patientId: "patient-1",
            patientMatchKind: "name",
            note: "Prima visita",
            amount: 120,
            paymentMethod: .pos,
            type: .income,
            date: day
        ))
        store.add(Transaction(
            clientName: "Studio",
            amount: 45,
            paymentMethod: .cash,
            type: .expense,
            date: day
        ))
        store.add(Transaction(
            clientName: "Other Day",
            amount: 99,
            paymentMethod: .wire,
            type: .income,
            date: otherDay
        ))

        XCTAssertTrue(FileManager.default.fileExists(atPath: storageURL.path))

        let reloadedStore = TransactionStore(fileURL: storageURL)
        XCTAssertEqual(reloadedStore.transactions.count, 3)
        XCTAssertEqual(reloadedStore.transactions.first?.note, "Prima visita")

        let totals = reloadedStore.totals(for: day)
        XCTAssertEqual(totals.income, 120)
        XCTAssertEqual(totals.expense, 45)
    }

    func testUpdateAndDeletePersistToStorage() throws {
        let storageURL = temporaryDirectory.appendingPathComponent("transactions.json")
        let store = TransactionStore(fileURL: storageURL)
        var transaction = Transaction(
            clientName: "Cliente",
            amount: 10,
            paymentMethod: .cash,
            type: .income,
            date: Date()
        )
        store.add(transaction)

        transaction.clientName = "Cliente aggiornato"
        transaction.amount = 25
        store.update(transaction)

        let reloadedStore = TransactionStore(fileURL: storageURL)
        XCTAssertEqual(reloadedStore.transactions.first?.clientName, "Cliente aggiornato")
        XCTAssertEqual(reloadedStore.transactions.first?.amount, 25)

        reloadedStore.delete(at: IndexSet(integer: 0))

        let emptyStore = TransactionStore(fileURL: storageURL)
        XCTAssertTrue(emptyStore.transactions.isEmpty)
    }

    func testAddIgnoresIncomeAndExpenseWhenClientNameIsBlank() {
        let storageURL = temporaryDirectory.appendingPathComponent("transactions.json")
        let store = TransactionStore(fileURL: storageURL)

        store.add(Transaction(
            clientName: "   ",
            amount: 10,
            paymentMethod: .cash,
            type: .income,
            date: Date()
        ))
        store.add(Transaction(
            clientName: "",
            amount: 10,
            paymentMethod: .pos,
            type: .expense,
            date: Date()
        ))

        XCTAssertTrue(store.transactions.isEmpty)
        XCTAssertFalse(FileManager.default.fileExists(atPath: storageURL.path))
    }

    func testCashIncomeDoesNotSyncToSorrisoEvenWhenPatientIsLinked() {
        let cashIncome = Transaction(
            clientName: "Mario Rossi",
            patientId: "patient-1",
            amount: 90,
            paymentMethod: .cash,
            type: .income,
            date: Date()
        )
        let posIncome = Transaction(
            clientName: "Mario Rossi",
            patientId: "patient-1",
            amount: 90,
            paymentMethod: .pos,
            type: .income,
            date: Date()
        )
        let unlinkedWireIncome = Transaction(
            clientName: "Mario Rossi",
            amount: 90,
            paymentMethod: .wire,
            type: .income,
            date: Date()
        )

        XCTAssertFalse(cashIncome.shouldSyncToSorriso)
        XCTAssertTrue(posIncome.shouldSyncToSorriso)
        XCTAssertFalse(unlinkedWireIncome.shouldSyncToSorriso)
    }

    func testEuroAmountFormatterKeepsLegacyDecimalStyleWithGrouping() {
        XCTAssertEqual(EuroAmountFormatter.string(23_648.88), "€ 23,648.88")
        XCTAssertEqual(EuroAmountFormatter.string(1_234.56, sign: "+"), "+€ 1,234.56")
        XCTAssertEqual(EuroAmountFormatter.string(1_234.56, sign: "-"), "-€ 1,234.56")
        XCTAssertEqual(EuroAmountFormatter.string(1_234.56, showAmounts: false, sign: "+"), "+••••")
    }

    func testRestoreICloudBackupRecoversAfterDeletingAllTransactions() throws {
        let storageURL = temporaryDirectory.appendingPathComponent("transactions.json")
        let backupURL = temporaryDirectory.appendingPathComponent("transactions.icloud-backup.json")
        let store = TransactionStore(fileURL: storageURL, backupFileURL: backupURL)
        let savedTransaction = Transaction(
            clientName: "Ripristinato",
            amount: 30,
            paymentMethod: .pos,
            type: .income,
            date: Date()
        )

        store.add(savedTransaction)
        XCTAssertTrue(FileManager.default.fileExists(atPath: storageURL.path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: backupURL.path))

        store.delete(at: IndexSet(integer: 0))

        let deletedStore = TransactionStore(fileURL: storageURL, backupFileURL: backupURL)
        XCTAssertTrue(deletedStore.transactions.isEmpty)

        switch store.restoreICloudBackup() {
        case .restored(let transactionCount):
            XCTAssertEqual(transactionCount, 1)
        case .noBackupFound, .failed:
            XCTFail("Expected restored backup")
        }

        XCTAssertEqual(store.transactions.map(\.clientName), ["Ripristinato"])
    }

    func testRestoreICloudBackupRecoversTransactionDeletedAfterBackupSnapshot() throws {
        let storageURL = temporaryDirectory.appendingPathComponent("transactions.json")
        let backupURL = temporaryDirectory.appendingPathComponent("transactions.icloud-backup.json")
        let store = TransactionStore(fileURL: storageURL, backupFileURL: backupURL)

        store.add(Transaction(
            clientName: "Da tenere",
            amount: 10,
            paymentMethod: .pos,
            type: .income,
            date: Date()
        ))
        store.add(Transaction(
            clientName: "Da ripristinare",
            amount: 20,
            paymentMethod: .wire,
            type: .income,
            date: Date()
        ))

        store.delete(at: IndexSet(integer: 1))
        XCTAssertEqual(store.transactions.map(\.clientName), ["Da tenere"])

        switch store.restoreICloudBackup() {
        case .restored(let transactionCount):
            XCTAssertEqual(transactionCount, 2)
        case .noBackupFound, .failed:
            XCTFail("Expected restored backup")
        }

        XCTAssertEqual(store.transactions.map(\.clientName), ["Da tenere", "Da ripristinare"])
    }

    func testRestoreICloudBackupReportsMissingBackup() {
        let storageURL = temporaryDirectory.appendingPathComponent("missing-transactions.json")
        let backupURL = temporaryDirectory.appendingPathComponent("missing-transactions.icloud-backup.json")
        let store = TransactionStore(fileURL: storageURL, backupFileURL: backupURL)

        switch store.restoreICloudBackup() {
        case .noBackupFound:
            break
        case .restored, .failed:
            XCTFail("Expected missing backup result")
        }
    }

    func testRestoreCloudBackupRestoresPrivateCloudSnapshot() async {
        let storageURL = temporaryDirectory.appendingPathComponent("cloud-transactions.json")
        let cloudTransaction = Transaction(
            clientName: "CloudKit",
            amount: 80,
            paymentMethod: .pos,
            type: .income,
            date: Date()
        )
        let cloudService = FakeCloudKitBackupService(restoredTransactions: [cloudTransaction])
        let store = TransactionStore(fileURL: storageURL, cloudBackupService: cloudService)

        store.add(Transaction(
            clientName: "Locale",
            amount: 20,
            paymentMethod: .cash,
            type: .expense,
            date: Date()
        ))

        switch await store.restoreCloudBackup() {
        case .restored(let transactionCount):
            XCTAssertEqual(transactionCount, 1)
        case .noBackupFound, .failed:
            XCTFail("Expected restored CloudKit backup")
        }

        XCTAssertEqual(store.transactions.map(\.clientName), ["CloudKit"])
    }
    
    func testMergeImportedTransactionsAddsOnlyNewIds() {
        let storageURL = temporaryDirectory.appendingPathComponent("transactions.json")
        let store = TransactionStore(fileURL: storageURL)
        let existing = Transaction(
            clientName: "Esistente",
            amount: 10,
            paymentMethod: .cash,
            type: .income,
            date: Date()
        )
        let imported = Transaction(
            clientName: "Importato",
            amount: 20,
            paymentMethod: .pos,
            type: .income,
            date: Date()
        )
        
        store.add(existing)
        let importedCount = store.mergeImportedTransactions([existing, imported])
        
        XCTAssertEqual(importedCount, 1)
        XCTAssertEqual(store.transactions.map(\.clientName), ["Esistente", "Importato"])
    }
    
    func testReplaceAllWithImportedTransactionsPersistsReplacement() {
        let storageURL = temporaryDirectory.appendingPathComponent("transactions.json")
        let store = TransactionStore(fileURL: storageURL)
        store.add(Transaction(
            clientName: "Da sostituire",
            amount: 10,
            paymentMethod: .cash,
            type: .income,
            date: Date()
        ))
        
        let imported = Transaction(
            clientName: "Importato",
            amount: 20,
            paymentMethod: .wire,
            type: .expense,
            date: Date()
        )
        store.replaceAll(with: [imported])
        
        let reloadedStore = TransactionStore(fileURL: storageURL)
        XCTAssertEqual(reloadedStore.transactions.count, 1)
        XCTAssertEqual(reloadedStore.transactions.first?.clientName, "Importato")
        XCTAssertEqual(reloadedStore.transactions.first?.paymentMethod, .wire)
    }

    func testTransactionImportDecodesLegacyEnglishValuesAndISODate() throws {
        let json = """
        [
          {
            "id": "00000000-0000-0000-0000-000000000001",
            "clientName": "Legacy Client",
            "amount": 123.45,
            "paymentMethod": "cash",
            "type": "income",
            "date": "2026-07-06T14:30:00Z"
          },
          {
            "id": "00000000-0000-0000-0000-000000000002",
            "clientName": "Legacy Supplier",
            "note": "Materiale",
            "amount": 80,
            "paymentMethod": "wire",
            "type": "expense",
            "date": "2026-07-06"
          }
        ]
        """

        let transactions = try TransactionJSONCoding.makeDecoder()
            .decode([Transaction].self, from: try XCTUnwrap(json.data(using: .utf8)))

        XCTAssertEqual(transactions.map(\.clientName), ["Legacy Client", "Legacy Supplier"])
        XCTAssertEqual(transactions.map(\.paymentMethod), [.cash, .wire])
        XCTAssertEqual(transactions.map(\.type), [.income, .expense])
        XCTAssertEqual(transactions[1].note, "Materiale")
    }

    func testTransactionExportRoundTripsThroughImportDecoder() throws {
        let original = [
            Transaction(
                clientName: "Round Trip",
                patientId: "patient-1",
                patientMatchKind: "manual",
                note: "Nota",
                amount: 75,
                paymentMethod: .pos,
                type: .income,
                date: Date(timeIntervalSinceReferenceDate: 804_000_000)
            )
        ]

        let data = try TransactionJSONCoding.makeEncoder().encode(original)
        let decoded = try TransactionJSONCoding.makeDecoder().decode([Transaction].self, from: data)

        XCTAssertEqual(decoded.count, 1)
        XCTAssertEqual(decoded[0].clientName, "Round Trip")
        XCTAssertEqual(decoded[0].paymentMethod, .pos)
        XCTAssertEqual(decoded[0].type, .income)
        XCTAssertEqual(decoded[0].date.timeIntervalSinceReferenceDate, original[0].date.timeIntervalSinceReferenceDate, accuracy: 0.001)
    }

    private final class FakeCloudKitBackupService: CloudKitBackupServicing {
        let restoredTransactions: [Transaction]

        init(restoredTransactions: [Transaction]) {
            self.restoredTransactions = restoredTransactions
        }

        func saveBackup(transactions: [Transaction]) async throws {}

        func restoreBackup() async throws -> [Transaction] {
            restoredTransactions
        }
    }
}
