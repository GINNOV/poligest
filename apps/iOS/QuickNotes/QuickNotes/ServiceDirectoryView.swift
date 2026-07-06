import SwiftUI

struct ServiceDirectoryView: View {
    @Environment(\.dismiss) private var dismiss
    
    let serverURL: String
    let apiToken: String
    let onSelect: (SorrisoService) -> Void
    
    @State private var query = ""
    @State private var state: ServiceDirectoryState = .loading
    
    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Servizi Sorriso")
                .navigationBarTitleDisplayMode(.inline)
                .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Cerca servizio")
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Annulla") {
                            dismiss()
                        }
                    }
                }
                .task {
                    await loadServices()
                }
        }
    }
    
    @ViewBuilder
    private var content: some View {
        switch state {
        case .loading:
            ProgressView("Carico servizi...")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color(.systemGroupedBackground))
        case .loaded(let services):
            let filteredServices = filtered(services)
            if filteredServices.isEmpty {
                ServiceDirectoryMessage(
                    title: "Nessun servizio trovato",
                    systemImage: "list.bullet.rectangle",
                    message: "Modifica la ricerca o verifica il catalogo servizi in Sorriso."
                )
                .background(Color(.systemGroupedBackground))
            } else {
                List(filteredServices) { service in
                    Button {
                        onSelect(service)
                        dismiss()
                    } label: {
                        ServiceDirectoryRow(service: service)
                    }
                    .buttonStyle(.plain)
                }
                .listStyle(.plain)
            }
        case .failed(let message):
            ServiceDirectoryMessage(
                title: "Sorriso non raggiungibile",
                systemImage: "wifi.exclamationmark",
                message: message
            )
            .background(Color(.systemGroupedBackground))
        }
    }
    
    @MainActor
    private func loadServices() async {
        state = .loading
        
        do {
            let service = ServiceCatalogService(serverURL: serverURL, apiToken: apiToken)
            state = .loaded(try await service.fetchServices())
        } catch is CancellationError {
            return
        } catch {
            state = .failed(error.localizedDescription)
        }
    }
    
    private func filtered(_ services: [SorrisoService]) -> [SorrisoService] {
        let trimmedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedQuery.isEmpty else {
            return services
        }
        
        return services.filter { service in
            service.name.localizedCaseInsensitiveContains(trimmedQuery) ||
            service.detail.localizedCaseInsensitiveContains(trimmedQuery)
        }
    }
}

private enum ServiceDirectoryState: Equatable {
    case loading
    case loaded([SorrisoService])
    case failed(String)
}

private struct ServiceDirectoryMessage: View {
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

private struct ServiceDirectoryRow: View {
    let service: SorrisoService
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "list.bullet.rectangle")
                .font(.headline)
                .foregroundColor(.blue)
                .frame(width: 36, height: 36)
                .background(Color.blue.opacity(0.12), in: Circle())
            
            VStack(alignment: .leading, spacing: 4) {
                Text(service.name)
                    .font(.headline)
                    .foregroundColor(.primary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                
                if !service.detail.isEmpty {
                    Text(service.detail)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }
            }
            
            Spacer(minLength: 8)
            
            Image(systemName: "checkmark.circle")
                .font(.title3)
                .foregroundColor(.green)
        }
        .padding(.vertical, 6)
    }
}
