import Foundation

struct PatientMatch: Equatable, Identifiable {
    let patientId: String
    let matchKind: String?
    let displayName: String?
    let detail: String?
    
    var id: String { patientId }
}

struct PatientLookupResult: Equatable {
    let match: PatientMatch?
    let candidates: [PatientMatch]
}

enum QuickNotesContactKind: String, CaseIterable {
    case doctor
    case supplier

    var title: String {
        switch self {
        case .doctor:
            return "Medici"
        case .supplier:
            return "Fornitori"
        }
    }

    var searchPrompt: String {
        switch self {
        case .doctor:
            return "Nome, specialita, telefono"
        case .supplier:
            return "Nome, email, telefono"
        }
    }

    var emptyTitle: String {
        switch self {
        case .doctor:
            return "Nessun medico trovato"
        case .supplier:
            return "Nessun fornitore trovato"
        }
    }

    var emptyMessage: String {
        switch self {
        case .doctor:
            return "Modifica la ricerca o mostra tutto l'elenco medici."
        case .supplier:
            return "Modifica la ricerca o mostra tutto l'elenco fornitori."
        }
    }

    var rowIconName: String {
        switch self {
        case .doctor:
            return "cross.case"
        case .supplier:
            return "shippingbox"
        }
    }
}

struct QuickNotesContact: Equatable, Identifiable {
    let id: String
    let displayName: String
    let detail: String?
}

struct QuickNotesContactService {
    var serverURL: String
    var apiToken: String

    func searchContacts(kind: QuickNotesContactKind, query: String) async throws -> [QuickNotesContact] {
        let base = serverURL.trimmingCharacters(in: .whitespacesAndNewlines).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard var components = URLComponents(string: "\(base)/api/quicknotes/contacts") else {
            throw PatientLookupError.invalidURL
        }

        var queryItems = [URLQueryItem(name: "kind", value: kind.rawValue)]
        let trimmedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedQuery.isEmpty {
            queryItems.append(URLQueryItem(name: "q", value: trimmedQuery))
        }
        components.queryItems = queryItems

        guard let url = components.url else {
            throw PatientLookupError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue(apiToken, forHTTPHeaderField: "x-api-key")

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw PatientLookupError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw PatientLookupError.server(statusCode: httpResponse.statusCode)
        }

        let directoryResponse = try JSONDecoder().decode(QuickNotesContactDirectoryResponse.self, from: data)
        return directoryResponse.contacts.map {
            QuickNotesContact(id: $0.id, displayName: $0.displayName, detail: $0.detail)
        }
    }
}

struct PatientLookupService {
    var serverURL: String
    var apiToken: String
    private static let cache = PatientLookupCache()
    
    func searchPatients(query: String) async throws -> [PatientMatch] {
        let base = serverURL.trimmingCharacters(in: .whitespacesAndNewlines).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard var components = URLComponents(string: "\(base)/api/patients/lookup") else {
            throw PatientLookupError.invalidURL
        }
        
        let trimmedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedQuery.isEmpty {
            components.queryItems = [URLQueryItem(name: "q", value: trimmedQuery)]
        }
        
        guard let url = components.url else {
            throw PatientLookupError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue(apiToken, forHTTPHeaderField: "x-api-key")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw PatientLookupError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw PatientLookupError.server(statusCode: httpResponse.statusCode)
        }
        
        let directoryResponse = try JSONDecoder().decode(PatientDirectoryResponse.self, from: data)
        return directoryResponse.patients.map {
            PatientMatch(
                patientId: $0.patientId,
                matchKind: "manual",
                displayName: $0.displayName,
                detail: $0.detail
            )
        }
    }
    
    func lookupPatient(fullName: String) async throws -> PatientLookupResult {
        let parts = splitName(fullName)
        guard let firstName = parts.firstName, let lastName = parts.lastName else {
            return PatientLookupResult(match: nil, candidates: [])
        }
        
        let base = serverURL.trimmingCharacters(in: .whitespacesAndNewlines).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard let url = URL(string: "\(base)/api/patients/lookup") else {
            throw PatientLookupError.invalidURL
        }
        
        let cacheKey = PatientLookupCacheKey(serverURL: base, fullName: fullName)
        if let cached = await Self.cache.cachedValue(for: cacheKey) {
            return cached
        }
        
        if let inFlight = await Self.cache.inFlightTask(for: cacheKey) {
            return try await inFlight.value
        }
        
        let task = Task<PatientLookupResult, Error> {
            try await performLookup(url: url, fullName: fullName, firstName: firstName, lastName: lastName)
        }
        await Self.cache.storeInFlightTask(task, for: cacheKey)
        
        do {
            let match = try await task.value
            if match.match != nil || !match.candidates.isEmpty {
                await Self.cache.store(match, for: cacheKey)
            } else {
                await Self.cache.removeInFlightTask(for: cacheKey)
            }
            return match
        } catch {
            await Self.cache.removeInFlightTask(for: cacheKey)
            throw error
        }
    }
    
    private func performLookup(url: URL, fullName: String, firstName: String, lastName: String) async throws -> PatientLookupResult {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiToken, forHTTPHeaderField: "x-api-key")
        request.httpBody = try JSONEncoder().encode(PatientLookupRequest(fullName: fullName, firstName: firstName, lastName: lastName))
        
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw PatientLookupError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw PatientLookupError.server(statusCode: httpResponse.statusCode)
        }
        
        let lookupResponse = try JSONDecoder().decode(PatientLookupResponse.self, from: data)
        let candidates = lookupResponse.candidates?.map {
            PatientMatch(
                patientId: $0.patientId,
                matchKind: lookupResponse.matchKind,
                displayName: $0.displayName,
                detail: $0.detail
            )
        } ?? []
        
        guard lookupResponse.exists, let patientId = lookupResponse.patientId else {
            return PatientLookupResult(match: nil, candidates: candidates)
        }
        
        let matchedCandidate = candidates.first { $0.patientId == patientId }
        let match = matchedCandidate ?? PatientMatch(
            patientId: patientId,
            matchKind: lookupResponse.matchKind,
            displayName: nil,
            detail: nil
        )
        return PatientLookupResult(match: match, candidates: candidates)
    }
    
    private func splitName(_ fullName: String) -> (firstName: String?, lastName: String?) {
        let components = fullName
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .split(separator: " ")
            .map(String.init)
        
        guard components.count >= 2 else {
            return (nil, nil)
        }
        
        return (components.dropLast().joined(separator: " "), components[components.count - 1])
    }
}

private struct PatientLookupCacheKey: Hashable {
    let serverURL: String
    let fullName: String
    
    init(serverURL: String, fullName: String) {
        self.serverURL = serverURL.lowercased()
        self.fullName = fullName
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .split(separator: " ")
            .joined(separator: " ")
            .folding(options: [.caseInsensitive, .diacriticInsensitive], locale: Locale(identifier: "it_IT"))
    }
}

private actor PatientLookupCache {
    private struct Entry {
        let value: PatientLookupResult
        let expiresAt: Date
    }
    
    private let ttl: TimeInterval = 10 * 60
    private var entries: [PatientLookupCacheKey: Entry] = [:]
    private var inFlightTasks: [PatientLookupCacheKey: Task<PatientLookupResult, Error>] = [:]
    
    func cachedValue(for key: PatientLookupCacheKey) -> PatientLookupResult? {
        guard let entry = entries[key] else {
            return nil
        }
        
        if entry.expiresAt > Date() {
            return entry.value
        }
        
        entries[key] = nil
        return nil
    }
    
    func inFlightTask(for key: PatientLookupCacheKey) -> Task<PatientLookupResult, Error>? {
        inFlightTasks[key]
    }
    
    func storeInFlightTask(_ task: Task<PatientLookupResult, Error>, for key: PatientLookupCacheKey) {
        inFlightTasks[key] = task
    }
    
    func store(_ value: PatientLookupResult, for key: PatientLookupCacheKey) {
        entries[key] = Entry(value: value, expiresAt: Date().addingTimeInterval(ttl))
        inFlightTasks[key] = nil
    }
    
    func removeInFlightTask(for key: PatientLookupCacheKey) {
        inFlightTasks[key] = nil
    }
}

private struct PatientLookupRequest: Encodable {
    let fullName: String
    let firstName: String
    let lastName: String
    let birthDate: String? = nil
    let codiceFiscale: String? = nil
}

private struct PatientLookupResponse: Decodable {
    let exists: Bool
    let patientId: String?
    let matchKind: String?
    let candidates: [PatientLookupCandidate]?
}

private struct PatientLookupCandidate: Decodable {
    let patientId: String
    let displayName: String
    let detail: String?
}

private struct PatientDirectoryResponse: Decodable {
    let patients: [PatientDirectoryPatient]
}

private struct PatientDirectoryPatient: Decodable {
    let patientId: String
    let displayName: String
    let detail: String?
}

private struct QuickNotesContactDirectoryResponse: Decodable {
    let contacts: [QuickNotesContactRecord]
}

private struct QuickNotesContactRecord: Decodable {
    let id: String
    let displayName: String
    let detail: String?
}

enum PatientLookupError: LocalizedError {
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
