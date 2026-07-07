import XCTest
@testable import QuickNotes

final class DailyReportWhatsAppTests: XCTestCase {
    func testDefaultMessageMentionsDailySorrisoMobileReportDate() {
        let message = DailyReportWhatsApp.message(
            template: DailyReportWhatsApp.defaultMessageTemplate,
            date: Date(timeIntervalSinceReferenceDate: 0)
        )

        XCTAssertTrue(message.contains("resoconto giornaliero Sorriso Mobile"))
        XCTAssertTrue(message.contains("2001"))
    }

    func testCustomMessageReplacesDatePlaceholder() {
        let message = DailyReportWhatsApp.message(
            template: "Report del {date} in allegato.",
            date: Date(timeIntervalSinceReferenceDate: 0)
        )

        XCTAssertTrue(message.hasPrefix("Report del"))
        XCTAssertTrue(message.hasSuffix("in allegato."))
        XCTAssertFalse(message.contains("{date}"))
    }

    func testBlankMessageFallsBackToDefaultTemplate() {
        let message = DailyReportWhatsApp.message(
            template: "   ",
            date: Date(timeIntervalSinceReferenceDate: 0)
        )

        XCTAssertTrue(message.contains("resoconto giornaliero Sorriso Mobile"))
    }
}
