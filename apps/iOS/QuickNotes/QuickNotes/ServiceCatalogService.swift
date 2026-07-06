import Foundation

struct SorrisoService: Equatable, Identifiable {
    let id: String
    let name: String
    let description: String?
    let costBasis: String?
    
    var detail: String {
        [description, formattedCost]
            .map { $0 ?? "" }
            .compactMap { value in
                let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
                return trimmed.isEmpty ? nil : trimmed
            }
            .joined(separator: " · ")
    }
    
    private var formattedCost: String {
        guard let costBasis,
              let amount = Decimal(string: costBasis.replacingOccurrences(of: ",", with: ".")) else {
            return ""
        }
        
        return "€ \(NSDecimalNumber(decimal: amount).doubleValue.formatted(.number.precision(.fractionLength(2))))"
    }
}

struct ServiceCatalogService {
    var serverURL: String
    var apiToken: String
    
    func fetchServices() async throws -> [SorrisoService] {
        let base = serverURL.trimmingCharacters(in: .whitespacesAndNewlines).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard let url = URL(string: "\(base)/api/quicknotes/services") else {
            throw ServiceCatalogError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue(apiToken, forHTTPHeaderField: "x-api-key")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ServiceCatalogError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw ServiceCatalogError.server(statusCode: httpResponse.statusCode)
        }
        
        let responseBody = try JSONDecoder().decode(ServiceCatalogResponse.self, from: data)
        return responseBody.services.map {
            SorrisoService(
                id: $0.id,
                name: $0.name,
                description: $0.description,
                costBasis: $0.costBasis
            )
        }
    }
}

private struct ServiceCatalogResponse: Decodable {
    let services: [ServiceCatalogItem]
}

private struct ServiceCatalogItem: Decodable {
    let id: String
    let name: String
    let description: String?
    let costBasis: String?
}

enum ServiceCatalogError: LocalizedError {
    case invalidURL
    case invalidResponse
    case server(statusCode: Int)
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "URL server non valido"
        case .invalidResponse:
            return "Risposta server non valida"
        case .server(let statusCode):
            return "Errore server \(statusCode)"
        }
    }
}
