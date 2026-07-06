import SwiftUI

struct MonthDrillDownView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var store: TransactionStore
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if monthSummaries.isEmpty {
                        emptyState
                    } else {
                        ForEach(monthSummaries) { summary in
                            NavigationLink(value: summary) {
                                MonthSummaryRow(summary: summary)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)
                .padding(.bottom, 28)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Mesi")
            .navigationBarTitleDisplayMode(.large)
            .navigationDestination(for: MonthSummary.self) { summary in
                MonthDetailView(summary: summary)
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fine") {
                        dismiss()
                    }
                }
            }
        }
    }
    
    private var monthSummaries: [MonthSummary] {
        let calendar = Calendar.current
        let grouped = Dictionary(grouping: store.transactions) { transaction in
            calendar.dateInterval(of: .month, for: transaction.date)?.start ?? transaction.date
        }
        
        return grouped.map { monthStart, transactions in
            MonthSummary(monthStart: monthStart, transactions: transactions)
        }
        .sorted { $0.monthStart > $1.monthStart }
    }
    
    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "calendar")
                .font(.title2)
                .foregroundColor(.secondary)
            Text("Nessun mese disponibile")
                .font(.headline)
            Text("I mesi appariranno qui appena registri un movimento.")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
        .padding(.horizontal, 20)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    }
}

private struct MonthSummary: Identifiable, Hashable {
    let monthStart: Date
    let transactions: [Transaction]
    
    var id: TimeInterval { monthStart.timeIntervalSinceReferenceDate }
    
    static func == (lhs: MonthSummary, rhs: MonthSummary) -> Bool {
        lhs.monthStart == rhs.monthStart
    }
    
    func hash(into hasher: inout Hasher) {
        hasher.combine(monthStart)
    }
    
    var income: Double {
        transactions.filter { $0.type == .income }.reduce(0.0) { $0 + $1.amount }
    }
    
    var expense: Double {
        transactions.filter { $0.type == .expense }.reduce(0.0) { $0 + $1.amount }
    }
    
    var balance: Double {
        income - expense
    }
    
    var title: String {
        monthStart.formatted(.dateTime.month(.wide).year().locale(Locale(identifier: "it_IT")))
    }
}

private struct MonthSummaryRow: View {
    let summary: MonthSummary
    
    var body: some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 8) {
                Text(summary.title)
                    .font(.headline)
                    .textCase(.uppercase)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                
                HStack(spacing: 10) {
                    MonthPill(title: "Entrate", amount: summary.income, color: .green)
                    MonthPill(title: "Uscite", amount: summary.expense, color: .red)
                }
            }
            
            Spacer(minLength: 8)
            
            VStack(alignment: .trailing, spacing: 6) {
                Text(String(format: "€ %.2f", summary.balance))
                    .font(.headline.monospacedDigit())
                    .foregroundColor(summary.balance >= 0 ? .green : .red)
                    .lineLimit(1)
                    .minimumScaleFactor(0.65)
                
                HStack(spacing: 4) {
                    Text("\(summary.transactions.count)")
                    Image(systemName: "chevron.right")
                }
                .font(.caption)
                .foregroundColor(.secondary)
            }
        }
        .padding(16)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }
}

private struct MonthPill: View {
    let title: String
    let amount: Double
    let color: Color
    
    var body: some View {
        Text("\(title) \(String(format: "€ %.2f", amount))")
            .font(.caption2.monospacedDigit())
            .foregroundColor(color)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .padding(.horizontal, 8)
            .padding(.vertical, 5)
            .background(color.opacity(0.1), in: Capsule())
    }
}

private struct MonthDetailView: View {
    let summary: MonthSummary
    @AppStorage("showAmounts") private var showAmounts = true
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Saldo netto")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    Text(String(format: "€ %.2f", summary.balance))
                        .font(.system(.largeTitle, design: .rounded, weight: .bold))
                        .foregroundColor(summary.balance >= 0 ? .green : .red)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                    
                    HStack(spacing: 12) {
                        DetailMetric(title: "Entrate", amount: summary.income, color: .green)
                        DetailMetric(title: "Uscite", amount: summary.expense, color: .red)
                    }
                }
                .padding(18)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
                
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text("Movimenti")
                            .font(.headline)
                        Spacer()
                        Button(action: { showAmounts.toggle() }) {
                            Image(systemName: showAmounts ? "eye" : "eye.slash")
                                .font(.subheadline.weight(.semibold))
                                .foregroundColor(.secondary)
                                .frame(width: 32, height: 32)
                                .background(.thinMaterial, in: Circle())
                        }
                        .accessibilityLabel(showAmounts ? "Nascondi importi movimenti" : "Mostra importi movimenti")
                    }
                    
                    ForEach(summary.transactions.sorted(by: { $0.date > $1.date })) { transaction in
                        DrillDownTransactionRow(transaction: transaction, showAmounts: showAmounts)
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 12)
            .padding(.bottom, 28)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(summary.title)
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct DetailMetric: View {
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
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

private struct DrillDownTransactionRow: View {
    let transaction: Transaction
    let showAmounts: Bool
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: transaction.type == .income ? "plus" : "minus")
                .font(.caption.bold())
                .foregroundColor(transaction.type == .income ? .green : .red)
                .frame(width: 34, height: 34)
                .background((transaction.type == .income ? Color.green : Color.red).opacity(0.12), in: Circle())
            
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(transaction.clientName.isEmpty ? "Cliente generico" : transaction.clientName)
                        .font(.headline)
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                    
                    if transaction.isUnlinkedSorrisoClient {
                        Image(systemName: "person.crop.circle.badge.exclamationmark")
                            .font(.caption.bold())
                            .foregroundColor(Color(red: 0.63, green: 0.46, blue: 0.0))
                            .accessibilityLabel("Cliente non presente in Sorriso")
                    }
                }
                Text(transaction.date.formatted(date: .abbreviated, time: .shortened))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer(minLength: 8)
            
            VStack(alignment: .trailing, spacing: 4) {
                Text(showAmounts ? String(format: "%@€ %.2f", transaction.type == .income ? "+" : "-", transaction.amount) : "\(transaction.type == .income ? "+" : "-")••••")
                    .font(.headline.monospacedDigit())
                    .foregroundColor(transaction.type == .income ? .green : .red)
                    .lineLimit(1)
                    .minimumScaleFactor(0.65)
                Text(transaction.paymentMethod.rawValue)
                    .font(.caption)
                    .foregroundColor(.secondary)
                if transaction.patientId != nil {
                    Label("Paziente", systemImage: "link")
                        .font(.caption2)
                        .foregroundColor(.blue)
                }
            }
        }
        .padding(14)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}
