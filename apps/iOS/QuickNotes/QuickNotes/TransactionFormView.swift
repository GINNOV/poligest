import SwiftUI

struct TransactionFormView: View {
    @Environment(\.dismiss) var dismiss
    @ObservedObject var store: TransactionStore
    @AppStorage("serverUrl") private var serverUrl = "https://sorrisosplendente.com"
    @AppStorage("apiToken") private var apiToken = "poligest_macos_secret"
    
    let type: TransactionType
    
    @State private var clientName = ""
    @State private var note = ""
    @State private var amountString = ""
    @State private var selectedDate = Date()
    @State private var selectedMethod: PaymentMethod = .cash
    @State private var patientLookupState: PatientLookupState = .idle
    @State private var isSaving = false
    @State private var showingPatientDirectory = false
    @State private var pendingUnlinkedIncome: PendingTransaction?
    @State private var didTrySavingWithMissingClientName = false
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    amountCard
                    clientCard
                    noteCard
                    paymentCard
                    dateCard
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)
                .padding(.bottom, 96)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle(type == .income ? "Nuova entrata" : "Nuova uscita")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Annulla") {
                        dismiss()
                    }
                }
            }
            .safeAreaInset(edge: .bottom) {
                saveBar
            }
            .sheet(isPresented: $showingPatientDirectory) {
                PatientDirectoryView(
                    serverURL: serverUrl,
                    apiToken: apiToken,
                    initialQuery: lookupName
                ) { patient in
                    clientName = patient.displayName ?? clientName
                    patientLookupState = .matched(patient)
                }
            }
            .task(id: lookupName) {
                await lookupPatientIfNeeded()
            }
            .alert("Cliente non presente in Sorriso", isPresented: unlinkedIncomeConfirmationIsPresented) {
                Button("Annulla", role: .cancel) {
                    pendingUnlinkedIncome = nil
                }
                Button("Salva comunque") {
                    savePendingUnlinkedIncome()
                }
            } message: {
                Text("Vuoi aggiungere questo movimento alla contabilita senza collegarlo a un paziente Sorriso?")
            }
            .scrollDismissesKeyboard(.interactively)
        }
    }
    
    private var amountCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Importo", systemImage: type == .income ? "plus.circle.fill" : "minus.circle.fill")
                .font(.subheadline.bold())
                .foregroundColor(type == .income ? .green : .red)
            
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("€")
                    .font(.system(.title2, design: .rounded, weight: .semibold))
                    .foregroundColor(.secondary)
                TextField("0,00", text: $amountString)
                    .font(.system(size: 46, weight: .bold, design: .rounded))
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.leading)
                    .submitLabel(.done)
            }
        }
        .padding(18)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke((type == .income ? Color.green : Color.red).opacity(0.16), lineWidth: 1)
        )
    }
    
    private var clientCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Cliente", systemImage: "person")
                .font(.subheadline.bold())
                .foregroundColor(.secondary)
            
            TextField("Nome cliente", text: $clientName)
                .font(.title3)
                .textInputAutocapitalization(.words)
                .submitLabel(.done)
                .padding(.horizontal, 14)
                .padding(.vertical, 13)
                .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(showClientNameRequiredMessage ? Color.red.opacity(0.65) : Color.clear, lineWidth: 1)
                )
                .onChange(of: clientName) { _ in
                    if clientNameIsValid {
                        didTrySavingWithMissingClientName = false
                    }
                }
            
            if showClientNameRequiredMessage {
                Label("Inserisci il nome del cliente per salvare.", systemImage: "exclamationmark.circle.fill")
                    .font(.caption)
                    .foregroundColor(.red)
            }
            
            Button {
                showingPatientDirectory = true
            } label: {
                Label("Cerca in Sorriso", systemImage: "person.crop.circle.badge.magnifyingglass")
                    .font(.subheadline.bold())
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Color.blue.opacity(0.12), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
            .buttonStyle(.plain)
            .foregroundColor(.blue)
            
            patientLookupStatus
        }
        .padding(18)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    }
    
    @ViewBuilder
    private var patientLookupStatus: some View {
        switch patientLookupState {
        case .idle:
            EmptyView()
        case .searching:
            Label("Ricerca paziente...", systemImage: "magnifyingglass")
                .font(.caption)
                .foregroundColor(.secondary)
        case .matched(let match):
            Label("Paziente collegato: \(match.displayName ?? match.patientId)", systemImage: "checkmark.seal.fill")
                .font(.caption)
                .foregroundColor(.green)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        case .candidates(let candidates):
            VStack(alignment: .leading, spacing: 8) {
                Label("Seleziona il paziente corretto", systemImage: "person.crop.circle.badge.questionmark")
                    .font(.caption.bold())
                    .foregroundColor(.orange)
                
                ForEach(candidates) { candidate in
                    PatientCandidateButton(candidate: candidate) {
                        clientName = candidate.displayName ?? clientName
                        patientLookupState = .matched(candidate)
                    }
                }
            }
        case .notFound:
            Label("Nessun paziente trovato sul server", systemImage: "person.crop.circle.badge.questionmark")
                .font(.caption)
                .foregroundColor(.secondary)
        case .failed:
            Label("Impossibile verificare il paziente", systemImage: "wifi.exclamationmark")
                .font(.caption)
                .foregroundColor(.orange)
        }
    }
    
    private var paymentCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Label("Pagamento", systemImage: "creditcard")
                .font(.subheadline.bold())
                .foregroundColor(.secondary)
            
            HStack(spacing: 10) {
                ForEach(PaymentMethod.allCases) { method in
                    PaymentChip(method: method, isSelected: selectedMethod == method) {
                        selectedMethod = method
                    }
                }
            }
        }
        .padding(18)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    }

    private var noteCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Nota", systemImage: "note.text")
                .font(.subheadline.bold())
                .foregroundColor(.secondary)

            TextField("Aggiungi una nota", text: $note, axis: .vertical)
                .font(.body)
                .lineLimit(3...6)
                .textInputAutocapitalization(.sentences)
                .submitLabel(.done)
                .padding(.horizontal, 14)
                .padding(.vertical, 13)
                .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .padding(18)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    }

    private var dateCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Data", systemImage: "calendar")
                .font(.subheadline.bold())
                .foregroundColor(.secondary)

            DatePicker("Data movimento", selection: $selectedDate, displayedComponents: .date)
                .datePickerStyle(.graphical)
                .labelsHidden()
                .tint(type == .income ? .green : .red)
                .frame(maxWidth: .infinity)
        }
        .padding(18)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    }
    
    private var saveBar: some View {
        Button {
            Task {
                await saveTransaction()
            }
        } label: {
            HStack {
                if isSaving {
                    ProgressView()
                        .tint(.white)
                } else {
                    Image(systemName: "checkmark")
                }
                Text(type == .income ? "Salva entrata" : "Salva uscita")
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(FormSaveButtonStyle(color: type == .income ? .green : .red, isEnabled: amountIsValid && !isSaving))
        .disabled(!amountIsValid || isSaving)
        .padding(.horizontal, 20)
        .padding(.top, 12)
        .padding(.bottom, 8)
        .background(.bar)
    }
    
    private var amountIsValid: Bool {
        let cleaned = amountString.replacingOccurrences(of: ",", with: ".")
        guard let amount = Double(cleaned) else { return false }
        return amount > 0
    }
    
    private var clientNameIsValid: Bool {
        !lookupName.isEmpty
    }
    
    private var showClientNameRequiredMessage: Bool {
        didTrySavingWithMissingClientName && !clientNameIsValid
    }
    
    private var lookupName: String {
        clientName.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    
    private var matchedPatient: PatientMatch? {
        if case .matched(let match) = patientLookupState {
            return match
        }
        return nil
    }
    
    @MainActor
    private func saveTransaction() async {
        guard !isSaving else { return }
        guard clientNameIsValid else {
            didTrySavingWithMissingClientName = true
            return
        }
        
        let cleaned = amountString.replacingOccurrences(of: ",", with: ".")
        guard let amount = Double(cleaned) else { return }
        let trimmedClientName = clientName.trimmingCharacters(in: .whitespacesAndNewlines)
        let draft = PendingTransaction(
            clientName: trimmedClientName,
            note: note.trimmingCharacters(in: .whitespacesAndNewlines),
            date: selectedDate,
            amount: amount,
            paymentMethod: selectedMethod,
            type: type
        )
        isSaving = true
        defer { isSaving = false }
        
        let patientMatch = await resolvedPatientMatch()
        if shouldConfirmUnlinkedIncome(patientMatch: patientMatch) {
            pendingUnlinkedIncome = draft
            return
        }
        
        saveTransaction(draft, patientMatch: patientMatch)
    }
    
    @MainActor
    private func resolvedPatientMatch() async -> PatientMatch? {
        if let matchedPatient {
            return matchedPatient
        }
        
        let name = lookupName
        guard type == .income, name.split(separator: " ").count >= 2 else {
            return nil
        }
        
        patientLookupState = .searching
        
        do {
            let service = PatientLookupService(serverURL: serverUrl, apiToken: apiToken)
            let result = try await service.lookupPatient(fullName: name)
            if let match = result.match {
                patientLookupState = .matched(match)
                return match
            } else if !result.candidates.isEmpty {
                patientLookupState = .candidates(result.candidates)
                return nil
            }
            patientLookupState = .notFound
        } catch {
            patientLookupState = .failed
        }
        
        return nil
    }
    
    private func shouldConfirmUnlinkedIncome(patientMatch: PatientMatch?) -> Bool {
        guard type == .income, patientMatch == nil, !lookupName.isEmpty else {
            return false
        }
        
        return true
    }
    
    private var unlinkedIncomeConfirmationIsPresented: Binding<Bool> {
        Binding {
            pendingUnlinkedIncome != nil
        } set: { isPresented in
            if !isPresented {
                pendingUnlinkedIncome = nil
            }
        }
    }
    
    private func savePendingUnlinkedIncome() {
        guard let pendingUnlinkedIncome else { return }
        saveTransaction(pendingUnlinkedIncome, patientMatch: nil)
        self.pendingUnlinkedIncome = nil
    }
    
    private func saveTransaction(_ pending: PendingTransaction, patientMatch: PatientMatch?) {
        let newTx = Transaction(
            clientName: pending.clientName.isEmpty ? patientMatch?.displayName ?? "" : pending.clientName,
            patientId: patientMatch?.patientId,
            patientMatchKind: patientMatch?.matchKind,
            note: pending.note.isEmpty ? nil : pending.note,
            amount: pending.amount,
            paymentMethod: pending.paymentMethod,
            type: pending.type,
            date: pending.date
        )
        
        store.add(newTx)
        syncToFinanceIfNeeded(newTx)
        dismiss()
    }
    
    private func syncToFinanceIfNeeded(_ transaction: Transaction) {
        guard transaction.shouldSyncToSorriso else { return }
        
        Task {
            var syncedTransaction = transaction
            
            do {
                let service = FinanceSyncService(serverURL: serverUrl, apiToken: apiToken)
                let result = try await service.syncPatientPayment(transaction: transaction)
                syncedTransaction.financePaymentId = result.paymentId
                syncedTransaction.financeEntryId = result.financeEntryId
                syncedTransaction.financeSyncedAt = Date()
                syncedTransaction.financeSyncError = nil
            } catch {
                syncedTransaction.financeSyncError = error.localizedDescription
            }
            
            await MainActor.run {
                store.update(syncedTransaction)
            }
        }
    }
    
    private func lookupPatientIfNeeded() async {
        let name = lookupName
        if case .matched(let match) = patientLookupState,
           match.displayName == name {
            return
        }
        
        let nameParts = name.split(separator: " ")
        guard nameParts.count >= 2 else {
            patientLookupState = .idle
            return
        }
        
        patientLookupState = .searching
        
        do {
            try await Task.sleep(nanoseconds: 450_000_000)
            try Task.checkCancellation()
            
            let service = PatientLookupService(serverURL: serverUrl, apiToken: apiToken)
            let result = try await service.lookupPatient(fullName: name)
            if let match = result.match {
                patientLookupState = .matched(match)
            } else if !result.candidates.isEmpty {
                patientLookupState = .candidates(result.candidates)
            } else {
                patientLookupState = .notFound
            }
        } catch is CancellationError {
            return
        } catch {
            patientLookupState = .failed
        }
    }
}

private enum PatientLookupState: Equatable {
    case idle
    case searching
    case matched(PatientMatch)
    case candidates([PatientMatch])
    case notFound
    case failed
}

private struct PendingTransaction: Equatable {
    let clientName: String
    let note: String
    let date: Date
    let amount: Double
    let paymentMethod: PaymentMethod
    let type: TransactionType
}

private struct PatientCandidateButton: View {
    let candidate: PatientMatch
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Image(systemName: "person.text.rectangle")
                    .font(.body)
                    .foregroundColor(.blue)
                    .frame(width: 24)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(candidate.displayName ?? candidate.patientId)
                        .font(.subheadline.bold())
                        .foregroundColor(.primary)
                        .lineLimit(1)
                    Text(candidate.detail ?? candidate.patientId)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
                
                Spacer(minLength: 8)
                
                Image(systemName: "chevron.right")
                    .font(.caption.bold())
                    .foregroundColor(.secondary)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

private struct PaymentChip: View {
    let method: PaymentMethod
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: method.iconName)
                    .font(.headline)
                Text(method.rawValue)
                    .font(.caption.bold())
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .foregroundColor(isSelected ? .white : .primary)
            .background(isSelected ? Color.blue : Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

private struct FormSaveButtonStyle: ButtonStyle {
    let color: Color
    let isEnabled: Bool
    
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundColor(.white)
            .padding(.vertical, 16)
            .background((isEnabled ? color : Color.gray).opacity(configuration.isPressed ? 0.78 : 1), in: Capsule())
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
    }
}
