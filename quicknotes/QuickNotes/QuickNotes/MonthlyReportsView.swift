import SwiftUI

struct MonthlyReportsView: View {
    @Environment(\.dismiss) var dismiss
    @ObservedObject var store: TransactionStore
    
    @State private var selectedMonth = Date()
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    monthSelector
                    summaryCard
                    transactionSection
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)
                .padding(.bottom, 96)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Resoconto")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fine") {
                        dismiss()
                    }
                }
            }
            .safeAreaInset(edge: .bottom) {
                pdfBar
            }
        }
    }
    
    private var monthSelector: some View {
        HStack(spacing: 14) {
            Button(action: { changeMonth(by: -1) }) {
                Image(systemName: "chevron.left")
                    .frame(width: 38, height: 38)
            }
            .buttonStyle(.plain)
            .background(.thinMaterial, in: Circle())
            
            VStack(spacing: 2) {
                Text(selectedMonth.formatted(.dateTime.month(.wide).locale(Locale(identifier: "it_IT"))))
                    .font(.title2.bold())
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                Text(selectedMonth.formatted(.dateTime.year()))
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity)
            
            Button(action: { changeMonth(by: 1) }) {
                Image(systemName: "chevron.right")
                    .frame(width: 38, height: 38)
            }
            .buttonStyle(.plain)
            .background(.thinMaterial, in: Circle())
        }
        .padding(14)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    }
    
    private var summaryCard: some View {
        let filteredTxs = transactionsForSelectedMonth
        let income = filteredTxs.filter { $0.type == .income }.reduce(0.0) { $0 + $1.amount }
        let expense = filteredTxs.filter { $0.type == .expense }.reduce(0.0) { $0 + $1.amount }
        let total = income - expense
        
        return VStack(alignment: .leading, spacing: 18) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Saldo netto")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    Text(String(format: "€ %.2f", total))
                        .font(.system(.largeTitle, design: .rounded, weight: .bold))
                        .foregroundColor(total >= 0 ? .green : .red)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                }
                Spacer()
                Image(systemName: "chart.pie.fill")
                    .font(.title2)
                    .foregroundColor(.blue)
                    .frame(width: 44, height: 44)
                    .background(Color.blue.opacity(0.12), in: Circle())
            }
            
            HStack(spacing: 12) {
                MonthlyMetric(title: "Entrate", amount: income, color: .green)
                MonthlyMetric(title: "Uscite", amount: expense, color: .red)
            }
        }
        .padding(18)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    }
    
    private var transactionSection: some View {
        let filteredTxs = transactionsForSelectedMonth.sorted(by: { $0.date > $1.date })
        
        return VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Movimenti")
                    .font(.headline)
                Spacer()
                Text("\(filteredTxs.count)")
                    .font(.caption.bold())
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(.thinMaterial, in: Capsule())
            }
            
            if filteredTxs.isEmpty {
                Text("Nessuna transazione in questo mese.")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 32)
                    .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            } else {
                LazyVStack(spacing: 10) {
                    ForEach(filteredTxs) { tx in
                        MonthlyTransactionRow(transaction: tx)
                    }
                }
            }
        }
    }
    
    private var pdfBar: some View {
        let filteredTxs = transactionsForSelectedMonth
        
        return Button(action: {
            if let url = PDFGenerator.generateMonthlyPDF(month: selectedMonth, transactions: filteredTxs) {
                shareFile(url: url)
            }
        }) {
            Label("Genera PDF mensile", systemImage: "doc.text")
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(MonthlyPDFButtonStyle(isEnabled: !filteredTxs.isEmpty))
        .disabled(filteredTxs.isEmpty)
        .padding(.horizontal, 20)
        .padding(.top, 12)
        .padding(.bottom, 8)
        .background(.bar)
    }
    
    private var transactionsForSelectedMonth: [Transaction] {
        let calendar = Calendar.current
        return store.transactions.filter {
            calendar.isDate($0.date, equalTo: selectedMonth, toGranularity: .month) &&
            calendar.isDate($0.date, equalTo: selectedMonth, toGranularity: .year)
        }
    }
    
    private func changeMonth(by value: Int) {
        if let newDate = Calendar.current.date(byAdding: .month, value: value, to: selectedMonth) {
            selectedMonth = newDate
        }
    }
    
    private func shareFile(url: URL) {
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootViewController = windowScene.windows.first?.rootViewController else { return }
        
        let activityViewController = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        
        if let popoverController = activityViewController.popoverPresentationController {
            popoverController.sourceView = rootViewController.view
            popoverController.sourceRect = CGRect(x: rootViewController.view.bounds.midX, y: rootViewController.view.bounds.midY, width: 0, height: 0)
            popoverController.permittedArrowDirections = []
        }
        
        rootViewController.present(activityViewController, animated: true, completion: nil)
    }
}

private struct MonthlyMetric: View {
    let title: String
    let amount: Double
    let color: Color
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
            Text(String(format: "€ %.2f", amount))
                .font(.headline.monospacedDigit())
                .foregroundColor(color)
                .lineLimit(1)
                .minimumScaleFactor(0.65)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(color.opacity(0.1), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

private struct MonthlyTransactionRow: View {
    let transaction: Transaction
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: transaction.paymentMethod.iconName)
                .font(.subheadline)
                .foregroundColor(.blue)
                .frame(width: 34, height: 34)
                .background(Color.blue.opacity(0.12), in: Circle())
            
            VStack(alignment: .leading, spacing: 4) {
                Text(transaction.clientName.isEmpty ? "Generico" : transaction.clientName)
                    .font(.headline)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                Text(transaction.date.formatted(date: .abbreviated, time: .omitted))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer(minLength: 8)
            
            VStack(alignment: .trailing, spacing: 4) {
                Text(String(format: "%@€ %.2f", transaction.type == .income ? "+" : "-", transaction.amount))
                    .font(.headline.monospacedDigit())
                    .foregroundColor(transaction.type == .income ? .green : .red)
                    .lineLimit(1)
                    .minimumScaleFactor(0.65)
                Text(transaction.paymentMethod.rawValue)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(14)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}

private struct MonthlyPDFButtonStyle: ButtonStyle {
    let isEnabled: Bool
    
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundColor(.white)
            .padding(.vertical, 16)
            .background((isEnabled ? Color.blue : Color.gray).opacity(configuration.isPressed ? 0.78 : 1), in: Capsule())
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
    }
}
