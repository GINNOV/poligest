import UIKit
import SwiftUI

struct TransactionFormView: View {
    @Environment(\.dismiss) var dismiss
    @ObservedObject var store: TransactionStore
    @AppStorage("serverUrl") private var serverUrl = "https://sorrisosplendente.com"
    @AppStorage("apiToken") private var apiToken = "poligest_macos_secret"
    
    let type: TransactionType
    let editingTransaction: Transaction?
    
    @State private var clientName = ""
    @State private var note = ""
    @State private var amountString = ""
    @State private var selectedDate = Date()
    @State private var selectedMethod: PaymentMethod = .cash
    @State private var patientLookupState: PatientLookupState = .idle
    @State private var isSaving = false
    @State private var activeSheet: TransactionFormSheet?
    @State private var pendingUnlinkedIncome: PendingTransaction?
    @State private var didTrySavingWithMissingClientName = false

    init(store: TransactionStore, type: TransactionType, editingTransaction: Transaction? = nil) {
        self.store = store
        self.type = editingTransaction?.type ?? type
        self.editingTransaction = editingTransaction
        
        if let editingTransaction = editingTransaction {
            _clientName = State(initialValue: editingTransaction.clientName)
            _note = State(initialValue: editingTransaction.note ?? "")
            _amountString = State(initialValue: String(format: "%.2f", editingTransaction.amount))
            _selectedDate = State(initialValue: editingTransaction.date)
            _selectedMethod = State(initialValue: editingTransaction.paymentMethod)
            if let patientId = editingTransaction.patientId {
                let match = PatientMatch(
                    patientId: patientId,
                    matchKind: editingTransaction.patientMatchKind,
                    displayName: editingTransaction.clientName,
                    detail: nil
                )
                _patientLookupState = State(initialValue: .matched(match))
            } else {
                _patientLookupState = State(initialValue: .idle)
            }
        } else {
            _clientName = State(initialValue: "")
            _note = State(initialValue: "")
            _amountString = State(initialValue: "")
            _selectedDate = State(initialValue: Date())
            _selectedMethod = State(initialValue: .cash)
            _patientLookupState = State(initialValue: .idle)
        }
    }
    
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
            .navigationTitle(editingTransaction != nil ? "Modifica movimento" : (type == .income ? "Nuova entrata" : "Nuova uscita"))
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
            .sheet(item: $activeSheet) { sheet in
                directorySheet(sheet)
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
                AmountKeyboardTextField(text: $amountString)
                    .frame(height: 58)
                    .onChange(of: amountString) { newValue in
                        let formattedValue = Self.formatEuroAmountInput(newValue)
                        if formattedValue != newValue {
                            amountString = formattedValue
                        }
                    }
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
            HStack {
                Label(type == .income ? "Cliente" : "Beneficiario", systemImage: type == .income ? "person" : "person.crop.square")
                    .font(.subheadline.bold())
                    .foregroundColor(.secondary)

                Spacer()

                if type == .income {
                    lookupIconButton(
                        systemImage: "magnifyingglass",
                        accessibilityLabel: "Cerca paziente in Sorriso"
                    ) {
                        activeSheet = .patientDirectory
                    }
                } else {
                    HStack(spacing: 8) {
                        lookupIconButton(
                            systemImage: QuickNotesContactKind.doctor.rowIconName,
                            accessibilityLabel: "Cerca medico"
                        ) {
                            activeSheet = .doctorDirectory
                        }

                        lookupIconButton(
                            systemImage: QuickNotesContactKind.supplier.rowIconName,
                            accessibilityLabel: "Cerca fornitore"
                        ) {
                            activeSheet = .supplierDirectory
                        }
                    }
                }
            }
            
            TextField(type == .income ? "Nome cliente" : "Nome medico o fornitore", text: $clientName)
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
                Label(type == .income ? "Inserisci il nome del cliente per salvare." : "Inserisci medico o fornitore per salvare.", systemImage: "exclamationmark.circle.fill")
                    .font(.caption)
                    .foregroundColor(.red)
            }

            if type == .income {
                patientLookupStatus
            }
        }
        .padding(18)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    }

    private func lookupIconButton(systemImage: String, accessibilityLabel: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.subheadline.weight(.semibold))
                .foregroundColor(.blue)
                .frame(width: 34, height: 34)
                .background(Color.blue.opacity(0.12), in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
    }

    @ViewBuilder
    private func directorySheet(_ sheet: TransactionFormSheet) -> some View {
        switch sheet {
        case .patientDirectory:
            PatientDirectoryView(
                serverURL: serverUrl,
                apiToken: apiToken,
                initialQuery: lookupName
            ) { patient in
                clientName = patient.displayName ?? clientName
                patientLookupState = .matched(patient)
            }
        case .doctorDirectory:
            QuickNotesContactDirectoryView(
                kind: .doctor,
                serverURL: serverUrl,
                apiToken: apiToken,
                initialQuery: lookupName
            ) { contact in
                clientName = contact.displayName
                patientLookupState = .idle
            }
        case .supplierDirectory:
            QuickNotesContactDirectoryView(
                kind: .supplier,
                serverURL: serverUrl,
                apiToken: apiToken,
                initialQuery: lookupName
            ) { contact in
                clientName = contact.displayName
                patientLookupState = .idle
            }
        case .serviceDirectory:
            ServiceDirectoryView(
                serverURL: serverUrl,
                apiToken: apiToken
            ) { service in
                insertServiceInNote(service)
            }
        }
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
            HStack {
                Label("Nota", systemImage: "note.text")
                    .font(.subheadline.bold())
                    .foregroundColor(.secondary)
                
                Spacer()
                
                Button {
                    activeSheet = .serviceDirectory
                } label: {
                    Image(systemName: "list.bullet.rectangle")
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(.blue)
                        .frame(width: 34, height: 34)
                        .background(Color.blue.opacity(0.12), in: Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Scegli servizio Sorriso")
            }

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
                Text(editingTransaction != nil ? "SALVA MODIFICHE" : (type == .income ? "AGGIUNGI ENTRATA" : "AGGIUNGI USCITA"))
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
        guard let amount = parsedAmount else { return false }
        return amount > 0
    }

    private var parsedAmount: Double? {
        Self.parseEuroAmount(amountString)
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
        
        guard let amount = parsedAmount else { return }
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
        if let editingTransaction = editingTransaction {
            var updatedTx = editingTransaction
            updatedTx.clientName = pending.clientName.isEmpty ? patientMatch?.displayName ?? "" : pending.clientName
            updatedTx.patientId = patientMatch?.patientId
            updatedTx.patientMatchKind = patientMatch?.matchKind
            updatedTx.note = pending.note.isEmpty ? nil : pending.note
            updatedTx.amount = pending.amount
            updatedTx.paymentMethod = pending.paymentMethod
            updatedTx.type = pending.type
            updatedTx.date = pending.date
            
            if updatedTx.amount != editingTransaction.amount ||
                updatedTx.paymentMethod != editingTransaction.paymentMethod ||
                updatedTx.clientName != editingTransaction.clientName ||
                updatedTx.note != editingTransaction.note ||
                updatedTx.date != editingTransaction.date ||
                updatedTx.patientId != editingTransaction.patientId {
                updatedTx.financeSyncedAt = nil
                updatedTx.financeSyncError = nil
            }
            
            store.update(updatedTx)
            QuickNotesSyncCoordinator.syncToFinanceIfNeeded(
                updatedTx,
                store: store,
                serverURL: serverUrl,
                apiToken: apiToken
            )
        } else {
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
            QuickNotesSyncCoordinator.syncToFinanceIfNeeded(
                newTx,
                store: store,
                serverURL: serverUrl,
                apiToken: apiToken
            )
        }
        dismiss()
    }
    
    private func lookupPatientIfNeeded() async {
        guard type == .income else {
            patientLookupState = .idle
            return
        }

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
    
    private func insertServiceInNote(_ service: SorrisoService) {
        let serviceName = service.name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !serviceName.isEmpty else { return }
        
        let trimmedNote = note.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmedNote.isEmpty {
            note = serviceName
        } else if !trimmedNote.localizedCaseInsensitiveContains(serviceName) {
            note = "\(trimmedNote)\n\(serviceName)"
        }
    }

    private static func formatEuroAmountInput(_ input: String) -> String {
        let normalizedAmount = normalizedEuroAmount(input)
        guard !normalizedAmount.integerDigits.isEmpty || normalizedAmount.hasDecimalSeparator else {
            return ""
        }

        let integerDigits = normalizedAmount.integerDigits.isEmpty ? "0" : normalizedAmount.integerDigits
        let integerValue = Int(integerDigits) ?? 0
        let formattedInteger = euroIntegerFormatter.string(from: NSNumber(value: integerValue)) ?? integerDigits

        guard normalizedAmount.hasDecimalSeparator else {
            return formattedInteger
        }

        return "\(formattedInteger),\(normalizedAmount.fractionDigits)"
    }

    private static func parseEuroAmount(_ input: String) -> Double? {
        let normalizedAmount = normalizedEuroAmount(input)
        guard !normalizedAmount.integerDigits.isEmpty else { return nil }

        let fractionDigits = normalizedAmount.fractionDigits.padding(toLength: 2, withPad: "0", startingAt: 0)
        let decimalAmount = "\(normalizedAmount.integerDigits).\(fractionDigits)"
        return Double(decimalAmount)
    }

    private static func normalizedEuroAmount(_ input: String) -> NormalizedEuroAmount {
        let allowedCharacters = input.filter { character in
            character.isNumber || character == "," || character == "."
        }
        let separatorIndex = decimalSeparatorIndex(in: allowedCharacters)

        let integerCharacters: String
        let fractionCharacters: String
        if let separatorIndex {
            integerCharacters = String(allowedCharacters[..<separatorIndex]).filter(\.isNumber)
            fractionCharacters = String(allowedCharacters[allowedCharacters.index(after: separatorIndex)...])
                .filter(\.isNumber)
        } else {
            integerCharacters = String(allowedCharacters).filter(\.isNumber)
            fractionCharacters = ""
        }

        return NormalizedEuroAmount(
            integerDigits: integerCharacters.trimmingLeadingZeros(),
            fractionDigits: String(fractionCharacters.prefix(2)),
            hasDecimalSeparator: separatorIndex != nil
        )
    }

    private static func decimalSeparatorIndex(in input: String) -> String.Index? {
        if let commaIndex = input.lastIndex(of: ",") {
            return commaIndex
        }

        guard let dotIndex = input.lastIndex(of: ".") else { return nil }
        let fractionDigits = input[input.index(after: dotIndex)...].filter(\.isNumber)
        return fractionDigits.count <= 2 ? dotIndex : nil
    }

    private static let euroIntegerFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "it_IT")
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 0
        formatter.minimumFractionDigits = 0
        return formatter
    }()
}

private struct NormalizedEuroAmount {
    let integerDigits: String
    let fractionDigits: String
    let hasDecimalSeparator: Bool
}

private extension String {
    func trimmingLeadingZeros() -> String {
        let trimmed = drop { $0 == "0" }
        return trimmed.isEmpty && contains("0") ? "0" : String(trimmed)
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

private enum TransactionFormSheet: Identifiable {
    case patientDirectory
    case doctorDirectory
    case supplierDirectory
    case serviceDirectory

    var id: String {
        switch self {
        case .patientDirectory:
            return "patientDirectory"
        case .doctorDirectory:
            return "doctorDirectory"
        case .supplierDirectory:
            return "supplierDirectory"
        case .serviceDirectory:
            return "serviceDirectory"
        }
    }
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

private struct AmountKeyboardTextField: UIViewRepresentable {
    @Binding var text: String

    func makeUIView(context: Context) -> UITextField {
        let textField = UITextField()
        textField.delegate = context.coordinator
        textField.placeholder = "0,00"
        textField.keyboardType = .decimalPad
        textField.autocapitalizationType = .none
        textField.autocorrectionType = .no
        textField.spellCheckingType = .no
        textField.smartDashesType = .no
        textField.smartInsertDeleteType = .no
        textField.smartQuotesType = .no
        textField.textAlignment = .left
        textField.adjustsFontForContentSizeCategory = true
        textField.font = roundedAmountFont
        textField.inputAssistantItem.leadingBarButtonGroups = []
        textField.inputAssistantItem.trailingBarButtonGroups = []
        textField.addTarget(context.coordinator, action: #selector(Coordinator.textDidChange(_:)), for: .editingChanged)
        
        // Move focus/cursor to the amount field when the view is created
        DispatchQueue.main.async {
            textField.becomeFirstResponder()
        }
        
        return textField
    }

    func updateUIView(_ textField: UITextField, context: Context) {
        if textField.keyboardType != .decimalPad {
            textField.keyboardType = .decimalPad
            if textField.isFirstResponder {
                textField.reloadInputViews()
            }
        }

        if textField.text != text {
            textField.text = text
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(text: $text)
    }

    private var roundedAmountFont: UIFont {
        let baseFont = UIFont.systemFont(ofSize: 46, weight: .bold)
        let descriptor = baseFont.fontDescriptor.withDesign(.rounded) ?? baseFont.fontDescriptor
        return UIFont(descriptor: descriptor, size: 46)
    }

    final class Coordinator: NSObject, UITextFieldDelegate {
        @Binding var text: String

        init(text: Binding<String>) {
            _text = text
        }

        @objc func textDidChange(_ textField: UITextField) {
            text = textField.text ?? ""
        }

        func textField(
            _ textField: UITextField,
            shouldChangeCharactersIn range: NSRange,
            replacementString string: String
        ) -> Bool {
            string.allSatisfy { character in
                character.isNumber || character == "," || character == "."
            }
        }

        func textFieldShouldReturn(_ textField: UITextField) -> Bool {
            textField.resignFirstResponder()
            return true
        }
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
