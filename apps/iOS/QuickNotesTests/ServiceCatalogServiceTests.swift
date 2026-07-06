import XCTest
@testable import QuickNotes

final class ServiceCatalogServiceTests: XCTestCase {
    override func setUp() {
        super.setUp()
        URLProtocol.registerClass(ServiceMockURLProtocol.self)
        ServiceMockURLProtocol.reset()
    }

    override func tearDown() {
        ServiceMockURLProtocol.reset()
        URLProtocol.unregisterClass(ServiceMockURLProtocol.self)
        super.tearDown()
    }

    func testFetchServicesUsesQuickNotesServicesEndpointAndToken() async throws {
        let state = ServiceRequestCapture()
        ServiceMockURLProtocol.handler = { request in
            await state.capture(request)

            let body = """
            {
              "services": [
                {
                  "id": "service-1",
                  "name": "Igiene",
                  "description": "Seduta di igiene",
                  "costBasis": "80.00"
                },
                {
                  "id": "service-2",
                  "name": "Prima visita",
                  "description": null,
                  "costBasis": "60.00"
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

        let service = ServiceCatalogService(serverURL: "https://quicknotes.test", apiToken: "secret")
        let services = try await service.fetchServices()

        XCTAssertEqual(services, [
            SorrisoService(id: "service-1", name: "Igiene", description: "Seduta di igiene", costBasis: "80.00"),
            SorrisoService(id: "service-2", name: "Prima visita", description: nil, costBasis: "60.00"),
        ])

        let requests = await state.requests
        XCTAssertEqual(requests.count, 1)
        XCTAssertEqual(requests.first?.url?.path, "/api/quicknotes/services")
        XCTAssertEqual(requests.first?.method, "GET")
        XCTAssertEqual(requests.first?.apiKey, "secret")
    }
}

private actor ServiceRequestCapture {
    struct CapturedRequest {
        let url: URL?
        let method: String?
        let apiKey: String?
    }

    private(set) var requests: [CapturedRequest] = []

    func capture(_ request: URLRequest) async {
        requests.append(CapturedRequest(
            url: request.url,
            method: request.httpMethod,
            apiKey: request.value(forHTTPHeaderField: "x-api-key")
        ))
    }
}

private final class ServiceMockURLProtocol: URLProtocol {
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
