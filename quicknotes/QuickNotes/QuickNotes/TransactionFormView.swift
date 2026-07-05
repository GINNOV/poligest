import SwiftUI

struct TransactionFormView: View {
    @Environment(\.dismiss) var dismiss
    @ObservedObject var store: TransactionStore
    
    let type: TransactionType
    
    @State private var clientName = ""
    @State private var amountString = ""
    @State private var selectedMethod: PaymentMethod = .cash
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    amountCard
                    clientCard
                    paymentCard
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
        }
        .padding(18)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
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
    
    private var saveBar: some View {
        Button(action: saveTransaction) {
            HStack {
                Image(systemName: "checkmark")
                Text(type == .income ? "Salva entrata" : "Salva uscita")
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(FormSaveButtonStyle(color: type == .income ? .green : .red, isEnabled: amountIsValid))
        .disabled(!amountIsValid)
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
    
    private func saveTransaction() {
        let cleaned = amountString.replacingOccurrences(of: ",", with: ".")
        guard let amount = Double(cleaned) else { return }
        
        let newTx = Transaction(
            clientName: clientName.trimmingCharacters(in: .whitespacesAndNewlines),
            amount: amount,
            paymentMethod: selectedMethod,
            type: type,
            date: Date()
        )
        
        store.add(newTx)
        dismiss()
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
