import SwiftUI

@MainActor
struct DailyPDFView: View {
    let date: Date
    let transactions: [Transaction]
    let totals: (income: Double, expense: Double)
    let showAmounts: Bool
    
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
                        .frame(width: 50, alignment: .leading)
                    Text("Cliente / Descrizione")
                        .bold()
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text("Metodo")
                        .bold()
                        .frame(width: 80, alignment: .leading)
                    Text("Importo")
                        .bold()
                        .frame(width: 80, alignment: .trailing)
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
                            Text(tx.date.formatted(date: .omitted, time: .shortened))
                                .frame(width: 50, alignment: .leading)
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
                                .frame(width: 80, alignment: .leading)
                            Text(formatAmount(tx.amount, prefix: tx.type == .income ? "+ " : "- "))
                                .foregroundColor(tx.type == .income ? .green : .red)
                                .frame(width: 80, alignment: .trailing)
                        }
                        .font(.body)
                        Divider()
                    }
                }
            }
            
            Spacer()
            
            // Footer
            HStack {
                Spacer()
                Text("Generato da QuickNotes")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(40)
        .frame(width: 595, height: 842) // A4 size at 72 dpi
        .background(Color.white)
    }
    
    private func formatAmount(_ value: Double, prefix: String = "") -> String {
        showAmounts ? String(format: "%@€ %.2f", prefix, value) : "\(prefix)••••"
    }
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
            
            // Payment method breakdown
            Text("METODI DI PAGAMENTO")
                .font(.headline)
            Divider()
            
            let cashIncome = transactions.filter { $0.type == .income && $0.paymentMethod == .cash }.reduce(0.0) { $0 + $1.amount }
            let posIncome = transactions.filter { $0.type == .income && $0.paymentMethod == .pos }.reduce(0.0) { $0 + $1.amount }
            let wireIncome = transactions.filter { $0.type == .income && $0.paymentMethod == .wire }.reduce(0.0) { $0 + $1.amount }
            
            let cashExpense = transactions.filter { $0.type == .expense && $0.paymentMethod == .cash }.reduce(0.0) { $0 + $1.amount }
            let posExpense = transactions.filter { $0.type == .expense && $0.paymentMethod == .pos }.reduce(0.0) { $0 + $1.amount }
            let wireExpense = transactions.filter { $0.type == .expense && $0.paymentMethod == .wire }.reduce(0.0) { $0 + $1.amount }
            
            VStack(spacing: 10) {
                HStack {
                    Text("Metodo").bold().frame(maxWidth: .infinity, alignment: .leading)
                    Text("Entrate").bold().foregroundColor(.green).frame(width: 120, alignment: .trailing)
                    Text("Uscite").bold().foregroundColor(.red).frame(width: 120, alignment: .trailing)
                }
                .font(.footnote)
                .foregroundColor(.secondary)
                Divider()
                
                HStack {
                    Text("Contanti").frame(maxWidth: .infinity, alignment: .leading)
                    Text(formatAmount(cashIncome)).frame(width: 120, alignment: .trailing)
                    Text(formatAmount(cashExpense)).frame(width: 120, alignment: .trailing)
                }
                Divider()
                HStack {
                    Text("POS").frame(maxWidth: .infinity, alignment: .leading)
                    Text(formatAmount(posIncome)).frame(width: 120, alignment: .trailing)
                    Text(formatAmount(posExpense)).frame(width: 120, alignment: .trailing)
                }
                Divider()
                HStack {
                    Text("Bonifico").frame(maxWidth: .infinity, alignment: .leading)
                    Text(formatAmount(wireIncome)).frame(width: 120, alignment: .trailing)
                    Text(formatAmount(wireExpense)).frame(width: 120, alignment: .trailing)
                }
            }
            .padding(.bottom, 20)
            
            Text("Resoconto generale basato su un totale di \(transactions.count) transazioni registrate nel mese corrente.")
                .font(.body)
                .italic()
                .padding(.top, 10)
            
            Spacer()
            
            // Footer
            HStack {
                Spacer()
                Text("Generato da QuickNotes")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(40)
        .frame(width: 595, height: 842)
        .background(Color.white)
    }
    
    private func formatAmount(_ value: Double, prefix: String = "") -> String {
        showAmounts ? String(format: "%@€ %.2f", prefix, value) : "\(prefix)••••"
    }
}

class PDFGenerator {
    @MainActor
    static func generateDailyPDF(date: Date, transactions: [Transaction], totals: (income: Double, expense: Double), showAmounts: Bool) -> URL? {
        let pdfView = DailyPDFView(date: date, transactions: transactions, totals: totals, showAmounts: showAmounts)

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let dateString = formatter.string(from: date)

        return renderPDF(content: pdfView, fileName: "Resoconto_Giornaliero_\(dateString).pdf")
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
    private static func renderPDF<Content: View>(content: Content, fileName: String) -> URL? {
        let pageRect = CGRect(x: 0, y: 0, width: 595, height: 842)
        let renderer = ImageRenderer(content: content)
        renderer.proposedSize = ProposedViewSize(width: pageRect.width, height: pageRect.height)

        let fileManager = FileManager.default
        guard let documentDirectory = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first else {
            return nil
        }

        let outputURL = documentDirectory.appendingPathComponent(fileName)

        do {
            if fileManager.fileExists(atPath: outputURL.path) {
                try fileManager.removeItem(at: outputURL)
            }

            var didRenderPage = false
            renderer.render { _, renderContent in
                var mediaBox = pageRect
                guard let pdfContext = CGContext(outputURL as CFURL, mediaBox: &mediaBox, nil) else {
                    return
                }

                pdfContext.beginPDFPage(nil)
                renderContent(pdfContext)
                pdfContext.endPDFPage()
                pdfContext.closePDF()
                didRenderPage = true
            }

            guard didRenderPage else {
                return nil
            }

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
