#!/bin/bash
# CI: GitHub Actions runs this via .github/workflows/macos-verify.yml (and scanid-release.yml).
set -e

# Create a temporary test runner source file
cat << 'EOF' > main.swift
import Foundation
import AppKit
import CoreGraphics
import CoreImage
import ImageIO
import AVFoundation

var verificationFailures = 0

func assertEqual(_ actual: String?, _ expected: String?, _ message: String) {
    if actual == expected {
        print("✅ PASS: \(message)")
    } else {
        verificationFailures += 1
        print("❌ FAIL: \(message) - Expected: \(String(describing: expected)), Got: \(String(describing: actual))")
    }
}

func assertDataField(_ actual: IDData, _ keyPath: KeyPath<IDData, String?>, _ expected: String?, _ message: String) {
    assertEqual(actual[keyPath: keyPath], expected, message)
}

func assertDataField(_ actual: IDData, _ keyPath: KeyPath<IDData, String>, _ expected: String, _ message: String) {
    assertEqual(actual[keyPath: keyPath], expected, message)
}

func assertTrue(_ condition: Bool, _ message: String) {
    if condition {
        print("✅ PASS: \(message)")
    } else {
        verificationFailures += 1
        print("❌ FAIL: \(message)")
    }
}

func assertEqual(_ actual: CGFloat, _ expected: CGFloat, _ message: String) {
    if actual == expected {
        print("✅ PASS: \(message)")
    } else {
        verificationFailures += 1
        print("❌ FAIL: \(message) - Expected: \(expected), Got: \(actual)")
    }
}

func assertEqual(_ actual: ScanCaptureState, _ expected: ScanCaptureState, _ message: String) {
    if actual == expected {
        print("✅ PASS: \(message)")
    } else {
        verificationFailures += 1
        print("❌ FAIL: \(message) - Expected: \(expected), Got: \(actual)")
    }
}

func assertOrientation(_ actual: CGImagePropertyOrientation, _ expected: CGImagePropertyOrientation, _ message: String) {
    if actual == expected {
        print("✅ PASS: \(message)")
    } else {
        verificationFailures += 1
        print("❌ FAIL: \(message) - Expected: \(expected.rawValue), Got: \(actual.rawValue)")
    }
}

func makeItem(_ text: String, x: CGFloat, y: CGFloat, confidence: Float = 1.0) -> RecognizedItem {
    RecognizedItem(
        text: text,
        boundingBox: CGRect(x: x, y: y, width: 0.2, height: 0.04),
        confidence: confidence
    )
}

func makeSolidCGImage(width: Int, height: Int) -> CGImage {
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let context = CGContext(
        data: nil,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: width * 4,
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    )!
    context.setFillColor(NSColor.white.cgColor)
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    context.setFillColor(NSColor.black.cgColor)
    context.fill(CGRect(x: 80, y: 70, width: width - 160, height: height - 140))
    return context.makeImage()!
}

func makeFlatCGImage(width: Int, height: Int, white: CGFloat) -> CGImage {
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let context = CGContext(
        data: nil,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: width * 4,
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    )!
    context.setFillColor(NSColor(calibratedWhite: white, alpha: 1).cgColor)
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    return context.makeImage()!
}

func makeCheckerCGImage(width: Int, height: Int) -> CGImage {
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let context = CGContext(
        data: nil,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: width * 4,
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    )!
    for y in stride(from: 0, to: height, by: 4) {
        for x in stride(from: 0, to: width, by: 4) {
            let white: CGFloat = ((x / 4) + (y / 4)).isMultiple(of: 2) ? 0.16 : 0.82
            context.setFillColor(NSColor(calibratedWhite: white, alpha: 1).cgColor)
            context.fill(CGRect(x: x, y: y, width: 4, height: 4))
        }
    }
    return context.makeImage()!
}

struct RenderedOCRFixture {
    let name: String
    let image: NSImage
    let expected: IDData
}

struct RealImageFixtureManifest: Decodable {
    let fixtures: [RealImageFixture]
}

struct RealImageFixture: Decodable {
    let name: String
    let image: String
    let expect: FixtureExpectation
    let quality: FixtureQualityExpectation
    let captureSource: FixtureCaptureSource
    let documentSide: FixtureDocumentSide
    let condition: String
    let expected: FixtureExpectedData?

    enum CodingKeys: String, CodingKey {
        case name
        case image
        case expect
        case quality
        case captureSource
        case documentSide
        case condition
        case expected
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        name = try container.decode(String.self, forKey: .name)
        image = try container.decode(String.self, forKey: .image)
        expect = try container.decodeIfPresent(FixtureExpectation.self, forKey: .expect) ?? .accept
        quality = try container.decodeIfPresent(FixtureQualityExpectation.self, forKey: .quality)
            ?? (expect == .accept ? .usable : .ignore)
        captureSource = try container.decodeIfPresent(FixtureCaptureSource.self, forKey: .captureSource) ?? .unknown
        documentSide = try container.decodeIfPresent(FixtureDocumentSide.self, forKey: .documentSide) ?? .unknown
        condition = try container.decodeIfPresent(String.self, forKey: .condition) ?? "unspecified"
        expected = try container.decodeIfPresent(FixtureExpectedData.self, forKey: .expected)

        switch expect {
        case .accept:
            guard expected != nil else {
                throw DecodingError.keyNotFound(
                    CodingKeys.expected,
                    DecodingError.Context(
                        codingPath: container.codingPath,
                        debugDescription: "Accepted fixtures must include full expected field data."
                    )
                )
            }
        case .reject:
            break
        }
    }
}

enum FixtureExpectation: String, Decodable {
    case accept
    case reject
}

enum FixtureQualityExpectation: String, Decodable {
    case usable
    case unusable
    case ignore
}

enum FixtureCaptureSource: String, Decodable {
    case webcam
    case continuity
    case imported
    case unknown
}

enum FixtureDocumentSide: String, Decodable {
    case cieFront = "cie_front"
    case cieBack = "cie_back"
    case tesseraFront = "tessera_front"
    case tesseraBack = "tessera_back"
    case negative
    case unknown
}

struct FixtureCoverage {
    var manifests = 0
    var fixtures = 0
    var accepted = 0
    var rejected = 0
    var captureSources = Set<String>()
    var documentSides = Set<String>()
    var conditions = Set<String>()
    var incompleteMetadata: [String] = []

    mutating func record(_ fixture: RealImageFixture, manifestURL: URL) {
        fixtures += 1
        switch fixture.expect {
        case .accept:
            accepted += 1
        case .reject:
            rejected += 1
        }
        captureSources.insert(fixture.captureSource.rawValue)
        documentSides.insert(fixture.documentSide.rawValue)
        conditions.insert(fixture.condition)

        if fixture.captureSource == .unknown
            || fixture.documentSide == .unknown
            || fixture.condition == "unspecified"
            || fixture.condition.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name)")
        }
    }

    func printSummary() {
        guard fixtures > 0 else { return }
        print("\nReal fixture coverage:")
        print("- manifests: \(manifests)")
        print("- fixtures: \(fixtures) (\(accepted) accept, \(rejected) reject)")
        print("- sources: \(captureSources.sorted().joined(separator: ", "))")
        print("- sides: \(documentSides.sorted().joined(separator: ", "))")
        print("- conditions: \(conditions.sorted().joined(separator: ", "))")
        if !incompleteMetadata.isEmpty {
            print("WARNING: Fixtures with incomplete metadata: \(incompleteMetadata.joined(separator: ", "))")
        }
    }
}

struct FixtureExpectedData: Decodable {
    let documentType: String
    let surname: String?
    let name: String?
    let codiceFiscale: String?
    let documentNumber: String?
    let dateOfBirth: String?
    let placeOfBirth: String?
    let gender: String?
    let expiryDate: String?
    let nationality: String?
    let cardNumber: String?

    enum CodingKeys: String, CodingKey, CaseIterable {
        case documentType
        case surname
        case name
        case codiceFiscale
        case documentNumber
        case dateOfBirth
        case placeOfBirth
        case gender
        case expiryDate
        case nationality
        case cardNumber
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        for key in CodingKeys.allCases {
            guard container.contains(key) else {
                throw DecodingError.keyNotFound(
                    key,
                    DecodingError.Context(
                        codingPath: container.codingPath,
                        debugDescription: "Expected fixture field '\(key.rawValue)' must be present; use null for absent values."
                    )
                )
            }
        }

        documentType = try container.decode(String.self, forKey: .documentType)
        surname = try container.decodeIfPresent(String.self, forKey: .surname)
        name = try container.decodeIfPresent(String.self, forKey: .name)
        codiceFiscale = try container.decodeIfPresent(String.self, forKey: .codiceFiscale)
        documentNumber = try container.decodeIfPresent(String.self, forKey: .documentNumber)
        dateOfBirth = try container.decodeIfPresent(String.self, forKey: .dateOfBirth)
        placeOfBirth = try container.decodeIfPresent(String.self, forKey: .placeOfBirth)
        gender = try container.decodeIfPresent(String.self, forKey: .gender)
        expiryDate = try container.decodeIfPresent(String.self, forKey: .expiryDate)
        nationality = try container.decodeIfPresent(String.self, forKey: .nationality)
        cardNumber = try container.decodeIfPresent(String.self, forKey: .cardNumber)
    }

    var idData: IDData {
        IDData(
            documentType: documentType,
            surname: surname,
            name: name,
            codiceFiscale: codiceFiscale,
            documentNumber: documentNumber,
            dateOfBirth: dateOfBirth,
            placeOfBirth: placeOfBirth,
            gender: gender,
            expiryDate: expiryDate,
            nationality: nationality,
            cardNumber: cardNumber,
            rawText: []
        )
    }
}

func makeOCRFixtureImage(lines: [String], width: CGFloat = 1400, height: CGFloat = 880) -> NSImage {
    let image = NSImage(size: NSSize(width: width, height: height))
    image.lockFocus()
    NSColor.white.setFill()
    NSRect(x: 0, y: 0, width: width, height: height).fill()
    NSColor.black.setStroke()
    let border = NSBezierPath(roundedRect: NSRect(x: 36, y: 36, width: width - 72, height: height - 72), xRadius: 28, yRadius: 28)
    border.lineWidth = 6
    border.stroke()

    let paragraphStyle = NSMutableParagraphStyle()
    paragraphStyle.alignment = .left
    let attrs: [NSAttributedString.Key: Any] = [
        .font: NSFont.monospacedSystemFont(ofSize: 42, weight: .medium),
        .foregroundColor: NSColor.black,
        .paragraphStyle: paragraphStyle,
    ]

    var y = height - 120
    for line in lines {
        line.draw(
            in: NSRect(x: 92, y: y, width: width - 184, height: 54),
            withAttributes: attrs
        )
        y -= 72
    }
    image.unlockFocus()
    return image
}

func runOCRFixture(_ fixture: RenderedOCRFixture) {
    guard let cgImage = fixture.image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        verificationFailures += 1
        print("❌ FAIL: \(fixture.name) creates a CGImage")
        return
    }

    let semaphore = DispatchSemaphore(value: 0)
    var parsed = IDData(documentType: "UNKNOWN", rawText: [])
    IDScanner.recognizeText(in: cgImage) { items in
        let sortedItems = ScanCaptureLogic.sortedRecognizedItems(items)
        parsed = ScanCaptureLogic.parseRecognizedItems(sortedItems)
        parsed.calculateCodiceFiscaleIfPossible()
        semaphore.signal()
    }

    while semaphore.wait(timeout: .now() + 0.05) == .timedOut {
        RunLoop.current.run(mode: .default, before: Date(timeIntervalSinceNow: 0.05))
    }

    assertDataField(parsed, \.documentType, fixture.expected.documentType, "\(fixture.name) document type")
    assertDataField(parsed, \.surname, fixture.expected.surname, "\(fixture.name) surname")
    assertDataField(parsed, \.name, fixture.expected.name, "\(fixture.name) name")
    assertDataField(parsed, \.codiceFiscale, fixture.expected.codiceFiscale, "\(fixture.name) codice fiscale")
    assertDataField(parsed, \.documentNumber, fixture.expected.documentNumber, "\(fixture.name) document number")
    assertDataField(parsed, \.dateOfBirth, fixture.expected.dateOfBirth, "\(fixture.name) date of birth")
    assertDataField(parsed, \.placeOfBirth, fixture.expected.placeOfBirth, "\(fixture.name) place of birth")
    assertDataField(parsed, \.gender, fixture.expected.gender, "\(fixture.name) gender")
    assertDataField(parsed, \.expiryDate, fixture.expected.expiryDate, "\(fixture.name) expiry")
    assertDataField(parsed, \.cardNumber, fixture.expected.cardNumber, "\(fixture.name) card number")
}

struct StaticCaptureFixtureResult {
    let parsed: IDData
    let frameQuality: CaptureFrameQuality
}

func staticCaptureResult(name: String, image: NSImage) -> StaticCaptureFixtureResult? {
    guard let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        verificationFailures += 1
        print("❌ FAIL: \(name) creates a CGImage")
        return nil
    }
    let frameQuality = IDScanner.assessFrameQuality(cgImage)

    let semaphore = DispatchSemaphore(value: 0)
    var parsed = IDData(documentType: "UNKNOWN", rawText: [])
    ScanCaptureLogic.recognizeTextWithOptionalAutoCrop(
        image: image,
        cgImage: cgImage,
        autoCrop: true,
        boundsItems: [],
        fallbackItems: [],
        fallbackParsed: IDData(documentType: "UNKNOWN", rawText: [])
    ) { _, _, result in
        parsed = result
        parsed.calculateCodiceFiscaleIfPossible()
        semaphore.signal()
    }

    while semaphore.wait(timeout: .now() + 0.05) == .timedOut {
        RunLoop.current.run(mode: .default, before: Date(timeIntervalSinceNow: 0.05))
    }

    return StaticCaptureFixtureResult(parsed: parsed, frameQuality: frameQuality)
}

func assertFrameQuality(_ quality: CaptureFrameQuality, matches expectation: FixtureQualityExpectation, name: String) {
    switch expectation {
    case .usable:
        assertTrue(
            quality.isUsableForCapture,
            "\(name) frame quality is usable - \(quality.diagnosticSummary)"
        )
    case .unusable:
        assertTrue(
            !quality.isUsableForCapture,
            "\(name) frame quality is rejected - \(quality.diagnosticSummary)"
        )
    case .ignore:
        break
    }
}

func runAcceptedStaticCaptureFixture(
    name: String,
    image: NSImage,
    expected: IDData,
    qualityExpectation: FixtureQualityExpectation
) {
    guard let result = staticCaptureResult(name: name, image: image) else { return }
    let parsed = result.parsed

    assertFrameQuality(result.frameQuality, matches: qualityExpectation, name: name)
    assertTrue(ScanCaptureLogic.shouldAcceptCapture(parsed, frameQuality: result.frameQuality), "\(name) passes final capture gate")
    assertDataField(parsed, \.documentType, expected.documentType, "\(name) document type")
    assertDataField(parsed, \.surname, expected.surname, "\(name) surname")
    assertDataField(parsed, \.name, expected.name, "\(name) name")
    assertDataField(parsed, \.codiceFiscale, expected.codiceFiscale, "\(name) codice fiscale")
    assertDataField(parsed, \.documentNumber, expected.documentNumber, "\(name) document number")
    assertDataField(parsed, \.dateOfBirth, expected.dateOfBirth, "\(name) date of birth")
    assertDataField(parsed, \.placeOfBirth, expected.placeOfBirth, "\(name) place of birth")
    assertDataField(parsed, \.gender, expected.gender, "\(name) gender")
    assertDataField(parsed, \.expiryDate, expected.expiryDate, "\(name) expiry")
    assertDataField(parsed, \.nationality, expected.nationality, "\(name) nationality")
    assertDataField(parsed, \.cardNumber, expected.cardNumber, "\(name) card number")
}

func runRejectedStaticCaptureFixture(
    name: String,
    image: NSImage,
    qualityExpectation: FixtureQualityExpectation
) {
    guard let result = staticCaptureResult(name: name, image: image) else { return }
    assertFrameQuality(result.frameQuality, matches: qualityExpectation, name: name)
    assertTrue(
        !ScanCaptureLogic.shouldAcceptCapture(result.parsed, frameQuality: result.frameQuality),
        "\(name) is rejected by final capture gate"
    )
}

func runRealImageFixtureCorpus() {
    let rootURL = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        .appendingPathComponent("OCRFixtures", isDirectory: true)
    let manifestURLs = realImageFixtureManifestURLs(rootURL: rootURL)

    guard !manifestURLs.isEmpty else {
        print("No OCRFixtures manifest.json files found; skipping real image OCR fixture corpus.")
        return
    }

    var coverage = FixtureCoverage()
    for manifestURL in manifestURLs {
        runRealImageFixtureManifest(manifestURL, coverage: &coverage)
    }
    coverage.printSummary()
}

func realImageFixtureManifestURLs(rootURL: URL) -> [URL] {
    let fileManager = FileManager.default
    guard fileManager.fileExists(atPath: rootURL.path) else { return [] }

    var urls: [URL] = []
    let rootManifest = rootURL.appendingPathComponent("manifest.json")
    if fileManager.fileExists(atPath: rootManifest.path) {
        urls.append(rootManifest)
    }

    guard let enumerator = fileManager.enumerator(
        at: rootURL,
        includingPropertiesForKeys: [.isRegularFileKey],
        options: [.skipsHiddenFiles]
    ) else {
        return urls
    }

    let rootManifestPath = rootManifest.standardizedFileURL.path
    for case let url as URL in enumerator where url.lastPathComponent == "manifest.json" {
        guard url.standardizedFileURL.path != rootManifestPath else { continue }
        urls.append(url)
    }

    var seen = Set<String>()
    return urls
        .filter { seen.insert($0.standardizedFileURL.path).inserted }
        .sorted { $0.path < $1.path }
}

func runRealImageFixtureManifest(_ manifestURL: URL, coverage: inout FixtureCoverage) {
    let fixtureBaseURL = manifestURL.deletingLastPathComponent()
    do {
        let manifest = try JSONDecoder().decode(
            RealImageFixtureManifest.self,
            from: Data(contentsOf: manifestURL)
        )
        coverage.manifests += 1
        assertTrue(!manifest.fixtures.isEmpty, "\(manifestURL.lastPathComponent) has at least one fixture")

        for fixture in manifest.fixtures {
            coverage.record(fixture, manifestURL: manifestURL)
            let imageURL = fixtureBaseURL.appendingPathComponent(fixture.image)
            guard let image = NSImage(contentsOf: imageURL) else {
                verificationFailures += 1
                print("❌ FAIL: \(fixture.name) loads image at \(imageURL.path)")
                continue
            }
            let fixtureName = "Real fixture \(fixture.name)"
            switch fixture.expect {
            case .accept:
                guard let expected = fixture.expected else {
                    verificationFailures += 1
                    print("❌ FAIL: \(fixtureName) has expected data")
                    continue
                }
                runAcceptedStaticCaptureFixture(
                    name: fixtureName,
                    image: image,
                    expected: expected.idData,
                    qualityExpectation: fixture.quality
                )
            case .reject:
                runRejectedStaticCaptureFixture(
                    name: fixtureName,
                    image: image,
                    qualityExpectation: fixture.quality
                )
            }
        }
    } catch {
        verificationFailures += 1
        print("❌ FAIL: Real image fixture manifest decodes at \(manifestURL.path) - \(error)")
    }
}

func makeBGRAPixelBuffer(width: Int, height: Int, pixel: (_ x: Int, _ y: Int) -> UInt8) -> CVPixelBuffer {
    var pixelBuffer: CVPixelBuffer?
    let attrs = [
        kCVPixelBufferCGImageCompatibilityKey: true,
        kCVPixelBufferCGBitmapContextCompatibilityKey: true,
    ] as CFDictionary
    CVPixelBufferCreate(
        kCFAllocatorDefault,
        width,
        height,
        kCVPixelFormatType_32BGRA,
        attrs,
        &pixelBuffer
    )
    let buffer = pixelBuffer!
    CVPixelBufferLockBaseAddress(buffer, [])
    let bytes = CVPixelBufferGetBaseAddress(buffer)!.assumingMemoryBound(to: UInt8.self)
    let bytesPerRow = CVPixelBufferGetBytesPerRow(buffer)
    for y in 0..<height {
        for x in 0..<width {
            let value = pixel(x, y)
            let offset = (y * bytesPerRow) + (x * 4)
            bytes[offset] = value
            bytes[offset + 1] = value
            bytes[offset + 2] = value
            bytes[offset + 3] = 255
        }
    }
    CVPixelBufferUnlockBaseAddress(buffer, [])
    return buffer
}

print("=== Running IDParser Unit Tests ===")

print("\n=== Running Real Image Fixture Manifest Unit Tests ===")

let rejectManifestJSON = """
{
  "fixtures": [
    {
      "name": "partial-frame-reject",
      "image": "negative/partial-frame.png",
      "expect": "reject"
    }
  ]
}
""".data(using: .utf8)!
let decodedRejectManifest = try? JSONDecoder().decode(RealImageFixtureManifest.self, from: rejectManifestJSON)
assertEqual(decodedRejectManifest?.fixtures.first?.expect.rawValue, "reject", "Reject fixture manifest decodes without expected fields")
assertEqual(decodedRejectManifest?.fixtures.first?.quality.rawValue, "ignore", "Reject fixture defaults to ignored frame quality")
assertEqual(decodedRejectManifest?.fixtures.first?.captureSource.rawValue, "unknown", "Fixture capture source defaults to unknown")
assertEqual(decodedRejectManifest?.fixtures.first?.documentSide.rawValue, "unknown", "Fixture document side defaults to unknown")
assertEqual(decodedRejectManifest?.fixtures.first?.condition, "unspecified", "Fixture condition defaults to unspecified")

let acceptMissingExpectedJSON = """
{
  "fixtures": [
    {
      "name": "cie-front",
      "image": "continuity/cie-front.png",
      "expect": "accept"
    }
  ]
}
""".data(using: .utf8)!
let missingExpectedManifest = try? JSONDecoder().decode(RealImageFixtureManifest.self, from: acceptMissingExpectedJSON)
assertTrue(missingExpectedManifest == nil, "Accept fixture manifest requires expected fields")

let acceptQualityManifestJSON = """
{
  "fixtures": [
    {
      "name": "cie-front",
      "image": "continuity/cie-front.png",
      "expect": "accept",
      "quality": "usable",
      "captureSource": "continuity",
      "documentSide": "cie_front",
      "condition": "good",
      "expected": {
        "documentType": "CIE_FRONT",
        "surname": "ROSSI",
        "name": "MARIO",
        "codiceFiscale": "RSSMRA90A15H501Y",
        "documentNumber": "CA12345AA",
        "dateOfBirth": "15/08/1990",
        "placeOfBirth": "ROMA",
        "gender": "M",
        "expiryDate": "15/08/2030",
        "nationality": "ITA",
        "cardNumber": null
      }
    }
  ]
}
""".data(using: .utf8)!
let decodedAcceptQualityManifest = try? JSONDecoder().decode(RealImageFixtureManifest.self, from: acceptQualityManifestJSON)
assertEqual(decodedAcceptQualityManifest?.fixtures.first?.quality.rawValue, "usable", "Accept fixture quality expectation decodes")
assertEqual(decodedAcceptQualityManifest?.fixtures.first?.captureSource.rawValue, "continuity", "Fixture capture source decodes")
assertEqual(decodedAcceptQualityManifest?.fixtures.first?.documentSide.rawValue, "cie_front", "Fixture document side decodes")
assertEqual(decodedAcceptQualityManifest?.fixtures.first?.condition, "good", "Fixture condition decodes")

let manifestDiscoveryRoot = FileManager.default.temporaryDirectory
    .appendingPathComponent("scanid-manifest-discovery-\(UUID().uuidString)", isDirectory: true)
let nestedManifestDirectory = manifestDiscoveryRoot
    .appendingPathComponent("exported-fixture", isDirectory: true)
try? FileManager.default.createDirectory(at: nestedManifestDirectory, withIntermediateDirectories: true)
try? Data("{}".utf8).write(to: manifestDiscoveryRoot.appendingPathComponent("manifest.json"))
try? Data("{}".utf8).write(to: nestedManifestDirectory.appendingPathComponent("manifest.json"))
let discoveredManifests = realImageFixtureManifestURLs(rootURL: manifestDiscoveryRoot)
assertEqual(String(discoveredManifests.count), "2", "Real fixture discovery includes root and nested manifests")
try? FileManager.default.removeItem(at: manifestDiscoveryRoot)

// Test Case 1: CIE Front heuristic parsing
let cieFrontLines = [
    "REPUBBLICA ITALIANA",
    "CARTA DI IDENTITÀ",
    "DOCUMENTO NUMERO CA12345AA",
    "Cognome / Surname",
    "ROSSI",
    "Nome / Name",
    "MARIO",
    "Luogo e data di nascita / Place and date of birth",
    "ROMA 15/08/1990",
    "Sesso / Sex",
    "M",
    "Cittadinanza / Nationality",
    "ITA",
    "Codice Fiscale",
    "RSSMRA90A15H501Y",
    "Scadenza / Expiry Date",
    "15/08/2030"
]

let parsedCieFront = IDParser.parse(lines: cieFrontLines)
assertEqual(parsedCieFront.documentType, "CIE_FRONT", "CIE Front Type")
assertEqual(parsedCieFront.surname, "ROSSI", "CIE Front Surname")
assertEqual(parsedCieFront.name, "MARIO", "CIE Front Name")
assertEqual(parsedCieFront.codiceFiscale, "RSSMRA90A15H501Y", "CIE Front Codice Fiscale")
assertEqual(parsedCieFront.documentNumber, "CA12345AA", "CIE Front Document Number")
assertEqual(parsedCieFront.dateOfBirth, "15/08/1990", "CIE Front Date of Birth")
assertEqual(parsedCieFront.placeOfBirth, "ROMA", "CIE Front Place of Birth")
assertEqual(parsedCieFront.gender, "M", "CIE Front Gender")
assertEqual(parsedCieFront.expiryDate, "15/08/2030", "CIE Front Expiry Date")

print("\n-----------------------------------\n")

// Test Case 2: CIE Back MRZ parsing
let cieBackLines = [
    "I<ITACA00000AA6<<<<<<<<<<<<<<<",
    "9008153M3008154ITA<<<<<<<<<<<6",
    "ROSSI<<MARIO<<<<<<<<<<<<<<<<<<",
    "RSSMRA90A15H501Y",
    "VIA APPIA NUOVA 12",
    "ROMA (RM)"
]

let parsedCieBack = IDParser.parse(lines: cieBackLines)
assertEqual(parsedCieBack.documentType, "CIE_BACK", "CIE Back Type (MRZ)")
assertEqual(parsedCieBack.surname, "ROSSI", "CIE Back Surname")
assertEqual(parsedCieBack.name, "MARIO", "CIE Back Name")
assertEqual(parsedCieBack.codiceFiscale, "RSSMRA90A15H501Y", "CIE Back Codice Fiscale")
assertEqual(parsedCieBack.documentNumber, "CA00000AA", "CIE Back Document Number")
assertEqual(parsedCieBack.dateOfBirth, "15/08/1990", "CIE Back Date of Birth")
assertEqual(parsedCieBack.gender, "M", "CIE Back Gender")
assertEqual(parsedCieBack.expiryDate, "15/08/2030", "CIE Back Expiry Date")

let barcodeMRZPayload = cieBackLines.joined(separator: "\n")
let parsedBarcodeCieBack = ScanCaptureLogic.parseRecognizedItems([], barcodePayloads: [barcodeMRZPayload])
assertEqual(parsedBarcodeCieBack.documentType, "CIE_BACK", "Barcode MRZ payload sets CIE Back type")
assertEqual(parsedBarcodeCieBack.surname, "ROSSI", "Barcode MRZ payload extracts surname")
assertEqual(parsedBarcodeCieBack.name, "MARIO", "Barcode MRZ payload extracts name")
assertEqual(parsedBarcodeCieBack.codiceFiscale, "RSSMRA90A15H501Y", "Barcode MRZ payload extracts codice fiscale")
assertEqual(parsedBarcodeCieBack.documentNumber, "CA00000AA", "Barcode MRZ payload extracts document number")
assertEqual(parsedBarcodeCieBack.dateOfBirth, "15/08/1990", "Barcode MRZ payload extracts date of birth")
assertEqual(parsedBarcodeCieBack.expiryDate, "15/08/2030", "Barcode MRZ payload extracts expiry date")

let parsedBarcodeTSBack = ScanCaptureLogic.parseRecognizedItems(
    [],
    barcodePayloads: ["80380000000000012345|RSSMRA90A15H501Y"]
)
assertEqual(parsedBarcodeTSBack.documentType, "TESSERA_SANITARIA_BACK", "Barcode payload sets Tessera back type from card number")
assertEqual(parsedBarcodeTSBack.cardNumber, "80380000000000012345", "Barcode payload extracts Tessera card number")
assertEqual(parsedBarcodeTSBack.codiceFiscale, "RSSMRA90A15H501Y", "Barcode payload extracts codice fiscale")

let mixedOCRWithBarcode = [
    makeItem("TESSERA SANITARIA", x: 0.20, y: 0.90),
    makeItem("COGNOME ROSSI", x: 0.20, y: 0.78),
    makeItem("NOME MARIA", x: 0.20, y: 0.70),
    makeItem("DATA DI NASCITA 24/12/1995", x: 0.20, y: 0.62),
    makeItem("LUOGO DI NASCITA MILANO", x: 0.20, y: 0.54),
]
let parsedMixedBarcode = ScanCaptureLogic.parseRecognizedItems(
    mixedOCRWithBarcode,
    barcodePayloads: ["RSSMRA95T64F205W"]
)
assertEqual(parsedMixedBarcode.codiceFiscale, "RSSMRA95T64F205W", "Barcode payload fills deterministic field alongside OCR fields")
assertEqual(parsedMixedBarcode.surname, "ROSSI", "OCR surname survives barcode merge")
assertEqual(parsedMixedBarcode.name, "MARIA", "OCR name survives barcode merge")

print("\n-----------------------------------\n")

// Test Case 3: Tessera Sanitaria Front
let tsFrontLines = [
    "REPUBBLICA ITALIANA",
    "SERVIZIO SANITARIO NAZIONALE",
    "TESSERA SANITARIA",
    "COGNOME",
    "ROSSI",
    "NOME",
    "MARIA",
    "DATA DI NASCITA",
    "24/12/1995",
    "LUOGO DI NASCITA",
    "MILANO (MI)",
    "CODICE FISCALE",
    "RSSMRA95T64F205W",
    "SCADENZA",
    "24/12/2029"
]

let parsedTSFront = IDParser.parse(lines: tsFrontLines)
assertEqual(parsedTSFront.documentType, "TESSERA_SANITARIA_FRONT", "TS Front Type")
assertEqual(parsedTSFront.surname, "ROSSI", "TS Front Surname")
assertEqual(parsedTSFront.name, "MARIA", "TS Front Name")
assertEqual(parsedTSFront.codiceFiscale, "RSSMRA95T64F205W", "TS Front Codice Fiscale")
assertEqual(parsedTSFront.dateOfBirth, "24/12/1995", "TS Front Date of Birth")
assertEqual(parsedTSFront.placeOfBirth, "MILANO (MI)", "TS Front Place of Birth")
assertEqual(parsedTSFront.expiryDate, "24/12/2029", "TS Front Expiry Date")

print("\n-----------------------------------\n")

// Test Case 4: Tessera Sanitaria Back (Card Number)
let tsBackLines = [
    "80380001201234567890",
    "RSSMRA95T64F205W"
]

let parsedTSBack = IDParser.parse(lines: tsBackLines)
assertEqual(parsedTSBack.documentType, "TESSERA_SANITARIA_BACK", "TS Back Type")
assertEqual(parsedTSBack.cardNumber, "80380001201234567890", "TS Back Card Number")
assertEqual(parsedTSBack.codiceFiscale, "RSSMRA95T64F205W", "TS Back Codice Fiscale")

let tsBackWithNearbyFrontLabels = [
    "TESSERA SANITARIA",
    "80380001201234567890",
    "RSSMRA95T64F205W",
    "Cognome",
    "AZIENDA SANITARIA",
    "Nome",
    "SPORTELLO ASSISTENZA",
    "Sesso F",
]
let parsedTSBackWithNearbyFrontLabels = IDParser.parse(lines: tsBackWithNearbyFrontLabels)
assertEqual(parsedTSBackWithNearbyFrontLabels.documentType, "TESSERA_SANITARIA_BACK", "TS Back with card number stays back")
assertEqual(parsedTSBackWithNearbyFrontLabels.surname, nil, "TS Back ignores nearby surname label noise")
assertEqual(parsedTSBackWithNearbyFrontLabels.name, nil, "TS Back ignores nearby name label noise")
assertEqual(parsedTSBackWithNearbyFrontLabels.gender, nil, "TS Back ignores nearby gender label noise")

let cieBackWithoutMRZ = [
    "REPUBBLICA ITALIANA",
    "CARTA DI IDENTITÀ",
    "INDIRIZZO VIA ROMA 10",
    "Cognome",
    "UFFICI ANAGRAFE",
    "Nome",
    "SPORTELLO",
    "Documento numero CA12345AA",
]
let parsedCIEBackWithoutMRZ = IDParser.parse(lines: cieBackWithoutMRZ)
assertEqual(parsedCIEBackWithoutMRZ.documentType, "CIE_BACK", "CIE Back without MRZ stays back")
assertEqual(parsedCIEBackWithoutMRZ.surname, nil, "CIE Back without MRZ ignores surname label noise")
assertEqual(parsedCIEBackWithoutMRZ.name, nil, "CIE Back without MRZ ignores name label noise")
// Test Case 5: Codice Fiscale Calculation
let cfCalcLines = [
    "REPUBBLICA ITALIANA",
    "CARTA DI IDENTITÀ",
    "DOCUMENTO NUMERO CA12345AA",
    "Cognome / Surname",
    "ROSSI",
    "Nome / Name",
    "MARIO",
    "Luogo e data di nascita / Place and date of birth",
    "ROMA (RM) 15/01/1990",
    "Sesso / Sex",
    "M",
    "Cittadinanza / Nationality",
    "ITALIANA",
    "Scadenza / Expiry Date",
    "15/01/2030"
]

let parsedCFCalc = IDParser.parse(lines: cfCalcLines)
assertEqual(parsedCFCalc.documentType, "CIE_FRONT", "CF Calc Type")
assertEqual(parsedCFCalc.surname, "ROSSI", "CF Calc Surname")
assertEqual(parsedCFCalc.name, "MARIO", "CF Calc Name")
assertEqual(parsedCFCalc.dateOfBirth, "15/01/1990", "CF Calc DOB")
assertEqual(parsedCFCalc.placeOfBirth, "ROMA (RM)", "CF Calc Place of Birth")
assertEqual(parsedCFCalc.gender, "M", "CF Calc Gender")
assertEqual(parsedCFCalc.codiceFiscale, "RSSMRA90A15H501K", "Calculated Codice Fiscale")

// Test Case 6: Tessera Sanitaria Front with noise and messy ordering (with birthplace label on separate lines)
let tsFrontNoiseLines = [
    "REPUBBLICA ITALIANA",
    "TESSERA SANITARIA",
    "CARTA REGIONALE DEI SERVIZI",
    "Codice RSSMRA90A15H501Y",
    "Sesso M",
    "Cognome",
    "ROSSI",
    "Nome",
    "MARIO",
    "Luogo",
    "ROMA",
    "di nascita",
    "Provincia",
    "RM",
    "Data di nascita",
    "15/01/1990",
    "Scadenza 15/01/2030"
]

let parsedTSFrontNoise = IDParser.parse(lines: tsFrontNoiseLines)
assertEqual(parsedTSFrontNoise.documentType, "TESSERA_SANITARIA_FRONT", "TS Front Noise Type")
assertEqual(parsedTSFrontNoise.surname, "ROSSI", "TS Front Noise Surname")
assertEqual(parsedTSFrontNoise.name, "MARIO", "TS Front Noise Name")
assertEqual(parsedTSFrontNoise.codiceFiscale, "RSSMRA90A15H501Y", "TS Front Noise Codice Fiscale")
assertEqual(parsedTSFrontNoise.dateOfBirth, "15/01/1990", "TS Front Noise DOB")
assertEqual(parsedTSFrontNoise.placeOfBirth, "ROMA", "TS Front Noise Place of Birth")
assertEqual(parsedTSFrontNoise.gender, "M", "TS Front Noise Gender")
assertEqual(parsedTSFrontNoise.expiryDate, "15/01/2030", "TS Front Noise Expiry Date")

// Test Case 7: CIE Front with label and value on same line (e.g. OCR merging)
let cieSameLineLines = [
    "REPUBBLICA ITALIANA",
    "CARTA DI IDENTITÀ",
    "DOCUMENTO NUMERO CA12345AA",
    "3. Cognome / Surname ROSSI",
    "4. Nome / Name MARIO",
    "5. Luogo e data di nascita / Place and date of birth ROMA (RM) 15/01/1990",
    "Sesso / Sex M",
    "Cittadinanza / Nationality ITALIANA",
    "Scadenza / Expiry Date 15/01/2030"
]

let parsedCIESameLine = IDParser.parse(lines: cieSameLineLines)
assertEqual(parsedCIESameLine.documentType, "CIE_FRONT", "CIE Same Line Type")
assertEqual(parsedCIESameLine.surname, "ROSSI", "CIE Same Line Surname")
assertEqual(parsedCIESameLine.name, "MARIO", "CIE Same Line Name")
assertEqual(parsedCIESameLine.dateOfBirth, "15/01/1990", "CIE Same Line DOB")
assertEqual(parsedCIESameLine.placeOfBirth, "ROMA (RM)", "CIE Same Line Place of Birth")
assertEqual(parsedCIESameLine.gender, "M", "CIE Same Line Gender")
assertEqual(parsedCIESameLine.codiceFiscale, "RSSMRA90A15H501K", "CIE Same Line Calculated Codice Fiscale")

// Test Case 8: Stacked label lines (common OCR layout — values below both labels)
let cieStackedLabelsLines = [
    "Cognome / Surname",
    "Nome / Name",
    "ROSSI",
    "MARIO",
    "Luogo e data di nascita / Place and date of birth",
    "ROMA 15/08/1990",
    "Sesso / Sex",
    "M"
]

let parsedCIEStackedLabels = IDParser.parse(lines: cieStackedLabelsLines)
assertEqual(parsedCIEStackedLabels.surname, "ROSSI", "CIE Stacked Labels Surname")
assertEqual(parsedCIEStackedLabels.name, "MARIO", "CIE Stacked Labels Name")

// Test Case 9: Combined Cognome/Nome header on one line
let cieCombinedHeaderLines = [
    "Cognome / Nome",
    "ROSSI",
    "MARIO",
    "Sesso / Sex",
    "M"
]

let parsedCIECombinedHeader = IDParser.parse(lines: cieCombinedHeaderLines)
assertEqual(parsedCIECombinedHeader.surname, "ROSSI", "CIE Combined Header Surname")
assertEqual(parsedCIECombinedHeader.name, "MARIO", "CIE Combined Header Name")

// Test Case 10: Tessera Sanitaria with scrambled OCR name order
let tsScrambledNameLines = [
    "REPUBBLICA ITALIANA",
    "TESSERA SANITARIA",
    "CARTA REGIONALE DEI SERVIZI",
    "Codice Fiscale CNTNMR52C44G834U",
    "Sesso F",
    "Cognome",
    "Nome",
    "ANNA MARIA",
    "Luogo di nascita",
    "PONTECAGNANO FAIANO",
    "Data di nascita",
    "04/03/1952",
    "Provincia SA",
    "CONTE",
    "Data di scadenza",
    "02/09/2030"
]

let parsedTSScrambledNames = IDParser.parse(lines: tsScrambledNameLines)
assertEqual(parsedTSScrambledNames.documentType, "TESSERA_SANITARIA_FRONT", "TS Scrambled Names Type")
assertEqual(parsedTSScrambledNames.surname, "CONTE", "TS Scrambled Names Surname")
assertEqual(parsedTSScrambledNames.name, "ANNA MARIA", "TS Scrambled Names Name")
assertEqual(parsedTSScrambledNames.codiceFiscale, "CNTNMR52C44G834U", "TS Scrambled Names Codice Fiscale")
assertEqual(parsedTSScrambledNames.dateOfBirth, "04/03/1952", "TS Scrambled Names DOB")
assertEqual(parsedTSScrambledNames.placeOfBirth, "PONTECAGNANO FAIANO", "TS Scrambled Names Place of Birth")
assertEqual(parsedTSScrambledNames.gender, "F", "TS Scrambled Names Gender")
assertEqual(parsedTSScrambledNames.expiryDate, "02/09/2030", "TS Scrambled Names Expiry Date")

// Test Case 11: CONTE appears before Cognome/Nome labels (column-major OCR)
let tsColumnMajorLines = [
    "REPUBBLICA ITALIANA",
    "TESSERA SANITARIA",
    "Codice Fiscale CNTNMR52C44G834U",
    "Sesso F",
    "CONTE",
    "ANNA MARIA",
    "Cognome",
    "Nome",
    "Luogo di nascita",
    "PONTECAGNANO FAIANO",
    "Data di nascita",
    "04/03/1952",
    "Data di scadenza",
    "02/09/2030"
]

let parsedTSColumnMajor = IDParser.parse(lines: tsColumnMajorLines)
assertEqual(parsedTSColumnMajor.surname, "CONTE", "TS Column Major Surname")
assertEqual(parsedTSColumnMajor.name, "ANNA MARIA", "TS Column Major Name")

// Test Case 12: Cognome/Nome values on same line as labels
let tsSameLineNames = [
    "TESSERA SANITARIA",
    "Codice Fiscale CNTNMR52C44G834U",
    "Sesso F",
    "Cognome CONTE",
    "Nome ANNA MARIA",
    "Luogo di nascita PONTECAGNANO FAIANO",
    "Data di nascita 04/03/1952",
    "Data di scadenza 02/09/2030"
]

let parsedTSSameLineNames = IDParser.parse(lines: tsSameLineNames)
assertEqual(parsedTSSameLineNames.surname, "CONTE", "TS Same Line Names Surname")
assertEqual(parsedTSSameLineNames.name, "ANNA MARIA", "TS Same Line Names Name")

// Test Case 13: Spatial column layout — CONTE left of ANNA MARIA but line order scrambled
let tsSpatialItems = [
    OCRTextItem(text: "TESSERA SANITARIA", midX: 0.5, midY: 0.95),
    OCRTextItem(text: "Codice Fiscale CNTNMR52C44G834U", midX: 0.5, midY: 0.88),
    OCRTextItem(text: "Sesso F", midX: 0.5, midY: 0.82),
    OCRTextItem(text: "Cognome", midX: 0.22, midY: 0.76),
    OCRTextItem(text: "Nome", midX: 0.72, midY: 0.76),
    OCRTextItem(text: "ANNA MARIA", midX: 0.74, midY: 0.68),
    OCRTextItem(text: "CONTE", midX: 0.24, midY: 0.67),
    OCRTextItem(text: "Luogo di nascita", midX: 0.5, midY: 0.58),
    OCRTextItem(text: "PONTECAGNANO FAIANO", midX: 0.5, midY: 0.50),
    OCRTextItem(text: "Data di nascita", midX: 0.5, midY: 0.42),
    OCRTextItem(text: "04/03/1952", midX: 0.5, midY: 0.35),
]
let parsedTSSpatial = IDParser.parse(ocrItems: tsSpatialItems)
assertEqual(parsedTSSpatial.surname, "CONTE", "TS Spatial Surname")
assertEqual(parsedTSSpatial.name, "ANNA MARIA", "TS Spatial Name")

// Test Case 14b: Fragmented birthplace near Nome must not override CF-valid names
let tsFragmentedBirthplaceItems = [
    OCRTextItem(text: "TESSERA SANITARIA", midX: 0.5, midY: 0.95),
    OCRTextItem(text: "Codice Fiscale SPSMRA71C05G023H", midX: 0.5, midY: 0.88),
    OCRTextItem(text: "Cognome", midX: 0.22, midY: 0.76),
    OCRTextItem(text: "ESPOSITO", midX: 0.38, midY: 0.68),
    OCRTextItem(text: "Nome", midX: 0.22, midY: 0.68),
    OCRTextItem(text: "O SUL TUSCIANO", midX: 0.38, midY: 0.60),
    OCRTextItem(text: "MARIO", midX: 0.38, midY: 0.52),
    OCRTextItem(text: "Luogo di nascita", midX: 0.22, midY: 0.58),
    OCRTextItem(text: "OLEVANO SUL TUSCIANO SA", midX: 0.38, midY: 0.44),
    OCRTextItem(text: "Data di nascita", midX: 0.22, midY: 0.42),
    OCRTextItem(text: "05/03/1971", midX: 0.38, midY: 0.35),
]
let parsedTSFragmentedBirthplace = IDParser.parse(ocrItems: tsFragmentedBirthplaceItems)
assertEqual(parsedTSFragmentedBirthplace.surname, "ESPOSITO", "Fragmented birthplace keeps surname")
assertEqual(parsedTSFragmentedBirthplace.name, "MARIO", "Fragmented birthplace rejects place fragment as name")
let fragmentedLineName = IDParser.parse(lines: ["Nome O SUL TUSCIANO"]).name
assertTrue(fragmentedLineName == nil || !(fragmentedLineName?.contains("SUL") ?? false), "Line parse rejects place fragment as name")

// Test Case 15: UI panel + card both visible — must pick CF-valid pair (CONTE / ANNA MARIA)
let tsUIPollutionItems = [
    OCRTextItem(text: "Campi Estratti", midX: 0.52, midY: 0.77),
    OCRTextItem(text: "Cognome", midX: 0.58, midY: 0.70),
    OCRTextItem(text: "ANNA MARIA", midX: 0.77, midY: 0.70),
    OCRTextItem(text: "Nome", midX: 0.57, midY: 0.63),
    OCRTextItem(text: "PONTECAGNANO FAIANO", midX: 0.77, midY: 0.63),
    OCRTextItem(text: "Codice Fiscale", midX: 0.58, midY: 0.57),
    OCRTextItem(text: "CNTNMR52C44G834U", midX: 0.77, midY: 0.57),
    OCRTextItem(text: "Cognome", midX: 0.24, midY: 0.38),
    OCRTextItem(text: "CONTE", midX: 0.39, midY: 0.40),
    OCRTextItem(text: "Nome", midX: 0.24, midY: 0.34),
    OCRTextItem(text: "ANNA MARIA", midX: 0.39, midY: 0.35),
    OCRTextItem(text: "Luogo di nascita", midX: 0.24, midY: 0.30),
    OCRTextItem(text: "PONTECAGNANO FAIANO", midX: 0.39, midY: 0.30),
    OCRTextItem(text: "Data di nascita", midX: 0.24, midY: 0.21),
    OCRTextItem(text: "04/03/1952", midX: 0.39, midY: 0.21),
    OCRTextItem(text: "Sesso F", midX: 0.72, midY: 0.46),
]
let parsedTSUIPollution = IDParser.parse(ocrItems: tsUIPollutionItems)
assertEqual(parsedTSUIPollution.surname, "CONTE", "TS UI Pollution Surname")
assertEqual(parsedTSUIPollution.name, "ANNA MARIA", "TS UI Pollution Name")

// Test Case 14: Stacked labels without CONTE in OCR — still fails surname (documents partial case)
let tsNoSurnameLines = [
    "Cognome", "Nome", "ANNA MARIA", "Luogo di nascita", "PONTECAGNANO FAIANO",
    "Codice Fiscale CNTNMR52C44G834U", "Sesso F", "Data di nascita", "04/03/1952",
]
let parsedTSNoSurname = IDParser.parse(lines: tsNoSurnameLines)
assertEqual(parsedTSNoSurname.name, "PONTECAGNANO FAIANO", "TS No Surname OCR Name (known gap)")

// Test Case 16: UI panel visible — spatial fields must come from card, not results panel
assertEqual(parsedTSUIPollution.placeOfBirth, "PONTECAGNANO FAIANO", "TS UI Pollution Place of Birth")
assertEqual(parsedTSUIPollution.dateOfBirth, "04/03/1952", "TS UI Pollution DOB")
assertEqual(parsedTSUIPollution.gender, "F", "TS UI Pollution Gender")

// Test Case 17: Canonicalize aligns parsed values with exact OCR bounding-box text
let canonicalItems = [
    RecognizedItem(text: "ROSSI", boundingBox: CGRect(x: 0.2, y: 0.7, width: 0.1, height: 0.03)),
    RecognizedItem(text: "MARIO", boundingBox: CGRect(x: 0.2, y: 0.6, width: 0.1, height: 0.03)),
]
var canonicalParsed = IDData(documentType: "CIE_FRONT", surname: "ROSSI ", name: "mario", rawText: [])
ScanCaptureLogic.canonicalizeFieldsToOCRItems(&canonicalParsed, items: canonicalItems)
assertEqual(canonicalParsed.surname, "ROSSI", "Canonicalize prefers exact OCR item text")
assertEqual(canonicalParsed.name, "MARIO", "Canonicalize prefers exact OCR item casing")

print("\n=== Running Camera Orientation Unit Tests ===")

assertEqual(
    CameraOrientation.fallbackRotationAngle(traits: CameraOrientation.DeviceTraits(
        isContinuityCamera: true,
        isExternal: false,
        localizedName: "FaceTime HD Camera"
    )),
    180,
    "Continuity camera flag uses 180° fallback"
)
assertEqual(
    CameraOrientation.fallbackRotationAngle(traits: CameraOrientation.DeviceTraits(
        isContinuityCamera: false,
        isExternal: true,
        localizedName: "iPhone Camera"
    )),
    180,
    "External iPhone-named device uses 180° fallback"
)
assertEqual(
    CameraOrientation.fallbackRotationAngle(traits: CameraOrientation.DeviceTraits(
        isContinuityCamera: false,
        isExternal: true,
        localizedName: "iPad Camera"
    )),
    180,
    "External iPad-named device uses 180° fallback"
)
assertEqual(
    CameraOrientation.fallbackRotationAngle(traits: CameraOrientation.DeviceTraits(
        isContinuityCamera: false,
        isExternal: false,
        localizedName: "FaceTime HD Camera"
    )),
    0,
    "Built-in webcam keeps 0° fallback"
)
assertEqual(CameraOrientation.fallbackRotationAngle(for: nil), 0, "Nil device keeps 0° fallback")
assertTrue(CameraOrientation.looksLikeContinuityCameraName("Mark's iPhone Camera"), "iPhone name hint")
assertTrue(!CameraOrientation.looksLikeContinuityCameraName("Logitech BRIO"), "Non-continuity name hint")

assertOrientation(CameraOrientation.visionOrientation(for: 0), .up, "Vision orientation 0°")
assertOrientation(CameraOrientation.visionOrientation(for: 90), .right, "Vision orientation 90°")
assertOrientation(CameraOrientation.visionOrientation(for: 180), .down, "Vision orientation 180°")
assertOrientation(CameraOrientation.visionOrientation(for: 270), .left, "Vision orientation 270°")
assertOrientation(CameraOrientation.visionOrientation(for: -90), .left, "Vision orientation -90°")
assertOrientation(CameraOrientation.visionOrientation(for: 450), .right, "Vision orientation wraps 450° to 90°")
assertOrientation(
    CameraOrientation.visionOrientationForOCR(baseCaptureAngle: 180),
    .down,
    "OCR orientation uses horizon capture angle without document offset"
)
let landscapeTestImage = CIImage(color: CIColor(red: 1, green: 1, blue: 1))
    .cropped(to: CGRect(x: 0, y: 0, width: 40, height: 20))
let displayOrientedImage = CameraOrientation.orientedCIImage(landscapeTestImage, orientation: .right)
assertEqual(displayOrientedImage.extent.width, 20, "Display orientation rotates capture width")
assertEqual(displayOrientedImage.extent.height, 40, "Display orientation rotates capture height")
let continuityTraits = CameraOrientation.DeviceTraits(
    isContinuityCamera: true,
    isExternal: false,
    localizedName: "iPhone Camera"
)
let builtInTraits = CameraOrientation.DeviceTraits(
    isContinuityCamera: false,
    isExternal: false,
    localizedName: "FaceTime HD Camera"
)

assertEqual(
    CameraOrientation.resolveScanRotationAngle(baseAngle: 0, traits: continuityTraits),
    90,
    "Continuity camera adds 90° document-scan offset to horizon rotation"
)
assertEqual(
    CameraOrientation.resolveScanRotationAngle(baseAngle: 180, traits: continuityTraits),
    270,
    "Continuity camera offset wraps with 180° horizon rotation"
)
assertEqual(
    CameraOrientation.resolveScanRotationAngle(baseAngle: 0, traits: builtInTraits),
    0,
    "Built-in webcam keeps horizon rotation without offset"
)
assertEqual(
    CameraOrientation.normalizeRotationAngle(-90),
    270,
    "Rotation angle normalization wraps negatives"
)

print("\n=== Running Capture Auto Zoom Unit Tests ===")

let cardFieldItems = [
    makeItem("Cognome", x: 0.20, y: 0.75),
    makeItem("CONTE", x: 0.35, y: 0.75),
    makeItem("Nome", x: 0.20, y: 0.68),
    makeItem("ANNA MARIA", x: 0.35, y: 0.68),
    makeItem("Codice Fiscale", x: 0.20, y: 0.60),
    makeItem("CNTNMR52C44G834U", x: 0.40, y: 0.60),
]
guard let cardBounds = CaptureAutoZoom.normalizedCardBounds(from: cardFieldItems) else {
    print("❌ FAIL: normalizedCardBounds returns a crop rect")
    fatalError()
}
print("✅ PASS: normalizedCardBounds returns a crop rect")
assertTrue(cardBounds.width > 0.25, "Card bounds span most of the card width")
assertTrue(cardBounds.height > 0.12, "Card bounds include card height")
assertTrue(cardBounds.minX >= 0 && cardBounds.maxY <= 1.001, "Card bounds stay inside image")

let emptyBounds = CaptureAutoZoom.normalizedCardBounds(from: [])
assertTrue(emptyBounds == nil, "Empty OCR items produce no crop bounds")

let detectedCard = CGRect(x: 0.12, y: 0.18, width: 0.76, height: 0.48)
let mergedBounds = CaptureAutoZoom.mergedCardBounds(from: cardFieldItems, rectangle: detectedCard)
assertTrue((mergedBounds?.width ?? 0) >= 0.5, "Merged bounds include detected card rectangle")
assertTrue((mergedBounds?.height ?? 0) >= 0.3, "Merged bounds include card height")

let noisyBackgroundItems = cardFieldItems + [
    makeItem("wood grain noise", x: 0.02, y: 0.02),
    makeItem("table texture", x: 0.95, y: 0.05),
]
let filteredBoundsItems = CaptureAutoZoom.cardBoundsItems(from: noisyBackgroundItems)
assertTrue(filteredBoundsItems.count < noisyBackgroundItems.count, "cardBoundsItems filters background OCR noise")

let oversizedItems = (0..<20).map { makeItem("noise\($0)", x: CGFloat($0) * 0.04, y: 0.05) }
let oversizedMerge = CaptureAutoZoom.mergedCardBounds(from: oversizedItems, rectangle: detectedCard)
assertTrue(abs((oversizedMerge?.width ?? 0) - detectedCard.width) < 0.02, "Oversized OCR spread falls back to detected rectangle width")

let mappedPoint = ScanCaptureLogic.imagePoint(
    for: CGPoint(x: 0.25, y: 0.75),
    imageSize: CGSize(width: 400, height: 300)
)
assertEqual(mappedPoint.x, 100, "Normalized rectangle x maps to image pixels")
assertEqual(mappedPoint.y, 225, "Normalized rectangle y maps to image pixels")

let testCGImage = makeSolidCGImage(width: 400, height: 300)
let tiltedGeometry = DetectedCardGeometry(
    boundingBox: CGRect(x: 0.18, y: 0.18, width: 0.68, height: 0.58),
    topLeft: CGPoint(x: 0.20, y: 0.78),
    topRight: CGPoint(x: 0.84, y: 0.70),
    bottomLeft: CGPoint(x: 0.18, y: 0.24),
    bottomRight: CGPoint(x: 0.86, y: 0.18),
    confidence: 0.9
)
let correctedCardImage = ScanCaptureLogic.perspectiveCorrectImageToCard(
    cgImage: testCGImage,
    geometry: tiltedGeometry
)
assertTrue(correctedCardImage != nil, "Perspective correction returns an image for a tilted card")
assertTrue((correctedCardImage?.size.width ?? 0) >= 80, "Perspective-corrected image keeps usable width")
assertTrue((correctedCardImage?.size.height ?? 0) >= 80, "Perspective-corrected image keeps usable height")

assertTrue(!CaptureDetection.textsMatch("ESPOSITO", "ARIO"), "TextsMatch rejects ARIO inside ESPOSITO")
assertTrue(CaptureDetection.textsMatch("ESPOSITO", "ESPOSITO"), "TextsMatch keeps exact matches")
assertTrue(CaptureDetection.textsMatch("MARIO", "mario"), "TextsMatch keeps case-insensitive matches")

let noisyTSLines = [
    "Codice Fiscale SPSMRA71C05G023H",
    "Cognome ESPOSITO",
    "Nome MARIO",
    "Data di nascita 05/03/1971",
    "Luogo di nascita OLEVANO SUL TUSCIANO SA",
]
var noisyParsed = IDParser.parse(lines: noisyTSLines)
assertEqual(noisyParsed.surname, "ESPOSITO", "Sanitize keeps valid surname from labeled line")
assertEqual(noisyParsed.name, "MARIO", "Sanitize keeps valid name from labeled line")

// Test Case 18: Spatial OCR must not assign card headers to Nome or surname to Luogo
let espositoSpatialTrapItems = [
    OCRTextItem(text: "TESSERA SANITARIA", midX: 0.5, midY: 0.92),
    OCRTextItem(text: "REPUBBLICA ITALIANA", midX: 0.5, midY: 0.88),
    OCRTextItem(text: "Codice Fiscale SPSMRA71C05E632H", midX: 0.55, midY: 0.78),
    OCRTextItem(text: "Cognome", midX: 0.35, midY: 0.70),
    OCRTextItem(text: "ESPOSITO", midX: 0.55, midY: 0.70),
    OCRTextItem(text: "Nome", midX: 0.35, midY: 0.62),
    OCRTextItem(text: "REPUBBLICA ITALIANA", midX: 0.55, midY: 0.62),
    OCRTextItem(text: "MARIO", midX: 0.55, midY: 0.54),
    OCRTextItem(text: "Data di nascita", midX: 0.35, midY: 0.50),
    OCRTextItem(text: "05/03/1971", midX: 0.55, midY: 0.50),
    OCRTextItem(text: "Luogo di nascita", midX: 0.35, midY: 0.42),
    OCRTextItem(text: "OLEVANO SUL TUSCIANO SA", midX: 0.55, midY: 0.42),
    OCRTextItem(text: "Scadenza 07/07/2031", midX: 0.55, midY: 0.34),
]
let espositoSpatialTrapParsed = IDParser.parse(ocrItems: espositoSpatialTrapItems)
assertEqual(espositoSpatialTrapParsed.surname, "ESPOSITO", "Spatial trap keeps surname")
assertEqual(espositoSpatialTrapParsed.name, "MARIO", "Spatial trap rejects header as Nome")
assertTrue(
    espositoSpatialTrapParsed.placeOfBirth?.contains("OLEVANO") ?? false,
    "Spatial trap keeps birthplace instead of surname"
)
assertTrue(IDParser.parseQualityScore(espositoSpatialTrapParsed) >= 10, "CF-valid parse scores highly")
assertEqual(noisyParsed.codiceFiscale, "SPSMRA71C05G023H", "Sanitize extracts codice fiscale without label prefix")
assertEqual(noisyParsed.dateOfBirth, "05/03/1971", "Sanitize extracts birth date without label prefix")

let edgeCaseLines = ["", "Cognome", "Nome", "SA", "M"]
let edgeParsed = IDParser.parse(lines: edgeCaseLines)
assertTrue(edgeParsed.documentType == "UNKNOWN" || edgeParsed.documentType != "", "Edge-case lines do not crash parser")

print("\n=== Running OCR Fixture Image Tests ===")

let ocrFixtures = [
    RenderedOCRFixture(
        name: "Synthetic Tessera front",
        image: makeOCRFixtureImage(lines: [
            "REPUBBLICA ITALIANA",
            "SERVIZIO SANITARIO NAZIONALE",
            "TESSERA SANITARIA",
            "COGNOME ROSSI",
            "NOME MARIA",
            "DATA DI NASCITA 24/12/1995",
            "LUOGO DI NASCITA MILANO",
            "CODICE FISCALE RSSMRA95T64F205W",
            "SCADENZA 24/12/2029",
        ]),
        expected: IDData(
            documentType: "TESSERA_SANITARIA_FRONT",
            surname: "ROSSI",
            name: "MARIA",
            codiceFiscale: "RSSMRA95T64F205W",
            documentNumber: nil,
            dateOfBirth: "24/12/1995",
            placeOfBirth: "MILANO",
            gender: nil,
            expiryDate: "24/12/2029",
            nationality: nil,
            cardNumber: nil,
            rawText: []
        )
    ),
    RenderedOCRFixture(
        name: "Synthetic CIE front",
        image: makeOCRFixtureImage(lines: [
            "REPUBBLICA ITALIANA",
            "CARTA DI IDENTITA",
            "DOCUMENTO NUMERO CA12345AA",
            "COGNOME ROSSI",
            "NOME MARIO",
            "LUOGO E DATA DI NASCITA ROMA 15/08/1990",
            "SESSO M",
            "CITTADINANZA ITA",
            "CODICE FISCALE RSSMRA90A15H501Y",
            "SCADENZA 15/08/2030",
        ]),
        expected: IDData(
            documentType: "CIE_FRONT",
            surname: "ROSSI",
            name: "MARIO",
            codiceFiscale: "RSSMRA90A15H501Y",
            documentNumber: "CA12345AA",
            dateOfBirth: "15/08/1990",
            placeOfBirth: "ROMA",
            gender: "M",
            expiryDate: "15/08/2030",
            nationality: "ITA",
            cardNumber: nil,
            rawText: []
        )
    ),
]
ocrFixtures.forEach(runOCRFixture)

print("\n=== Running Real Image OCR Fixture Corpus ===")
runRealImageFixtureCorpus()

print("\n=== Running Frame Quality Unit Tests ===")

let sharpBuffer = makeBGRAPixelBuffer(width: 64, height: 64) { x, y in
    ((x / 4) + (y / 4)).isMultiple(of: 2) ? 40 : 210
}
let sharpQuality = IDScanner.assessFrameQuality(sharpBuffer)
assertTrue(sharpQuality.isUsableForCapture, "Sharp balanced frame is usable")

let flatBuffer = makeBGRAPixelBuffer(width: 64, height: 64) { _, _ in 128 }
let flatQuality = IDScanner.assessFrameQuality(flatBuffer)
assertTrue(!flatQuality.isUsableForCapture, "Flat low-edge frame is rejected as blur-like")

let glareBuffer = makeBGRAPixelBuffer(width: 64, height: 64) { x, y in
    x < 48 && y < 48 ? 255 : 120
}
let glareQuality = IDScanner.assessFrameQuality(glareBuffer)
assertTrue(!glareQuality.isUsableForCapture, "Glare-heavy frame is rejected")
assertTrue(glareQuality.failureReasons.contains("glare"), "Glare-heavy frame reports glare reason")

let sharpCGImageQuality = IDScanner.assessFrameQuality(makeCheckerCGImage(width: 64, height: 64))
assertTrue(sharpCGImageQuality.isUsableForCapture, "Sharp balanced CGImage is usable")
assertTrue(sharpCGImageQuality.failureReasons.isEmpty, "Sharp balanced CGImage has no quality failure reasons")

let glareCGImageQuality = IDScanner.assessFrameQuality(makeFlatCGImage(width: 64, height: 64, white: 1.0))
assertTrue(!glareCGImageQuality.isUsableForCapture, "Glare-heavy CGImage is rejected")
assertTrue(glareCGImageQuality.diagnosticSummary.contains("rejected"), "Rejected CGImage includes diagnostic summary")

print("\n=== Running Scan Capture Logic Unit Tests ===")

let unorderedItems = [
    makeItem("B", x: 0.70, y: 0.50),
    makeItem("A", x: 0.20, y: 0.50),
    makeItem("C", x: 0.45, y: 0.80),
]
let sortedItems = ScanCaptureLogic.sortedRecognizedItems(unorderedItems)
assertEqual(sortedItems.map(\.text).joined(separator: ","), "C,A,B", "sortedRecognizedItems orders top-to-bottom then left-to-right")

let unknownParsed = IDData(documentType: "UNKNOWN", rawText: [])
assertTrue(!ScanCaptureLogic.shouldAcceptCapture(unknownParsed), "UNKNOWN without fields is rejected")

let liveKeywordItems = [
    makeItem("TESSERA SANITARIA", x: 0.5, y: 0.9),
    makeItem("Cognome", x: 0.2, y: 0.7),
    makeItem("Nome", x: 0.2, y: 0.6),
    makeItem("noise", x: 0.1, y: 0.1),
]
assertTrue(
    !ScanCaptureLogic.shouldAcceptLiveFrame(parsed: unknownParsed, items: liveKeywordItems),
    "Live frame rejects labels without identity evidence"
)
assertTrue(
    !ScanCaptureLogic.shouldAcceptLiveFrame(parsed: unknownParsed, items: [makeItem("x", x: 0.1, y: 0.1)]),
    "Live frame rejects sparse unrelated OCR"
)

var surnameOnly = IDData(documentType: "UNKNOWN", rawText: [])
surnameOnly.surname = "ROSSI"
assertTrue(!ScanCaptureLogic.shouldAcceptCapture(surnameOnly), "Surname alone is rejected")

var typedParsed = IDData(documentType: "CIE_FRONT", rawText: [])
assertTrue(!ScanCaptureLogic.shouldAcceptCapture(typedParsed), "Known document type without fields is rejected")

var reliableParsed = IDData(documentType: "TESSERA_SANITARIA_FRONT", rawText: [])
reliableParsed.codiceFiscale = "RSSMRA90A15H501Y"
reliableParsed.surname = "ROSSI"
reliableParsed.name = "MARIO"
assertTrue(ScanCaptureLogic.shouldAcceptCapture(reliableParsed), "CF plus identity fields is accepted")
let coherentIdentityItems = [
    makeItem("TESSERA SANITARIA", x: 0.25, y: 0.78),
    makeItem("Cognome", x: 0.20, y: 0.66),
    makeItem("ROSSI", x: 0.42, y: 0.66),
    makeItem("Nome", x: 0.20, y: 0.56),
    makeItem("MARIO", x: 0.42, y: 0.56),
    makeItem("RSSMRA90A15H501Y", x: 0.34, y: 0.46),
]
assertTrue(
    ScanCaptureLogic.shouldAcceptLiveFrame(parsed: reliableParsed, items: coherentIdentityItems),
    "Live frame accepts strong identity only when OCR layout is card-like"
)
let scatteredIdentityItems = [
    makeItem("TESSERA SANITARIA", x: 0.02, y: 0.92),
    makeItem("Cognome", x: 0.78, y: 0.08),
    makeItem("ROSSI", x: 0.06, y: 0.12),
    makeItem("Nome", x: 0.74, y: 0.84),
    makeItem("MARIO", x: 0.36, y: 0.03),
    makeItem("RSSMRA90A15H501Y", x: 0.70, y: 0.48),
]
assertTrue(
    !ScanCaptureLogic.shouldAcceptLiveFrame(parsed: reliableParsed, items: scatteredIdentityItems),
    "Live frame rejects strong identity when OCR layout is scattered"
)

let lowConfidenceIdentityItems = [
    makeItem("TESSERA SANITARIA", x: 0.5, y: 0.9, confidence: 0.2),
    makeItem("Cognome", x: 0.2, y: 0.7, confidence: 0.2),
    makeItem("ROSSI", x: 0.4, y: 0.7, confidence: 0.2),
    makeItem("Nome", x: 0.2, y: 0.6, confidence: 0.2),
    makeItem("MARIO", x: 0.4, y: 0.6, confidence: 0.2),
    makeItem("RSSMRA90A15H501Y", x: 0.4, y: 0.5, confidence: 0.2),
]
assertTrue(
    !ScanCaptureLogic.shouldAcceptLiveFrame(parsed: reliableParsed, items: lowConfidenceIdentityItems),
    "Live frame rejects low-confidence OCR"
)
assertTrue(
    !ScanCaptureLogic.shouldAcceptLiveFrame(
        parsed: reliableParsed,
        items: [
            makeItem("TESSERA SANITARIA", x: 0.5, y: 0.9),
            makeItem("Cognome", x: 0.2, y: 0.7),
            makeItem("ROSSI", x: 0.4, y: 0.7),
            makeItem("Nome", x: 0.2, y: 0.6),
            makeItem("MARIO", x: 0.4, y: 0.6),
            makeItem("RSSMRA90A15H501Y", x: 0.4, y: 0.5),
        ],
        frameQuality: flatQuality
    ),
    "Live frame rejects unusable image quality even with strong OCR fields"
)

assertEqual(ScanCaptureLogic.scanFeedbackKey(for: unknownParsed, itemCount: 2), "scan_status_move_closer", "Few OCR items suggest move closer")
assertEqual(ScanCaptureLogic.scanFeedbackKey(for: unknownParsed, itemCount: 5), "scan_status_align_document", "Unknown document suggests alignment")
var partialParsed = IDData(documentType: "CIE_FRONT", rawText: [])
assertEqual(ScanCaptureLogic.scanFeedbackKey(for: partialParsed, itemCount: 6), "scan_status_need_identity", "Missing identity fields feedback")
partialParsed.documentNumber = "CA12345AA"
assertEqual(ScanCaptureLogic.scanFeedbackKey(for: partialParsed, itemCount: 6), "scan_status_need_identity", "Document number without identity still needs identity")
partialParsed.surname = "ROSSI"
assertEqual(ScanCaptureLogic.scanFeedbackKey(for: partialParsed, itemCount: 6), "scan_status_reading_fields", "Partial identity feedback")

let fallbackItems = [makeItem("fallback", x: 0.5, y: 0.5)]
let fallbackParsed = IDData(documentType: "UNKNOWN", rawText: ["fallback"])
var freshParsed = IDData(documentType: "UNKNOWN", rawText: [])
freshParsed.codiceFiscale = "RSSMRA90A15H501Y"
let freshItems = [makeItem("RSSMRA90A15H501Y", x: 0.5, y: 0.5)]
let accepted = ScanCaptureLogic.selectCaptureResults(
    freshParsed: freshParsed,
    freshItems: freshItems,
    fallbackItems: fallbackItems,
    fallbackParsed: fallbackParsed
)
assertEqual(accepted.parsed.codiceFiscale, "RSSMRA90A15H501Y", "selectCaptureResults prefers accepted fresh parse")
assertEqual(accepted.items.first?.text, "RSSMRA90A15H501Y", "selectCaptureResults keeps fresh items when accepted")

var badFresh = IDData(documentType: "TESSERA_SANITARIA_FRONT", rawText: [])
badFresh.surname = "ESPOSITO"
badFresh.name = "REPUBBLICA ITALIANA"
badFresh.codiceFiscale = "SPSMRA71C05E632H"
var goodFallback = IDData(documentType: "TESSERA_SANITARIA_FRONT", rawText: [])
goodFallback.surname = "ESPOSITO"
goodFallback.name = "MARIO"
goodFallback.codiceFiscale = "SPSMRA71C05E632H"
let qualityPick = ScanCaptureLogic.selectCaptureResults(
    freshParsed: badFresh,
    freshItems: [makeItem("REPUBBLICA ITALIANA", x: 0.5, y: 0.5)],
    fallbackItems: [makeItem("MARIO", x: 0.5, y: 0.5)],
    fallbackParsed: goodFallback
)
assertEqual(qualityPick.parsed.name, "MARIO", "selectCaptureResults prefers CF-valid fallback over bad fresh parse")

let rejectedFresh = IDData(documentType: "UNKNOWN", rawText: [])
let rejected = ScanCaptureLogic.selectCaptureResults(
    freshParsed: rejectedFresh,
    freshItems: [makeItem("noise", x: 0.1, y: 0.1)],
    fallbackItems: fallbackItems,
    fallbackParsed: fallbackParsed
)
assertEqual(rejected.items.first?.text, "fallback", "selectCaptureResults falls back when fresh parse rejected")

print("\n=== Running Live Scan Controller Unit Tests ===")

let liveScanSemaphore = DispatchSemaphore(value: 0)
Task { @MainActor in
    let controller = LiveScanController()
    controller.processFrame(
        sortedItems: [],
        frameQuality: .good,
        autoCountdown: false,
        onScanSound: {},
        onCountdownBeep: {},
        onFinalize: { _ in }
    )
    assertEqual(controller.captureState, .idle, "Empty frame keeps live scan idle")
    assertEqual(controller.feedbackKey, "scan_status_waiting", "Empty frame shows waiting feedback")

    controller.reset()
    let readyItems = [
        makeItem("REPUBBLICA ITALIANA", x: 0.5, y: 0.9),
        makeItem("CARTA DI IDENTITÀ", x: 0.5, y: 0.82),
        makeItem("Cognome / Surname", x: 0.2, y: 0.7),
        makeItem("ROSSI", x: 0.2, y: 0.62),
        makeItem("Nome / Name", x: 0.7, y: 0.7),
        makeItem("MARIO", x: 0.7, y: 0.62),
        makeItem("Codice Fiscale", x: 0.2, y: 0.52),
        makeItem("RSSMRA90A15H501Y", x: 0.7, y: 0.52),
    ]
    var finalized = false
    controller.processFrame(
        sortedItems: readyItems,
        frameQuality: .good,
        autoCountdown: false,
        onScanSound: {},
        onCountdownBeep: {},
        onFinalize: { _ in finalized = true }
    )
    assertEqual(controller.captureState, .scanning, "First ready frame keeps scanning")
    assertTrue(!finalized, "First ready frame does not finalize")
    controller.processFrame(
        sortedItems: readyItems,
        frameQuality: .good,
        autoCountdown: false,
        onScanSound: {},
        onCountdownBeep: {},
        onFinalize: { _ in finalized = true }
    )
    assertEqual(controller.captureState, .captured, "Second ready frame finalizes without countdown")
    assertTrue(finalized, "Ready frame invokes finalize callback")
    assertEqual(controller.feedbackKey, "scan_status_captured", "Captured feedback after finalize")

    let scanningController = LiveScanController()
    let sparseItems = [
        makeItem("noise", x: 0.1, y: 0.1),
        makeItem("more", x: 0.2, y: 0.2),
        makeItem("text", x: 0.3, y: 0.3),
    ]
    scanningController.processFrame(
        sortedItems: sparseItems,
        frameQuality: .good,
        autoCountdown: false,
        onScanSound: {},
        onCountdownBeep: {},
        onFinalize: { _ in }
    )
    assertEqual(scanningController.captureState, .scanning, "Unreadable text keeps scanning state")
    assertEqual(scanningController.feedbackKey, "scan_status_align_document", "Unreadable text alignment feedback")

    liveScanSemaphore.signal()
}
while liveScanSemaphore.wait(timeout: .now() + 0.05) == .timedOut {
    RunLoop.current.run(mode: .default, before: Date(timeIntervalSinceNow: 0.05))
}

if verificationFailures > 0 {
    print("\n=== Verification Failed: \(verificationFailures) failure(s) ===")
    exit(1)
}

print("\n=== Verification Complete ===")
EOF

# Compile
swiftc Parser.swift BelfioreCodes.swift Scanner.swift ScanCaptureLogic.swift LiveScanController.swift main.swift -o test_runner

# Run
./test_runner

# Clean up
rm -f test_runner main.swift
