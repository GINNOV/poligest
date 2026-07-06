import XCTest
@testable import QuickNotes

final class DailyReportWhatsAppTests: XCTestCase {
    func testConfiguredRecipientsKeepsOnlyValidPhoneNumbers() {
        let recipients = DailyReportWhatsApp.configuredRecipients(
            firstName: "Mario",
            firstPhone: "333 123 4567",
            secondName: "Studio",
            secondPhone: "abc"
        )

        XCTAssertEqual(recipients, [
            WhatsAppReportRecipient(id: "primary", name: "Mario", phoneNumber: "333 123 4567"),
        ])
    }

    func testWhatsAppURLNormalizesItalianMobileAndPrefillsMessage() throws {
        let recipient = WhatsAppReportRecipient(id: "primary", name: "Mario", phoneNumber: "333 123 4567")
        let url = try XCTUnwrap(DailyReportWhatsApp.url(for: recipient, message: "Ciao report"))

        XCTAssertEqual(url.host, "wa.me")
        XCTAssertEqual(url.path, "/393331234567")
        XCTAssertTrue(url.absoluteString.contains("Ciao%20report"))
    }

    func testDefaultMessageMentionsDailySorrisoMobileReportDate() {
        let message = DailyReportWhatsApp.defaultMessage(date: Date(timeIntervalSinceReferenceDate: 0))

        XCTAssertTrue(message.contains("resoconto giornaliero Sorriso Mobile"))
        XCTAssertTrue(message.contains("2001"))
    }
}
