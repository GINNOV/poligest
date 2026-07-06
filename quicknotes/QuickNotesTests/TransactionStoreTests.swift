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
}
