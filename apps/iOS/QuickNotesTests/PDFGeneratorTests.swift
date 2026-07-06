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
}
