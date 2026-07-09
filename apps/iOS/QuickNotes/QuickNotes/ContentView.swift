import SwiftUI

struct ContentView: View {
    @StateObject private var store = TransactionStore()
    @ObservedObject var authenticator: BiometricAuthenticator
    @AppStorage("showAmounts") private var showAmounts = true
    @AppStorage("icloudBackupEnabled") private var iCloudBackupEnabled = true
    @AppStorage("showMesiShortcut") private var showMesiShortcut = true
    @AppStorage("showMonthlyReportShortcut") private var showMonthlyReportShortcut = true
    
    @State private var formRoute: TransactionFormRoute?
    @State private var showingMonthlyReports = false
    @State private var showingMonthDrillDown = false
    @State private var showingSettings = false
    @State private var showingSyncStatus = false
    @State private var reportShareAlert: ReportShareAlert?
    @State private var transactionPendingDeletion: Transaction?
    
    var body: some View {
        NavigationStack {
            List {
                headerSummary
                    .listRowStyle()
                actionStrip
                    .listRowStyle()
                recentTransactions
            }
            .listStyle(.plain)
            .environment(\.defaultMinListRowHeight, 1)
            .scrollContentBackground(.hidden)
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Jack il contabile")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItemGroup(placement: .topBarLeading) {
                    Button(action: { showingSettings = true }) {
                        Image(systemName: "gearshape")
                    }
                    .accessibilityLabel("Impostazioni")
                    
                    if showMesiShortcut {
                        Button(action: { showingMonthDrillDown = true }) {
                            Label("Mesi", systemImage: "calendar.day.timeline.left")
                        }
                    }
                    
                    if showMonthlyReportShortcut {
                        Button(action: { showingMonthlyReports = true }) {
                            Label("Resoconti", systemImage: "calendar")
                        }
                    }
                }
                
                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: 12) {
                        if pendingSyncCount > 0 {
                            Button(action: { showingSyncStatus = true }) {
                                Image(systemName: "arrow.triangle.2.circlepath")
                                    .overlay(alignment: .topTrailing) {
                                        Text("\(pendingSyncCount)")
                                            .font(.caption2.bold())
                                            .foregroundColor(.white)
                                            .frame(minWidth: 16, minHeight: 16)
                                            .background(Color.red, in: Circle())
                                            .offset(x: 8, y: -8)
                                    }
                            }
                            .accessibilityLabel("Movimenti da sincronizzare")
                        }
                        
                        Button(action: { authenticator.logOut() }) {
                            Image(systemName: "lock.fill")
                        }
                        .accessibilityLabel("Blocca")
                    }
                }
            }
        }
        .onAppear {
            #if targetEnvironment(simulator)
            formRoute = nil
            if store.transactions.isEmpty {
                store.transactions = [
                    Transaction(
                        id: UUID(),
                        clientName: "Mario Rossi",
                        patientId: nil,
                        patientMatchKind: nil,
                        financePaymentId: nil,
                        financeEntryId: nil,
                        financeSyncedAt: nil,
                        financeSyncError: nil,
                        note: "Visita di controllo",
                        amount: 150.0,
                        paymentMethod: .cash,
                        type: .income,
                        date: Date()
                    ),
                    Transaction(
                        id: UUID(),
                        clientName: "Forniture Mediche",
                        patientId: nil,
                        patientMatchKind: nil,
                        financePaymentId: nil,
                        financeEntryId: nil,
                        financeSyncedAt: nil,
                        financeSyncError: nil,
                        note: "Garze e siringhe",
                        amount: 50.0,
                        paymentMethod: .wire,
                        type: .expense,
                        date: Date()
                    ),
                    Transaction(
                        id: UUID(),
                        clientName: "Luigi Bianchi",
                        patientId: nil,
                        patientMatchKind: nil,
                        financePaymentId: nil,
                        financeEntryId: nil,
                        financeSyncedAt: nil,
                        financeSyncError: nil,
                        note: "Seduta terapia",
                        amount: 200.0,
                        paymentMethod: .pos,
                        type: .income,
                        date: Calendar.current.date(byAdding: .day, value: -1, to: Date())!
                    ),
                    Transaction(
                        id: UUID(),
                        clientName: "Spese Postali",
                        patientId: nil,
                        patientMatchKind: nil,
                        financePaymentId: nil,
                        financeEntryId: nil,
                        financeSyncedAt: nil,
                        financeSyncError: nil,
                        note: "Invio fatture",
                        amount: 35.0,
                        paymentMethod: .cash,
                        type: .expense,
                        date: Calendar.current.date(byAdding: .day, value: -1, to: Date())!
                    ),
                    Transaction(
                        id: UUID(),
                        clientName: "Anna Verdi",
                        patientId: nil,
                        patientMatchKind: nil,
                        financePaymentId: nil,
                        financeEntryId: nil,
                        financeSyncedAt: nil,
                        financeSyncError: nil,
                        note: "Trattamento completo",
                        amount: 350.0,
                        paymentMethod: .pos,
                        type: .income,
                        date: Calendar.current.date(byAdding: .month, value: -1, to: Date())!
                    )
                ]
            }
            #endif
        }
        .sheet(item: $formRoute) { route in
            TransactionFormView(store: store, type: route.type, editingTransaction: route.editingTransaction)
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
        .sheet(isPresented: $showingSyncStatus) {
            SyncStatusView(store: store)
        }
        .alert("Eliminare questo movimento?", isPresented: deleteConfirmationIsPresented) {
            Button("Annulla", role: .cancel) {
                transactionPendingDeletion = nil
            }
            Button("Elimina", role: .destructive) {
                confirmDeleteTransaction()
            }
        } message: {
            Text("Questa operazione rimuoverà definitivamente il movimento da Sorriso Mobile.")
        }
        .alert(item: $reportShareAlert) { alert in
            Alert(
                title: Text(alert.title),
                message: Text(alert.message),
                dismissButton: .default(Text("OK"))
            )
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
                    Text(EuroAmountFormatter.string(balance))
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
                    formRoute = TransactionFormRoute(type: .income)
                }
                
                QuickActionButton(title: "Uscita", symbol: "minus", color: .red) {
                    formRoute = TransactionFormRoute(type: .expense)
                }
            }
            
            ReportActionButton(title: "Genera Resoconto", symbol: "doc.text", isEnabled: !todayTransactions.isEmpty) {
                if let url = PDFGenerator.generateDailyPDF(date: Date(), transactions: todayTransactions, totals: totals, showAmounts: true) {
                    shareFile(url: url)
                }
            }
        }
    }
    
    @ViewBuilder
    private var recentTransactions: some View {
        let todayTransactions = transactionsForToday.sorted(by: { $0.date > $1.date })
        
        Section {
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
            .listRowStyle()
            
            if todayTransactions.isEmpty {
                EmptyTransactionsView()
                    .listRowStyle()
            } else {
                ForEach(todayTransactions) { tx in
                    Button(action: {
                        formRoute = TransactionFormRoute(type: tx.type, editingTransaction: tx)
                    }) {
                        TransactionRow(transaction: tx, showAmounts: showAmounts)
                    }
                    .buttonStyle(.plain)
                    .swipeActions(edge: .trailing) {
                        Button(role: .destructive) {
                            transactionPendingDeletion = tx
                        } label: {
                            Label("Elimina", systemImage: "trash")
                        }
                    }
                    .swipeActions(edge: .leading) {
                        Button {
                            formRoute = TransactionFormRoute(type: tx.type, editingTransaction: tx)
                        } label: {
                            Label("Modifica", systemImage: "pencil")
                        }
                        .tint(.blue)
                    }
                    .listRowStyle()
                }
            }
        }
    }
    
    private var transactionsForToday: [Transaction] {
        let calendar = Calendar.current
        return store.transactions.filter { calendar.isDateInToday($0.date) }
    }
    
    private var pendingSyncCount: Int {
        store.transactions.filter { $0.shouldSyncToSorriso && $0.financeSyncedAt == nil }.count
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
            store.delete(at: IndexSet(integer: storeIndex))
        }
    }

    private func shareFile(url: URL) {
        FileSharePresenter.present(url)
    }
}

private struct ReportShareAlert: Identifiable {
    let id = UUID()
    let title: String
    let message: String
}

private struct ReportActionButton: View {
    let title: String
    let symbol: String
    let isEnabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: symbol)
                .font(.headline)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(.plain)
        .foregroundColor(isEnabled ? .blue : .secondary)
        .disabled(!isEnabled)
    }
}

private struct MetricTile: View {
    let title: String
    let amount: Double
    let color: Color
    let symbol: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: symbol)
                    .font(.subheadline.weight(.bold))
                    .foregroundColor(color)
                    .frame(width: 30, height: 30)
                    .background(color.opacity(0.14), in: Circle())

                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(.secondary)

                Spacer(minLength: 0)
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(EuroAmountFormatter.string(amount))
                    .font(.system(.title3, design: .rounded, weight: .bold))
                    .foregroundColor(color)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Rectangle()
                    .fill(color.opacity(0.28))
                    .frame(width: 34, height: 3)
                    .clipShape(Capsule())
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(
            LinearGradient(
                colors: [
                    color.opacity(0.11),
                    Color(.secondarySystemGroupedBackground)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 18, style: .continuous)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(color.opacity(0.12), lineWidth: 1)
        )
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
    
    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(transaction.clientName.isEmpty ? "Cliente generico" : transaction.clientName)
                    .font(.headline)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                HStack(spacing: 6) {
                    Text(transaction.date.formatted(date: .omitted, time: .shortened))
                    Text(transaction.paymentMethod.rawValue)
                }
                .font(.caption)
                .foregroundColor(.secondary)

                if let note = transaction.displayNote {
                    Text(note)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }
            }
            
            Spacer(minLength: 8)
            
            VStack(alignment: .trailing, spacing: 4) {
                Text(EuroAmountFormatter.string(transaction.amount, showAmounts: showAmounts, sign: transaction.type == .income ? "+" : "-"))
                    .font(.headline.monospacedDigit())
                    .foregroundColor(transaction.type == .income ? .green : .red)
                    .lineLimit(1)
                    .minimumScaleFactor(0.65)
                PatientLinkStatus(transaction: transaction)
            }
        }
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}

struct PatientLinkStatus: View {
    let transaction: Transaction
    var font: Font = .caption

    var body: some View {
        if transaction.patientId != nil {
            Label("Paziente", systemImage: "link")
                .font(font)
                .foregroundColor(.blue)
        } else if transaction.isUnlinkedSorrisoClient {
            HStack(spacing: 4) {
                Image(systemName: "link")
                    .overlay {
                        Rectangle()
                            .fill(Color.red)
                            .frame(width: 14, height: 1.5)
                            .rotationEffect(.degrees(-45))
                    }
                Text("mancante")
            }
                .font(font)
                .foregroundColor(.red)
        }
    }
}

private extension View {
    func listRowStyle() -> some View {
        listRowInsets(.init(top: 5, leading: 20, bottom: 5, trailing: 20))
            .listRowSeparator(.hidden)
            .listRowBackground(Color.clear)
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
