import SwiftUI

@MainActor
struct DailyPDFView: View {
    let date: Date
    let transactions: [Transaction]
    let totals: (income: Double, expense: Double)
    
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
                    Text(String(format: "+ € %.2f", totals.income))
                        .font(.title2)
                        .bold()
                        .foregroundColor(.green)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                
                VStack(alignment: .leading, spacing: 5) {
                    Text("USCITE TOTALI")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(String(format: "- € %.2f", totals.expense))
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
                    Text(String(format: "€ %.2f", saldo))
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
                            Text(tx.clientName.isEmpty ? "Generico" : tx.clientName)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            Text(tx.paymentMethod.rawValue)
                                .frame(width: 80, alignment: .leading)
                            Text(String(format: "%@ € %.2f", tx.type == .income ? "+" : "-", tx.amount))
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
}

@MainActor
struct MonthlyPDFView: View {
    let month: Date
    let transactions: [Transaction]
    
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
                    Text(String(format: "+ € %.2f", income)).foregroundColor(.green).bold()
                }
                HStack {
                    Text("Totale Uscite:")
                    Spacer()
                    Text(String(format: "- € %.2f", expense)).foregroundColor(.red).bold()
                }
                Divider()
                HStack {
                    Text("Saldo Netto:")
                        .bold()
                    Spacer()
                    Text(String(format: "€ %.2f", net))
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
                    Text(String(format: "€ %.2f", cashIncome)).frame(width: 120, alignment: .trailing)
                    Text(String(format: "€ %.2f", cashExpense)).frame(width: 120, alignment: .trailing)
                }
                Divider()
                HStack {
                    Text("POS").frame(maxWidth: .infinity, alignment: .leading)
                    Text(String(format: "€ %.2f", posIncome)).frame(width: 120, alignment: .trailing)
                    Text(String(format: "€ %.2f", posExpense)).frame(width: 120, alignment: .trailing)
                }
                Divider()
                HStack {
                    Text("Bonifico").frame(maxWidth: .infinity, alignment: .leading)
                    Text(String(format: "€ %.2f", wireIncome)).frame(width: 120, alignment: .trailing)
                    Text(String(format: "€ %.2f", wireExpense)).frame(width: 120, alignment: .trailing)
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
}

class PDFGenerator {
    @MainActor
    static func generateDailyPDF(date: Date, transactions: [Transaction], totals: (income: Double, expense: Double)) -> URL? {
        let pdfView = DailyPDFView(date: date, transactions: transactions, totals: totals)
        let renderer = ImageRenderer(content: pdfView)
        
        let fileManager = FileManager.default
        let documentDirectory = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first!
        
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let dateString = formatter.string(from: date)
        let fileName = "Resoconto_Giornaliero_\(dateString).pdf"
        let outputURL = documentDirectory.appendingPathComponent(fileName)
        
        renderer.render { size, context in
            var box = CGRect(x: 0, y: 0, width: 595, height: 842)
            guard let pdfContext = CGContext(outputURL as CFURL, mediaBox: &box, nil) else { return }
            
            pdfContext.beginPDFPage(nil)
            context(pdfContext)
            pdfContext.endPDFPage()
            pdfContext.closePDF()
        }
        
        return outputURL
    }
    
    @MainActor
    static func generateMonthlyPDF(month: Date, transactions: [Transaction]) -> URL? {
        let pdfView = MonthlyPDFView(month: month, transactions: transactions)
        let renderer = ImageRenderer(content: pdfView)
        
        let fileManager = FileManager.default
        let documentDirectory = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first!
        
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM"
        let dateString = formatter.string(from: month)
        let fileName = "Resoconto_Mensile_\(dateString).pdf"
        let outputURL = documentDirectory.appendingPathComponent(fileName)
        
        renderer.render { size, context in
            var box = CGRect(x: 0, y: 0, width: 595, height: 842)
            guard let pdfContext = CGContext(outputURL as CFURL, mediaBox: &box, nil) else { return }
            
            pdfContext.beginPDFPage(nil)
            context(pdfContext)
            pdfContext.endPDFPage()
            pdfContext.closePDF()
        }
        
        return outputURL
    }
}
