import Foundation

enum DailyReportWhatsApp {
    static let defaultMessageTemplate = "Ciao, ti invio il resoconto giornaliero Sorriso Mobile del {date}."

    static func message(template: String, date: Date) -> String {
        let formattedDate = date.formatted(.dateTime.day().month(.wide).year().locale(Locale(identifier: "it_IT")))
        let trimmedTemplate = template.trimmingCharacters(in: .whitespacesAndNewlines)
        let resolvedTemplate = trimmedTemplate.isEmpty ? defaultMessageTemplate : trimmedTemplate
        return resolvedTemplate.replacingOccurrences(of: "{date}", with: formattedDate)
    }
}
