import SwiftUI

@MainActor
struct DailyPDFView: View {
    let date: Date
    let transactions: [Transaction]
    let allTransactions: [Transaction]
    let totalTransactionCount: Int
    let totals: (income: Double, expense: Double)
    let showAmounts: Bool
    let pageNumber: Int
    let pageCount: Int
    private let timeColumnWidth: CGFloat = 72
    
    var body: some View {
        VStack(alignment: .leading, spacing: 15) {
            // Header
            HStack {
                Text("RESOCONTO GIORNALIERO")
                    .font(.title)
                    .bold()
                Spacer()
                Text(date.formatted(date: .long, time: .omitted))
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            .padding(.bottom, 20)
            
            // Totals Card
            HStack {
                VStack(alignment: .leading, spacing: 5) {
                    Text("ENTRATE TOTALI")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(formatAmount(totals.income, prefix: "+ "))
                        .font(.title2)
                        .bold()
                        .foregroundColor(.green)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                
                VStack(alignment: .leading, spacing: 5) {
                    Text("USCITE TOTALI")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(formatAmount(totals.expense, prefix: "- "))
                        .font(.title2)
                        .bold()
                        .foregroundColor(.red)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                
                VStack(alignment: .leading, spacing: 5) {
                    Text("SALDO GIORNALIERO")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    let saldo = totals.income - totals.expense
                    Text(formatAmount(saldo))
                        .font(.title2)
                        .bold()
                        .foregroundColor(saldo >= 0 ? .green : .red)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding()
            .background(Color(.systemGray6))
            .cornerRadius(10)
            .padding(.bottom, 20)
            
            // Table Header
            Text("DETTAGLIO MOVIMENTI")
                .font(.headline)
            
            Divider()
            
            // Transactions List
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Ora")
                        .bold()
                        .frame(width: timeColumnWidth, alignment: .leading)
                    Text("Cliente / Descrizione")
                        .bold()
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text("Metodo")
                        .bold()
                        .frame(width: 74, alignment: .leading)
                    Text("Importo")
                        .bold()
                        .frame(width: 120, alignment: .trailing)
                }
                .font(.footnote)
                .foregroundColor(.secondary)
                
                Divider()
                
                if transactions.isEmpty {
                    Text("Nessun movimento registrato oggi.")
                        .italic()
                        .foregroundColor(.secondary)
                        .padding(.vertical, 10)
                } else {
                    ForEach(transactions) { tx in
                        HStack {
                            Text(Self.formattedTime(tx.date))
                                .font(.system(size: 15, weight: .regular, design: .monospaced))
                                .lineLimit(1)
                                .minimumScaleFactor(0.9)
                                .frame(width: timeColumnWidth, alignment: .leading)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(tx.clientName.isEmpty ? "Generico" : tx.clientName)
                                if let note = tx.displayNote {
                                    Text(note)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            Text(tx.paymentMethod.rawValue)
                                .frame(width: 74, alignment: .leading)
                            Text(formatAmount(tx.amount, prefix: tx.type == .income ? "+ " : "- "))
                                .font(.system(.body, design: .monospaced))
                                .foregroundColor(tx.type == .income ? .green : .red)
                                .lineLimit(1)
                                .minimumScaleFactor(0.72)
                                .frame(width: 120, alignment: .trailing)
                        }
                        .font(.body)
                        Divider()
                    }
                }
            }
            
            Spacer()

            if pageNumber == pageCount {
                PaymentMethodBreakdownView(transactions: allTransactions, showAmounts: showAmounts)
            }
            
            // Footer
            HStack {
                Text("Pagina \(pageNumber) di \(pageCount) • \(totalTransactionCount) movimenti")
                    .font(.caption)
                    .foregroundColor(.secondary)
                Spacer()
                Text("Generato da Sorriso Mobile")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(40)
        .frame(width: 595, height: 842) // A4 size at 72 dpi
        .background(Color.white)
    }
    
    private func formatAmount(_ value: Double, prefix: String = "") -> String {
        EuroAmountFormatter.string(value, showAmounts: showAmounts, sign: prefix.trimmingCharacters(in: .whitespaces))
    }

    static func formattedTime(_ date: Date) -> String {
        dailyTimeFormatter.string(from: date)
    }

    private static let dailyTimeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "it_IT")
        formatter.dateFormat = "HH:mm"
        return formatter
    }()
}

@MainActor
struct MonthlyPDFView: View {
    let month: Date
    let transactions: [Transaction]
    let showAmounts: Bool
    
    var body: some View {
        VStack(alignment: .leading, spacing: 15) {
            // Header
            HStack {
                Text("RESOCONTO MENSILE")
                    .font(.title)
                    .bold()
                Spacer()
                let dateString = month.formatted(.dateTime.year().month(.wide).locale(Locale(identifier: "it_IT")))
                Text(dateString.uppercased())
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            .padding(.bottom, 20)
            
            // Calculate totals
            let income = transactions.filter { $0.type == .income }.reduce(0.0) { $0 + $1.amount }
            let expense = transactions.filter { $0.type == .expense }.reduce(0.0) { $0 + $1.amount }
            let net = income - expense
            
            // Totals Card
            VStack(spacing: 12) {
                HStack {
                    Text("Totale Entrate:")
                    Spacer()
                    Text(formatAmount(income, prefix: "+ ")).foregroundColor(.green).bold()
                }
                HStack {
                    Text("Totale Uscite:")
                    Spacer()
                    Text(formatAmount(expense, prefix: "- ")).foregroundColor(.red).bold()
                }
                Divider()
                HStack {
                    Text("Saldo Netto:")
                        .bold()
                    Spacer()
                    Text(formatAmount(net))
                        .foregroundColor(net >= 0 ? .green : .red)
                        .bold()
                }
            }
            .font(.headline)
            .padding()
            .background(Color(.systemGray6))
            .cornerRadius(10)
            .padding(.bottom, 20)
            
            Text("Resoconto generale basato su un totale di \(transactions.count) transazioni registrate nel mese corrente.")
                .font(.body)
                .italic()
                .padding(.top, 10)
            
            Spacer()

            PaymentMethodBreakdownView(transactions: transactions, showAmounts: showAmounts)
            
            // Footer
            HStack {
                Spacer()
                Text("Generato da Sorriso Mobile")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(40)
        .frame(width: 595, height: 842)
        .background(Color.white)
    }
    
    private func formatAmount(_ value: Double, prefix: String = "") -> String {
        EuroAmountFormatter.string(value, showAmounts: showAmounts, sign: prefix.trimmingCharacters(in: .whitespaces))
    }
}

@MainActor
private struct PaymentMethodBreakdownView: View {
    let transactions: [Transaction]
    let showAmounts: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("TOTALI PER METODO DI PAGAMENTO")
                .font(.headline)

            VStack(spacing: 7) {
                HStack {
                    Text("Metodo")
                        .bold()
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text("Entrate")
                        .bold()
                        .foregroundColor(.green)
                        .frame(width: 124, alignment: .trailing)
                    Text("Uscite")
                        .bold()
                        .foregroundColor(.red)
                        .frame(width: 124, alignment: .trailing)
                }
                .font(.footnote)
                .foregroundColor(.secondary)

                Divider()

                ForEach(PaymentMethod.allCases) { paymentMethod in
                    let totals = totals(for: paymentMethod)
                    HStack {
                        Text(paymentMethod.rawValue)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Text(formatAmount(totals.income))
                            .font(.system(.body, design: .monospaced))
                            .frame(width: 124, alignment: .trailing)
                        Text(formatAmount(totals.expense))
                            .font(.system(.body, design: .monospaced))
                            .frame(width: 124, alignment: .trailing)
                    }
                    .font(.body)
                }
            }
        }
        .padding(12)
        .background(Color(.systemGray6))
        .cornerRadius(10)
    }

    private func totals(for paymentMethod: PaymentMethod) -> (income: Double, expense: Double) {
        let matchingTransactions = transactions.filter { $0.paymentMethod == paymentMethod }
        let income = matchingTransactions.filter { $0.type == .income }.reduce(0.0) { $0 + $1.amount }
        let expense = matchingTransactions.filter { $0.type == .expense }.reduce(0.0) { $0 + $1.amount }
        return (income, expense)
    }

    private func formatAmount(_ value: Double) -> String {
        EuroAmountFormatter.string(value, showAmounts: showAmounts)
    }
}

class PDFGenerator {
    private static let pageSize = CGSize(width: 595, height: 842)
    private static let dailyTransactionsPerPage = 10

    @MainActor
    static func generateDailyPDF(date: Date, transactions: [Transaction], totals: (income: Double, expense: Double), showAmounts: Bool) -> URL? {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let dateString = formatter.string(from: date)

        let pages = dailyPDFPages(
            date: date,
            transactions: transactions,
            totals: totals,
            showAmounts: showAmounts
        )
        return renderPDF(pages: pages, fileName: "Resoconto_Giornaliero_\(dateString).pdf")
    }
    
    @MainActor
    static func generateMonthlyPDF(month: Date, transactions: [Transaction], showAmounts: Bool) -> URL? {
        let pdfView = MonthlyPDFView(month: month, transactions: transactions, showAmounts: showAmounts)

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM"
        let dateString = formatter.string(from: month)

        return renderPDF(content: pdfView, fileName: "Resoconto_Mensile_\(dateString).pdf")
    }

    @MainActor
    private static func dailyPDFPages(date: Date, transactions: [Transaction], totals: (income: Double, expense: Double), showAmounts: Bool) -> [DailyPDFView] {
        let transactionPages = transactions.isEmpty ? [[]] : transactions.chunked(into: dailyTransactionsPerPage)
        let pageCount = transactionPages.count

        return transactionPages.enumerated().map { index, pageTransactions in
            DailyPDFView(
                date: date,
                transactions: pageTransactions,
                allTransactions: transactions,
                totalTransactionCount: transactions.count,
                totals: totals,
                showAmounts: showAmounts,
                pageNumber: index + 1,
                pageCount: pageCount
            )
        }
    }

    @MainActor
    private static func renderPDF<Content: View>(content: Content, fileName: String) -> URL? {
        renderPDF(pages: [content], fileName: fileName)
    }

    @MainActor
    private static func renderPDF<Content: View>(pages: [Content], fileName: String) -> URL? {
        let pageRect = CGRect(origin: .zero, size: pageSize)

        let fileManager = FileManager.default
        guard let documentDirectory = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first else {
            return nil
        }

        let outputURL = documentDirectory.appendingPathComponent(fileName)

        do {
            if fileManager.fileExists(atPath: outputURL.path) {
                try fileManager.removeItem(at: outputURL)
            }

            var mediaBox = pageRect
            guard let pdfContext = CGContext(outputURL as CFURL, mediaBox: &mediaBox, nil) else {
                return nil
            }

            for page in pages {
                let renderer = ImageRenderer(content: page)
                renderer.proposedSize = ProposedViewSize(width: pageRect.width, height: pageRect.height)
                pdfContext.beginPDFPage(nil)
                renderer.render { _, renderContent in
                    renderContent(pdfContext)
                }
                pdfContext.endPDFPage()
            }

            pdfContext.closePDF()

            let attributes = try fileManager.attributesOfItem(atPath: outputURL.path)
            guard let fileSize = attributes[.size] as? NSNumber, fileSize.intValue > 0 else {
                return nil
            }

            return outputURL
        } catch {
            print("Error generating PDF: \(error)")
            return nil
        }
    }
}

private extension Array {
    func chunked(into size: Int) -> [[Element]] {
        guard size > 0 else { return [self] }

        return stride(from: 0, to: count, by: size).map { startIndex in
            Array(self[startIndex..<Swift.min(startIndex + size, count)])
        }
    }
}
