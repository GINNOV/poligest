import SwiftUI
import UniformTypeIdentifiers

struct MonthDrillDownView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var store: TransactionStore
    
    @State private var exportedDocument: TransactionsDocument?
    @State private var isImporting = false
    @State private var pendingImport: PendingTransactionsImport?
    @State private var importResult: ImportResult?
    
    var body: some View {
        NavigationStack {
            monthList
            .navigationTitle("Mesi")
            .navigationBarTitleDisplayMode(.large)
            .navigationDestination(for: MonthSummary.self) { summary in
                MonthDetailView(summary: summary)
            }
            .toolbar { toolbarContent }
            .fileExporter(
                isPresented: exportIsPresented,
                document: exportedDocument,
                contentType: .json,
                defaultFilename: exportFileName
            ) { result in
                handleExport(result)
            }
            .fileImporter(isPresented: $isImporting, allowedContentTypes: [.json]) { result in
                handleImport(result)
            }
            .confirmationDialog("Importa movimenti", isPresented: pendingImportIsPresented, actions: importDialogActions, message: importDialogMessage)
            .alert(item: $importResult, content: importResultAlert)
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

    private var monthList: some View {
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
    }

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItemGroup(placement: .topBarTrailing) {
            importExportMenu

            Button("Fine") {
                dismiss()
            }
        }
    }

    private var importExportMenu: some View {
        Menu {
            Button(action: beginExport) {
                Label("Esporta JSON", systemImage: "square.and.arrow.up")
            }
            .disabled(store.transactions.isEmpty)

            Button(action: beginImport) {
                Label("Importa JSON", systemImage: "square.and.arrow.down")
            }
        } label: {
            Image(systemName: "ellipsis.circle")
        }
        .accessibilityLabel("Importa o esporta movimenti")
    }
    
    private var exportFileName: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return "QuickNotes-Movimenti-\(formatter.string(from: Date())).json"
    }

    private var exportIsPresented: Binding<Bool> {
        Binding {
            exportedDocument != nil
        } set: { isPresented in
            if !isPresented {
                exportedDocument = nil
            }
        }
    }
    
    private var pendingImportIsPresented: Binding<Bool> {
        Binding {
            pendingImport != nil
        } set: { isPresented in
            if !isPresented {
                pendingImport = nil
            }
        }
    }

    @ViewBuilder
    private func importDialogActions() -> some View {
        Button("Unisci \(pendingImport?.transactions.count ?? 0) movimenti", action: mergePendingImport)

        Button("Sostituisci tutto", role: .destructive, action: replaceWithPendingImport)

        Button("Annulla", role: .cancel) {
            pendingImport = nil
        }
    }

    private func importDialogMessage() -> some View {
        Text("Scegli se unire i movimenti importati a quelli attuali o sostituire l'archivio locale.")
    }

    private func importResultAlert(_ result: ImportResult) -> Alert {
        Alert(
            title: Text(result.title),
            message: Text(result.message),
            dismissButton: .default(Text("OK"))
        )
    }

    private func beginExport() {
        exportedDocument = TransactionsDocument(transactions: store.transactions)
    }

    private func beginImport() {
        isImporting = true
    }

    private func handleExport(_ result: Result<URL, Error>) {
        exportedDocument = nil

        if case .failure(let error) = result {
            importResult = ImportResult(title: "Esportazione non riuscita", message: error.localizedDescription)
        }
    }

    private func mergePendingImport() {
        guard let pendingImport else { return }

        let importedCount = store.mergeImportedTransactions(pendingImport.transactions)
        importResult = ImportResult(
            title: "Importazione completata",
            message: "\(importedCount) nuovi movimenti importati."
        )
        self.pendingImport = nil
    }

    private func replaceWithPendingImport() {
        guard let pendingImport else { return }

        store.replaceAll(with: pendingImport.transactions)
        importResult = ImportResult(
            title: "Archivio sostituito",
            message: "\(pendingImport.transactions.count) movimenti importati."
        )
        self.pendingImport = nil
    }
    
    private func handleImport(_ result: Result<URL, Error>) {
        switch result {
        case .success(let url):
            do {
                let canAccess = url.startAccessingSecurityScopedResource()
                defer {
                    if canAccess {
                        url.stopAccessingSecurityScopedResource()
                    }
                }
                
                let data = try Data(contentsOf: url)
                let transactions = try JSONDecoder().decode([Transaction].self, from: data)
                pendingImport = PendingTransactionsImport(transactions: transactions)
            } catch {
                importResult = ImportResult(title: "Importazione non riuscita", message: error.localizedDescription)
            }
        case .failure(let error):
            importResult = ImportResult(title: "Importazione non riuscita", message: error.localizedDescription)
        }
    }
}

private struct TransactionsDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.json] }
    
    let transactions: [Transaction]
    
    init(transactions: [Transaction]) {
        self.transactions = transactions
    }
    
    init(configuration: ReadConfiguration) throws {
        guard let data = configuration.file.regularFileContents else {
            throw CocoaError(.fileReadCorruptFile)
        }
        transactions = try JSONDecoder().decode([Transaction].self, from: data)
    }
    
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(transactions)
        return FileWrapper(regularFileWithContents: data)
    }
}

private struct PendingTransactionsImport: Identifiable {
    let id = UUID()
    let transactions: [Transaction]
}

private struct ImportResult: Identifiable {
    let id = UUID()
    let title: String
    let message: String
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
                Text(transaction.clientName.isEmpty ? "Cliente generico" : transaction.clientName)
                    .font(.headline)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                Text(transaction.date.formatted(date: .abbreviated, time: .shortened))
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
                Text(showAmounts ? String(format: "%@€ %.2f", transaction.type == .income ? "+" : "-", transaction.amount) : "\(transaction.type == .income ? "+" : "-")••••")
                    .font(.headline.monospacedDigit())
                    .foregroundColor(transaction.type == .income ? .green : .red)
                    .lineLimit(1)
                    .minimumScaleFactor(0.65)
                Text(transaction.paymentMethod.rawValue)
                    .font(.caption)
                    .foregroundColor(.secondary)
                PatientLinkStatus(transaction: transaction, font: .caption2)
            }
        }
        .padding(14)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}
