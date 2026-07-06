import XCTest
@testable import QuickNotes

final class PatientLookupServiceTests: XCTestCase {
    override func setUp() {
        super.setUp()
        URLProtocol.registerClass(MockURLProtocol.self)
        MockURLProtocol.reset()
    }

    override func tearDown() {
        MockURLProtocol.reset()
        URLProtocol.unregisterClass(MockURLProtocol.self)
        super.tearDown()
    }

    func testLookupSendsFullNameAndCachesSuccessfulMatch() async throws {
        let state = RequestCapture()
        MockURLProtocol.handler = { request in
            await state.capture(request)

            let body = """
            {
              "exists": true,
              "patientId": "patient-1",
              "matchKind": "name",
              "candidates": [
                {
                  "patientId": "patient-1",
                  "displayName": "De Luca Mario",
                  "detail": "1980-01-02"
                }
              ]
            }
            """
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: nil,
                headerFields: ["Content-Type": "application/json"]
            )!
            return (response, Data(body.utf8))
        }

        let service = PatientLookupService(serverURL: "https://quicknotes.test", apiToken: "secret")
        let firstResult = try await service.lookupPatient(fullName: "Mario De Luca")
        let secondResult = try await service.lookupPatient(fullName: "  mario   de luca  ")

        XCTAssertEqual(firstResult.match?.patientId, "patient-1")
        XCTAssertEqual(secondResult.match?.patientId, "patient-1")

        let requests = await state.requests
        XCTAssertEqual(requests.count, 1)
        XCTAssertEqual(requests.first?.method, "POST")
        XCTAssertEqual(requests.first?.apiKey, "secret")
        XCTAssertEqual(requests.first?.body["fullName"], "Mario De Luca")
        XCTAssertEqual(requests.first?.body["firstName"], "Mario De")
        XCTAssertEqual(requests.first?.body["lastName"], "Luca")
    }

    func testLookupReturnsCandidatesForSimilarNames() async throws {
        MockURLProtocol.handler = { request in
            let body = """
            {
              "exists": false,
              "matchKind": "similar",
              "candidates": [
                {
                  "patientId": "patient-2",
                  "displayName": "Rossi Maria",
                  "detail": "3330000000"
                }
              ]
            }
            """
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: nil,
                headerFields: ["Content-Type": "application/json"]
            )!
            return (response, Data(body.utf8))
        }

        let service = PatientLookupService(serverURL: "https://quicknotes.test/similar", apiToken: "secret")
        let result = try await service.lookupPatient(fullName: "Maria Rossi")

        XCTAssertNil(result.match)
        XCTAssertEqual(result.candidates, [
            PatientMatch(
                patientId: "patient-2",
                matchKind: "similar",
                displayName: "Rossi Maria",
                detail: "3330000000"
            )
        ])
    }
}

private actor RequestCapture {
    struct CapturedRequest {
        let method: String?
        let apiKey: String?
        let body: [String: String]
    }

    private(set) var requests: [CapturedRequest] = []

    func capture(_ request: URLRequest) async {
        let bodyData = request.httpBody ?? request.httpBodyStream.flatMap(Self.data(from:))
        let decodedBody = (bodyData.flatMap {
            try? JSONSerialization.jsonObject(with: $0) as? [String: String]
        }) ?? [:]

        requests.append(CapturedRequest(
            method: request.httpMethod,
            apiKey: request.value(forHTTPHeaderField: "x-api-key"),
            body: decodedBody
        ))
    }
    
    private static func data(from stream: InputStream) -> Data {
        stream.open()
        defer { stream.close() }
        
        var data = Data()
        let bufferSize = 1024
        let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferSize)
        defer { buffer.deallocate() }
        
        while stream.hasBytesAvailable {
            let read = stream.read(buffer, maxLength: bufferSize)
            guard read > 0 else { break }
            data.append(buffer, count: read)
        }
        
        return data
    }
}

private final class MockURLProtocol: URLProtocol {
    typealias Handler = (URLRequest) async throws -> (HTTPURLResponse, Data)

    static var handler: Handler?

    static func reset() {
        handler = nil
    }

    override class func canInit(with request: URLRequest) -> Bool {
        request.url?.host == "quicknotes.test"
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        guard let handler = Self.handler else {
            client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
            return
        }

        Task {
            do {
                let (response, data) = try await handler(request)
                client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
                client?.urlProtocol(self, didLoad: data)
                client?.urlProtocolDidFinishLoading(self)
            } catch {
                client?.urlProtocol(self, didFailWithError: error)
            }
        }
    }

    override func stopLoading() {}
}
