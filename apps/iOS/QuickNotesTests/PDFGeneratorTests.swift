import XCTest
@testable import QuickNotes

final class PDFGeneratorTests: XCTestCase {
    @MainActor
    func testMonthlyPDFCreatesNonEmptyFile() throws {
        let transaction = Transaction(
            clientName: "Mario Rossi",
            patientId: "patient-1",
            patientMatchKind: "name",
            amount: 100,
            paymentMethod: .pos,
            type: .income,
            date: Date()
        )

        let url = try XCTUnwrap(PDFGenerator.generateMonthlyPDF(
            month: Date(),
            transactions: [transaction],
            showAmounts: true
        ))
        defer { try? FileManager.default.removeItem(at: url) }

        let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
        let fileSize = try XCTUnwrap(attributes[.size] as? NSNumber)
        XCTAssertGreaterThan(fileSize.intValue, 0)
    }

    @MainActor
    func testDailyPDFPaginatesLongTransactionList() throws {
        let transactions = (1...32).map { index in
            Transaction(
                clientName: "Cliente \(index)",
                note: "Prestazione \(index)",
                amount: Double(index) * 1_234.56,
                paymentMethod: index.isMultiple(of: 2) ? .pos : .wire,
                type: index.isMultiple(of: 3) ? .expense : .income,
                date: Date()
            )
        }
        let totals = (
            income: transactions.filter { $0.type == .income }.reduce(0) { $0 + $1.amount },
            expense: transactions.filter { $0.type == .expense }.reduce(0) { $0 + $1.amount }
        )

        let url = try XCTUnwrap(PDFGenerator.generateDailyPDF(
            date: Date(),
            transactions: transactions,
            totals: totals,
            showAmounts: true
        ))
        defer { try? FileManager.default.removeItem(at: url) }

        let pdfDocument = try XCTUnwrap(CGPDFDocument(url as CFURL))
        XCTAssertEqual(pdfDocument.numberOfPages, 4)
    }

    @MainActor
    func testDailyPDFTimeUsesFixedWidthTwentyFourHourFormat() throws {
        var components = DateComponents()
        components.calendar = Calendar(identifier: .gregorian)
        components.timeZone = TimeZone(secondsFromGMT: 0)
        components.year = 2026
        components.month = 7
        components.day = 6
        components.hour = 16
        components.minute = 36

        let date = try XCTUnwrap(components.date)

        let time = DailyPDFView.formattedTime(date)

        XCTAssertEqual(time.count, 5)
        XCTAssertEqual(time.dropFirst(2).first, ":")
        XCTAssertFalse(time.contains("AM"))
        XCTAssertFalse(time.contains("PM"))
    }
}
