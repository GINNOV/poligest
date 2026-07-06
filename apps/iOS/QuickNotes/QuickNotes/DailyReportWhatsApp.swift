import Foundation

struct WhatsAppReportRecipient: Identifiable, Equatable {
    let id: String
    let name: String
    let phoneNumber: String

    var displayName: String {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmedName.isEmpty ? phoneNumber : trimmedName
    }
}

enum DailyReportWhatsApp {
    static func configuredRecipients(
        firstName: String,
        firstPhone: String,
        secondName: String,
        secondPhone: String
    ) -> [WhatsAppReportRecipient] {
        [
            WhatsAppReportRecipient(id: "primary", name: firstName, phoneNumber: firstPhone),
            WhatsAppReportRecipient(id: "secondary", name: secondName, phoneNumber: secondPhone),
        ]
        .filter { normalizedPhoneNumber($0.phoneNumber) != nil }
    }

    static func defaultMessage(date: Date) -> String {
        let formattedDate = date.formatted(.dateTime.day().month(.wide).year().locale(Locale(identifier: "it_IT")))
        return "Ciao, ti invio il resoconto giornaliero Sorriso Mobile del \(formattedDate)."
    }

    static func url(for recipient: WhatsAppReportRecipient, message: String) -> URL? {
        guard let phoneNumber = normalizedPhoneNumber(recipient.phoneNumber) else { return nil }

        var components = URLComponents()
        components.scheme = "https"
        components.host = "wa.me"
        components.path = "/\(phoneNumber)"
        components.queryItems = [
            URLQueryItem(name: "text", value: message),
        ]
        return components.url
    }

    private static func normalizedPhoneNumber(_ value: String) -> String? {
        var digits = value.filter(\.isNumber)

        if digits.hasPrefix("00") {
            digits.removeFirst(2)
        }

        if digits.count == 10, digits.hasPrefix("3") {
            digits = "39\(digits)"
        }

        return digits.count >= 8 ? digits : nil
    }
}
