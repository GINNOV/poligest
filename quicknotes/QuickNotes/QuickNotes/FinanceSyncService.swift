import Foundation

struct FinanceSyncResult {
    let paymentId: String?
    let financeEntryId: String?
}

struct FinanceSyncService {
    var serverURL: String
    var apiToken: String
    
    func syncPatientPayment(transaction: Transaction) async throws -> FinanceSyncResult {
        guard let patientId = transaction.patientId else {
            throw FinanceSyncError.missingPatient
        }
        
        let base = serverURL.trimmingCharacters(in: .whitespacesAndNewlines).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard let url = URL(string: "\(base)/api/quicknotes/payments") else {
            throw FinanceSyncError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiToken, forHTTPHeaderField: "x-api-key")
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        request.httpBody = try encoder.encode(QuickNotesPaymentRequest(
            patientId: patientId,
            quickNotesTransactionId: transaction.id.uuidString,
            amount: transaction.amount,
            paidAt: transaction.date,
            method: transaction.paymentMethod.financeMethod,
            clientName: transaction.clientName,
            note: "Registrato da QuickNotes"
        ))
        
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw FinanceSyncError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw FinanceSyncError.server(statusCode: httpResponse.statusCode)
        }
        
        let syncResponse = try JSONDecoder().decode(QuickNotesPaymentResponse.self, from: data)
        return FinanceSyncResult(paymentId: syncResponse.paymentId, financeEntryId: syncResponse.financeEntryId)
    }
}

private struct QuickNotesPaymentRequest: Encodable {
    let patientId: String
    let quickNotesTransactionId: String
    let amount: Double
    let paidAt: Date
    let method: String
    let clientName: String
    let note: String
}

private struct QuickNotesPaymentResponse: Decodable {
    let paymentId: String?
    let financeEntryId: String?
}

private extension PaymentMethod {
    var financeMethod: String {
        switch self {
        case .cash:
            return "CASH"
        case .pos:
            return "ELECTRONIC"
        case .wire:
            return "BANK_TRANSFER"
        }
    }
}

enum FinanceSyncError: LocalizedError {
    case missingPatient
    case invalidURL
    case invalidResponse
    case server(statusCode: Int)
    
    var errorDescription: String? {
        switch self {
        case .missingPatient:
            return "Paziente non collegato"
        case .invalidURL:
            return "URL server non valido"
        case .invalidResponse:
            return "Risposta server non valida"
        case .server(let statusCode):
            return "Errore server \(statusCode)"
        }
    }
}
