import SwiftUI

struct PatientDirectoryView: View {
    @Environment(\.dismiss) private var dismiss
    
    let serverURL: String
    let apiToken: String
    let initialQuery: String
    let onSelect: (PatientMatch) -> Void
    
    @State private var query: String
    @State private var state: PatientDirectoryState = .loading
    
    init(serverURL: String, apiToken: String, initialQuery: String, onSelect: @escaping (PatientMatch) -> Void) {
        self.serverURL = serverURL
        self.apiToken = apiToken
        self.initialQuery = initialQuery
        self.onSelect = onSelect
        _query = State(initialValue: initialQuery)
    }
    
    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Pazienti Sorriso")
                .navigationBarTitleDisplayMode(.inline)
                .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Nome, telefono, email")
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Annulla") {
                            dismiss()
                        }
                    }
                    
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Mostra tutto") {
                            query = ""
                        }
                    }
                }
                .task(id: query) {
                    await searchPatients()
                }
        }
    }
    
    @ViewBuilder
    private var content: some View {
        switch state {
        case .loading:
            ProgressView("Carico pazienti...")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color(.systemGroupedBackground))
        case .loaded(let patients):
            if patients.isEmpty {
                PatientDirectoryMessage(
                    title: "Nessun paziente trovato",
                    systemImage: "person.crop.circle.badge.questionmark",
                    message: "Modifica la ricerca o mostra tutto l'elenco."
                )
                .background(Color(.systemGroupedBackground))
            } else {
                List(patients) { patient in
                    Button {
                        onSelect(patient)
                        dismiss()
                    } label: {
                        PatientDirectoryRow(patient: patient)
                    }
                    .buttonStyle(.plain)
                }
                .listStyle(.plain)
            }
        case .failed(let message):
            PatientDirectoryMessage(
                title: "Sorriso non raggiungibile",
                systemImage: "wifi.exclamationmark",
                message: message
            )
            .background(Color(.systemGroupedBackground))
        }
    }
    
    @MainActor
    private func searchPatients() async {
        state = .loading
        
        do {
            try await Task.sleep(nanoseconds: 250_000_000)
            try Task.checkCancellation()
            
            let service = PatientLookupService(serverURL: serverURL, apiToken: apiToken)
            let patients = try await service.searchPatients(query: query)
            state = .loaded(patients)
        } catch is CancellationError {
            return
        } catch {
            state = .failed(error.localizedDescription)
        }
    }
}

private enum PatientDirectoryState: Equatable {
    case loading
    case loaded([PatientMatch])
    case failed(String)
}

private struct PatientDirectoryMessage: View {
    let title: String
    let systemImage: String
    let message: String
    
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.largeTitle)
                .foregroundColor(.secondary)
            
            Text(title)
                .font(.headline)
            
            Text(message)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private struct PatientDirectoryRow: View {
    let patient: PatientMatch
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "person.text.rectangle")
                .font(.headline)
                .foregroundColor(.blue)
                .frame(width: 36, height: 36)
                .background(Color.blue.opacity(0.12), in: Circle())
            
            VStack(alignment: .leading, spacing: 4) {
                Text(patient.displayName ?? patient.patientId)
                    .font(.headline)
                    .foregroundColor(.primary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                
                Text(patient.detail ?? patient.patientId)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }
            
            Spacer(minLength: 8)
            
            Image(systemName: "checkmark.circle")
                .font(.title3)
                .foregroundColor(.green)
        }
        .padding(.vertical, 6)
    }
}
