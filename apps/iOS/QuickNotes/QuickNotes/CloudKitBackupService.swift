import CloudKit
import Foundation

enum CloudKitBackupError: LocalizedError {
    case noBackupFound

    var errorDescription: String? {
        switch self {
        case .noBackupFound:
            return "Nessun backup CloudKit trovato."
        }
    }
}

protocol CloudKitBackupServicing {
    func saveBackup(transactions: [Transaction]) async throws
    func restoreBackup() async throws -> [Transaction]
}

struct CloudKitBackupService: CloudKitBackupServicing {
    private let database: CKDatabase
    private let recordID = CKRecord.ID(recordName: "transactions-backup")
    private let recordType = "QuickNotesBackup"
    private let payloadKey = "payload"
    private let updatedAtKey = "updatedAt"

    init(container: CKContainer = .default()) {
        database = container.privateCloudDatabase
    }

    func saveBackup(transactions: [Transaction]) async throws {
        let data = try JSONEncoder().encode(transactions)
        let record = await fetchExistingRecord() ?? CKRecord(recordType: recordType, recordID: recordID)
        record[payloadKey] = data as NSData
        record[updatedAtKey] = Date() as NSDate
        _ = try await save(record)
    }

    func restoreBackup() async throws -> [Transaction] {
        let record = try await fetch(recordID: recordID)
        guard let payload = record[payloadKey] as? NSData else {
            throw CloudKitBackupError.noBackupFound
        }

        let data = payload as Data
        return try JSONDecoder().decode([Transaction].self, from: data)
    }

    private func fetchExistingRecord() async -> CKRecord? {
        try? await fetch(recordID: recordID)
    }

    private func fetch(recordID: CKRecord.ID) async throws -> CKRecord {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<CKRecord, Error>) in
            database.fetch(withRecordID: recordID) { record, error in
                if let error = error as? CKError, error.code == .unknownItem {
                    continuation.resume(throwing: CloudKitBackupError.noBackupFound)
                } else if let error {
                    continuation.resume(throwing: error)
                } else if let record {
                    continuation.resume(returning: record)
                } else {
                    continuation.resume(throwing: CloudKitBackupError.noBackupFound)
                }
            }
        }
    }

    private func save(_ record: CKRecord) async throws -> CKRecord {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<CKRecord, Error>) in
            database.save(record) { savedRecord, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let savedRecord {
                    continuation.resume(returning: savedRecord)
                } else {
                    continuation.resume(throwing: CloudKitBackupError.noBackupFound)
                }
            }
        }
    }
}
