import SwiftUI

struct ContentView: View {
    @StateObject private var store = TransactionStore()
    @ObservedObject var authenticator: BiometricAuthenticator
    @AppStorage("showAmounts") private var showAmounts = true
    @AppStorage("icloudBackupEnabled") private var iCloudBackupEnabled = true
    
    @State private var showingForm = false
    @State private var formType: TransactionType = .income
    @State private var showingMonthlyReports = false
    @State private var showingMonthDrillDown = false
    @State private var showingSettings = false
    @State private var transactionPendingDeletion: Transaction?
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    headerSummary
                    actionStrip
                    recentTransactions
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)
                .padding(.bottom, 28)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Jack il contabile")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItemGroup(placement: .topBarLeading) {
                    Button(action: { showingSettings = true }) {
                        Image(systemName: "gearshape")
                    }
                    .accessibilityLabel("Impostazioni")
                    
                    Button(action: { showingMonthDrillDown = true }) {
                        Label("Mesi", systemImage: "calendar.day.timeline.left")
                    }
                    
                    Button(action: { showingMonthlyReports = true }) {
                        Label("Resoconti", systemImage: "calendar")
                    }
                }
                
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: { authenticator.logOut() }) {
                        Image(systemName: "lock.fill")
                    }
                    .accessibilityLabel("Blocca")
                }
            }
        }
        .sheet(isPresented: $showingForm) {
            TransactionFormView(store: store, type: formType)
                .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $showingMonthlyReports) {
            MonthlyReportsView(store: store)
        }
        .sheet(isPresented: $showingMonthDrillDown) {
            MonthDrillDownView(store: store)
        }
        .sheet(isPresented: $showingSettings) {
            SettingsView(store: store)
        }
        .alert("Eliminare questo movimento?", isPresented: deleteConfirmationIsPresented) {
            Button("Annulla", role: .cancel) {
                transactionPendingDeletion = nil
            }
            Button("Elimina", role: .destructive) {
                confirmDeleteTransaction()
            }
        } message: {
            Text("Questa operazione rimuoverà definitivamente il movimento da QuickNotes.")
        }
    }
    
    private var headerSummary: some View {
        let totals = store.totals(for: Date())
        let balance = totals.income - totals.expense
        
        return VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(Date().formatted(.dateTime.weekday(.wide).day().month(.wide).locale(Locale(identifier: "it_IT"))))
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .textCase(.uppercase)
                    Text(String(format: "€ %.2f", balance))
                        .font(.system(.largeTitle, design: .rounded, weight: .bold))
                        .foregroundColor(balance >= 0 ? .green : .red)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                }
                
                Spacer()
                
                Image(systemName: balance >= 0 ? "chart.line.uptrend.xyaxis" : "chart.line.downtrend.xyaxis")
                    .font(.title2)
                    .foregroundColor(balance >= 0 ? .green : .red)
                    .frame(width: 44, height: 44)
                    .background(.thinMaterial, in: Circle())
            }
            
            HStack(spacing: 12) {
                MetricTile(title: "Entrate", amount: totals.income, color: .green, symbol: "arrow.down.left")
                MetricTile(title: "Uscite", amount: totals.expense, color: .red, symbol: "arrow.up.right")
            }
        }
        .padding(18)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(Color.primary.opacity(0.06), lineWidth: 1)
        )
    }
    
    private var actionStrip: some View {
        let todayTransactions = transactionsForToday
        let totals = store.totals(for: Date())
        
        return VStack(spacing: 12) {
            HStack(spacing: 12) {
                QuickActionButton(title: "Entrata", symbol: "plus", color: .green) {
                    formType = .income
                    showingForm = true
                }
                
                QuickActionButton(title: "Uscita", symbol: "minus", color: .red) {
                    formType = .expense
                    showingForm = true
                }
            }
            
            Button(action: {
                if let url = PDFGenerator.generateDailyPDF(date: Date(), transactions: todayTransactions, totals: totals, showAmounts: true) {
                    shareFile(url: url)
                }
            }) {
                Label("Rapporto Giornaliero", systemImage: "doc.text")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            }
            .buttonStyle(.plain)
            .foregroundColor(todayTransactions.isEmpty ? .secondary : .blue)
            .disabled(todayTransactions.isEmpty)
        }
    }
    
    private var recentTransactions: some View {
        let todayTransactions = transactionsForToday.sorted(by: { $0.date > $1.date })
        
        return VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Movimenti di oggi")
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
                
                Text("\(todayTransactions.count)")
                    .font(.caption)
                    .bold()
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(.thinMaterial, in: Capsule())
            }
            
            if todayTransactions.isEmpty {
                EmptyTransactionsView()
            } else {
                LazyVStack(spacing: 10) {
                    ForEach(todayTransactions) { tx in
                        TransactionRow(transaction: tx, showAmounts: showAmounts) {
                            transactionPendingDeletion = tx
                        }
                    }
                }
            }
        }
    }
    
    private var transactionsForToday: [Transaction] {
        let calendar = Calendar.current
        return store.transactions.filter { calendar.isDateInToday($0.date) }
    }
    
    private var deleteConfirmationIsPresented: Binding<Bool> {
        Binding {
            transactionPendingDeletion != nil
        } set: { isPresented in
            if !isPresented {
                transactionPendingDeletion = nil
            }
        }
    }
    
    private func confirmDeleteTransaction() {
        guard let transactionPendingDeletion else { return }
        deleteTransaction(transactionPendingDeletion)
        self.transactionPendingDeletion = nil
    }
    
    private func deleteTransaction(_ tx: Transaction) {
        if let storeIndex = store.transactions.firstIndex(where: { $0.id == tx.id }) {
            store.transactions.remove(at: storeIndex)
        }
    }
    
    private func shareFile(url: URL) {
        FileSharePresenter.present(url)
    }
}

private struct MetricTile: View {
    let title: String
    let amount: Double
    let color: Color
    let symbol: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: symbol)
                .font(.caption.bold())
                .foregroundColor(color)
                .frame(width: 28, height: 28)
                .background(color.opacity(0.14), in: Circle())
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.caption)
                    .foregroundColor(.secondary)
                Text(String(format: "€ %.2f", amount))
                    .font(.headline)
                    .lineLimit(1)
                    .minimumScaleFactor(0.65)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

private struct QuickActionButton: View {
    let title: String
    let symbol: String
    let color: Color
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Image(systemName: symbol)
                    .font(.headline.bold())
                    .frame(width: 30, height: 30)
                    .background(Color.white.opacity(0.22), in: Circle())
                Text(title)
                    .font(.headline)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 15)
            .foregroundColor(.white)
            .background(color, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

private struct TransactionRow: View {
    let transaction: Transaction
    let showAmounts: Bool
    let onDelete: () -> Void
    
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
                HStack(spacing: 6) {
                    Text(transaction.date.formatted(date: .omitted, time: .shortened))
                    Text(transaction.paymentMethod.rawValue)
                    if transaction.patientId != nil {
                        Label("Paziente", systemImage: "link")
                            .labelStyle(.titleAndIcon)
                    }
                }
                .font(.caption)
                .foregroundColor(.secondary)
            }
            
            Spacer(minLength: 8)
            
            Text(showAmounts ? String(format: "%@€ %.2f", transaction.type == .income ? "+" : "-", transaction.amount) : "\(transaction.type == .income ? "+" : "-")••••")
                .font(.headline.monospacedDigit())
                .foregroundColor(transaction.type == .income ? .green : .red)
                .lineLimit(1)
                .minimumScaleFactor(0.65)
            
            Button(action: onDelete) {
                Image(systemName: "trash")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .frame(width: 32, height: 32)
                    .background(.thinMaterial, in: Circle())
            }
            .accessibilityLabel("Elimina movimento")
        }
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}

private struct EmptyTransactionsView: View {
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "tray")
                .font(.title2)
                .foregroundColor(.secondary)
            Text("Nessun movimento oggi")
                .font(.headline)
            Text("Aggiungi un'entrata o un'uscita dal pulsante in basso.")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 34)
        .padding(.horizontal, 20)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}
