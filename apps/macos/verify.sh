#!/bin/bash
# CI: GitHub Actions runs this via .github/workflows/macos-verify.yml (and scanid-release.yml).
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERIFY_TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/scanid-verify.XXXXXX")"
TEST_MAIN="$VERIFY_TMP_DIR/main.swift"
TEST_RUNNER="$VERIFY_TMP_DIR/test_runner"

cleanup() {
    rm -rf "$VERIFY_TMP_DIR"
}

trap cleanup EXIT

cat << 'EOF' > "$TEST_MAIN"
import Foundation
import AppKit
import CoreGraphics
import CoreImage
import ImageIO
import AVFoundation
import Vision

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
    let image: String?
    let replayOnly: Bool
    let expect: FixtureExpectation
    let quality: FixtureQualityExpectation
    let ocrProvider: String?
    let captureSource: FixtureCaptureSource
    let documentSide: FixtureDocumentSide
    let condition: String
    let matrixTarget: String?
    let orientation: FixtureOrientationMetadata?
    let diagnostics: FixtureDiagnosticsMetadata?
    let observed: FixtureExpectedData?
    let observedItems: [FixtureRecognizedItemMetadata]?
    let observedBarcodes: [FixtureBarcodeMetadata]
    let expected: FixtureExpectedData?

    enum CodingKeys: String, CodingKey {
        case name
        case image
        case replayOnly
        case expect
        case quality
        case ocrProvider
        case captureSource
        case documentSide
        case condition
        case matrixTarget
        case orientation
        case diagnostics
        case observed
        case observedItems
        case observedBarcodes
        case expected
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        name = try container.decode(String.self, forKey: .name)
        image = try container.decodeIfPresent(String.self, forKey: .image)
        replayOnly = try container.decodeIfPresent(Bool.self, forKey: .replayOnly) ?? false
        expect = try container.decodeIfPresent(FixtureExpectation.self, forKey: .expect) ?? .accept
        quality = try container.decodeIfPresent(FixtureQualityExpectation.self, forKey: .quality)
            ?? (expect == .accept ? .usable : .ignore)
        ocrProvider = try container.decodeIfPresent(String.self, forKey: .ocrProvider)
        captureSource = try container.decodeIfPresent(FixtureCaptureSource.self, forKey: .captureSource) ?? .unknown
        documentSide = try container.decodeIfPresent(FixtureDocumentSide.self, forKey: .documentSide) ?? .unknown
        condition = try container.decodeIfPresent(String.self, forKey: .condition) ?? "unspecified"
        matrixTarget = try container.decodeIfPresent(String.self, forKey: .matrixTarget)
        orientation = try container.decodeIfPresent(FixtureOrientationMetadata.self, forKey: .orientation)
        diagnostics = try container.decodeIfPresent(FixtureDiagnosticsMetadata.self, forKey: .diagnostics)
        observed = try container.decodeIfPresent(FixtureExpectedData.self, forKey: .observed)
        observedItems = try container.decodeIfPresent([FixtureRecognizedItemMetadata].self, forKey: .observedItems)
        observedBarcodes = try container.decodeIfPresent([FixtureBarcodeMetadata].self, forKey: .observedBarcodes) ?? []
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

    var hasSafeRelativeImagePath: Bool {
        guard let image else { return replayOnly }
        let trimmed = image.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !trimmed.hasPrefix("/") else {
            return false
        }
        return !trimmed.split(separator: "/").contains("..")
    }
}

struct FixtureOrientationMetadata: Decodable {
    let ocrVisionOrientation: String
    let snapshotDisplayOrientation: String
    let basePreviewRotationAngle: Double?
    let scanPreviewRotationAngle: Double?
    let baseCaptureRotationAngle: Double
    let scanCaptureRotationAngle: Double
    let rawImageWidth: Int?
    let rawImageHeight: Int?
    let imageWidth: Int
    let imageHeight: Int

    var hasPositiveImageDimensions: Bool {
        imageWidth > 0 && imageHeight > 0
    }

    var hasPositiveRawImageDimensions: Bool {
        guard let rawImageWidth, let rawImageHeight else { return true }
        return rawImageWidth > 0 && rawImageHeight > 0
    }

    func agreesWithAngles(captureSource: FixtureCaptureSource) -> Bool {
        guard let basePreviewRotationAngle, let scanPreviewRotationAngle else { return false }
        let expectedOCR = CameraOrientation.orientationName(
            CameraOrientation.visionOrientationForOCR(baseCaptureAngle: CGFloat(baseCaptureRotationAngle))
        )
        let expectedPreviewAngle = CameraOrientation.resolveScanRotationAngle(
            baseAngle: CGFloat(basePreviewRotationAngle),
            traits: CameraOrientation.DeviceTraits(
                isContinuityCamera: captureSource == .continuity,
                isExternal: captureSource == .continuity,
                localizedName: captureSource == .continuity ? "iPhone Camera" : "FaceTime HD Camera"
            )
        )
        let expectedCaptureAngle = CameraOrientation.resolveScanRotationAngle(
            baseAngle: CGFloat(baseCaptureRotationAngle),
            traits: CameraOrientation.DeviceTraits(
                isContinuityCamera: captureSource == .continuity,
                isExternal: captureSource == .continuity,
                localizedName: captureSource == .continuity ? "iPhone Camera" : "FaceTime HD Camera"
            )
        )
        let expectedSnapshot = CameraOrientation.orientationName(
            CameraOrientation.visionOrientation(for: CGFloat(scanPreviewRotationAngle))
        )
        return CameraOrientation.normalizeRotationAngle(CGFloat(scanPreviewRotationAngle)) == expectedPreviewAngle
            && CameraOrientation.normalizeRotationAngle(CGFloat(scanCaptureRotationAngle)) == expectedCaptureAngle
            && ocrVisionOrientation == expectedOCR
            && snapshotDisplayOrientation == expectedSnapshot
    }

    var displayDimensionsMatchRawImage: Bool {
        guard let rawImageWidth, let rawImageHeight else { return true }
        switch snapshotDisplayOrientation {
        case "left", "leftMirrored", "right", "rightMirrored":
            return imageWidth == rawImageHeight && imageHeight == rawImageWidth
        case "up", "upMirrored", "down", "downMirrored":
            return imageWidth == rawImageWidth && imageHeight == rawImageHeight
        default:
            return false
        }
    }
}

struct FixtureDiagnosticsMetadata: Decodable {
    let frameQuality: String
    let frameQualityMetrics: FixtureFrameQualityMetrics?
    let canCapture: Bool
    let canGuideLiveScan: Bool
    let score: Int
    let markerCount: Int
    let itemCount: Int
    let missingFrontNames: Bool
    let reasons: [String]?
}

struct FixtureFrameQualityMetrics: Decodable {
    let sharpness: Double
    let glareRatio: Double
    let darkRatio: Double
    let meanLuma: Double
    let usable: Bool
    let failureReasons: [String]

    var isComplete: Bool {
        [sharpness, glareRatio, darkRatio, meanLuma].allSatisfy(\.isFinite)
            && sharpness >= 0
            && glareRatio >= 0
            && glareRatio <= 1
            && darkRatio >= 0
            && darkRatio <= 1
            && meanLuma >= 0
            && meanLuma <= 255
    }

    var captureFrameQuality: CaptureFrameQuality {
        CaptureFrameQuality(
            sharpness: sharpness,
            glareRatio: glareRatio,
            darkRatio: darkRatio,
            meanLuma: meanLuma
        )
    }

    func matches(_ quality: CaptureFrameQuality) -> Bool {
        abs(sharpness - quality.sharpness) <= 0.01
            && abs(glareRatio - quality.glareRatio) <= 0.001
            && abs(darkRatio - quality.darkRatio) <= 0.001
            && abs(meanLuma - quality.meanLuma) <= 0.1
            && usable == quality.isUsableForCapture
            && failureReasons == quality.failureReasons
    }
}

extension FixtureExpectedData {
    var observedFrontMissingNames: Bool {
        guard ["CIE_FRONT", "TESSERA_SANITARIA_FRONT"].contains(documentType) else {
            return false
        }
        guard surname == nil || name == nil else {
            return false
        }
        return codiceFiscale != nil || dateOfBirth != nil || gender != nil
    }

    func mismatchedFields(comparedTo data: IDData) -> [String] {
        var fields: [String] = []
        if documentType != data.documentType { fields.append("documentType") }
        if surname != data.surname { fields.append("surname") }
        if name != data.name { fields.append("name") }
        if codiceFiscale != data.codiceFiscale { fields.append("codiceFiscale") }
        if documentNumber != data.documentNumber { fields.append("documentNumber") }
        if dateOfBirth != data.dateOfBirth { fields.append("dateOfBirth") }
        if placeOfBirth != data.placeOfBirth { fields.append("placeOfBirth") }
        if gender != data.gender { fields.append("gender") }
        if expiryDate != data.expiryDate { fields.append("expiryDate") }
        if nationality != data.nationality { fields.append("nationality") }
        if cardNumber != data.cardNumber { fields.append("cardNumber") }
        return fields
    }
}

struct FixtureRecognizedItemMetadata: Decodable {
    let text: String
    let confidence: Float
    let boundingBox: FixtureBoundingBoxMetadata
    let imageBounds: FixtureImageBoundsMetadata?

    var recognizedItem: RecognizedItem {
        RecognizedItem(
            text: text,
            boundingBox: CGRect(
                x: CGFloat(boundingBox.x),
                y: CGFloat(boundingBox.y),
                width: CGFloat(boundingBox.width),
                height: CGFloat(boundingBox.height)
            ),
            confidence: confidence
        )
    }

    func imageBoundsMatch(imageWidth: Int, imageHeight: Int) -> Bool {
        guard let imageBounds, imageBounds.isValid(imageWidth: imageWidth, imageHeight: imageHeight) else {
            return false
        }
        let expected = CGRect(
            x: boundingBox.x * Double(imageWidth),
            y: (1 - boundingBox.y - boundingBox.height) * Double(imageHeight),
            width: boundingBox.width * Double(imageWidth),
            height: boundingBox.height * Double(imageHeight)
        )
        return imageBounds.matches(expected, tolerance: 1.0)
    }

    var isComplete: Bool {
        !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && confidence.isFinite
            && confidence >= 0
            && confidence <= 1
            && boundingBox.isNormalized
    }
}

struct FixtureBarcodeMetadata: Decodable {
    let payload: String
    let confidence: Float
    let boundingBox: FixtureBoundingBoxMetadata
    let imageBounds: FixtureImageBoundsMetadata?

    var isComplete: Bool {
        !payload.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && confidence.isFinite
            && confidence >= 0
            && confidence <= 1
            && boundingBox.isNormalized
    }

    func imageBoundsMatch(imageWidth: Int, imageHeight: Int) -> Bool {
        guard let imageBounds, imageBounds.isValid(imageWidth: imageWidth, imageHeight: imageHeight) else {
            return false
        }
        let expected = CGRect(
            x: boundingBox.x * Double(imageWidth),
            y: (1 - boundingBox.y - boundingBox.height) * Double(imageHeight),
            width: boundingBox.width * Double(imageWidth),
            height: boundingBox.height * Double(imageHeight)
        )
        return imageBounds.matches(expected, tolerance: 1.0)
    }
}

struct FixtureImageBoundsMetadata: Decodable {
    let x: Double
    let y: Double
    let width: Double
    let height: Double

    func isValid(imageWidth: Int, imageHeight: Int) -> Bool {
        [x, y, width, height].allSatisfy(\.isFinite)
            && x >= 0
            && y >= 0
            && width > 0
            && height > 0
            && x + width <= Double(imageWidth) + 1.0
            && y + height <= Double(imageHeight) + 1.0
    }

    func matches(_ rect: CGRect, tolerance: Double) -> Bool {
        abs(x - Double(rect.origin.x)) <= tolerance
            && abs(y - Double(rect.origin.y)) <= tolerance
            && abs(width - Double(rect.width)) <= tolerance
            && abs(height - Double(rect.height)) <= tolerance
    }
}

struct FixtureBoundingBoxMetadata: Decodable {
    let x: Double
    let y: Double
    let width: Double
    let height: Double

    var isNormalized: Bool {
        [x, y, width, height].allSatisfy(\.isFinite)
            && x >= 0
            && y >= 0
            && width > 0
            && height > 0
            && x + width <= 1
            && y + height <= 1
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

extension FixtureDocumentSide {
    init?(documentType: String) {
        switch documentType {
        case "CIE_FRONT":
            self = .cieFront
        case "CIE_BACK":
            self = .cieBack
        case "TESSERA_SANITARIA_FRONT":
            self = .tesseraFront
        case "TESSERA_SANITARIA_BACK":
            self = .tesseraBack
        default:
            return nil
        }
    }
}

struct FixtureCoverage {
    static let requiredSources: Set<String> = ["webcam", "continuity"]
    static let requiredAcceptedSides: Set<String> = ["cie_front", "cie_back", "tessera_front", "tessera_back"]
    static let requiredConditions: Set<String> = [
        "good",
        "tilted",
        "glare",
        "slight-blur",
        "dark-background",
        "light-background",
        "partial-frame",
        "non-document",
    ]
    static let requiredRejectedConditions: Set<String> = requiredConditions.subtracting(["good"])

    var manifests = 0
    var fixtures = 0
    var replayOnlyFixtures = 0
    var accepted = 0
    var rejected = 0
    var captureSources = Set<String>()
    var documentSides = Set<String>()
    var acceptedDocumentSides = Set<String>()
    var acceptedSourceDocumentSides = Set<String>()
    var rejectedDocumentSides = Set<String>()
    var conditions = Set<String>()
    var sourceConditions = Set<String>()
    var acceptedSourceConditions = Set<String>()
    var rejectedSourceConditions = Set<String>()
    var incompleteMetadata: [String] = []

    static func matrixTarget(for fixture: RealImageFixture) -> String {
        [
            fixture.expect.rawValue,
            fixture.captureSource.rawValue,
            fixture.documentSide.rawValue,
            fixture.condition
        ].joined(separator: " ")
    }

    mutating func record(_ fixture: RealImageFixture, manifestURL: URL) {
        fixtures += 1
        if fixture.replayOnly {
            replayOnlyFixtures += 1
        }
        switch fixture.expect {
        case .accept:
            accepted += 1
            acceptedDocumentSides.insert(fixture.documentSide.rawValue)
            acceptedSourceDocumentSides.insert("\(fixture.captureSource.rawValue):\(fixture.documentSide.rawValue)")
        case .reject:
            rejected += 1
            rejectedDocumentSides.insert(fixture.documentSide.rawValue)
        }
        captureSources.insert(fixture.captureSource.rawValue)
        documentSides.insert(fixture.documentSide.rawValue)
        conditions.insert(fixture.condition)
        if [.webcam, .continuity].contains(fixture.captureSource) {
            sourceConditions.insert("\(fixture.captureSource.rawValue):\(fixture.condition)")
            switch fixture.expect {
            case .accept:
                acceptedSourceConditions.insert("\(fixture.captureSource.rawValue):\(fixture.condition)")
            case .reject:
                rejectedSourceConditions.insert("\(fixture.captureSource.rawValue):\(fixture.condition)")
            }
        }

        if fixture.captureSource == .unknown
            || fixture.documentSide == .unknown
            || fixture.condition == "unspecified"
            || fixture.condition.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name)")
        }
        if fixture.replayOnly, fixture.image?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false {
            incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):replay-only image path")
        }
        if fixture.replayOnly, fixture.orientation != nil {
            incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):replay-only orientation")
        }
        if !fixture.replayOnly, !fixture.hasSafeRelativeImagePath {
            incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):invalid image path")
        }
        if [.webcam, .continuity].contains(fixture.captureSource),
           fixture.matrixTarget?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty != false {
            incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):missing matrixTarget")
        }
        if [.webcam, .continuity].contains(fixture.captureSource),
           fixture.ocrProvider?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty != false {
            incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):missing OCR provider")
        }
        if let matrixTarget = fixture.matrixTarget?.trimmingCharacters(in: .whitespacesAndNewlines),
           !matrixTarget.isEmpty,
           matrixTarget != Self.matrixTarget(for: fixture) {
            incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):matrixTarget mismatch")
        }
        if fixture.expect == .accept,
           let expected = fixture.expected,
           FixtureDocumentSide(documentType: expected.documentType) != fixture.documentSide {
            incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):documentSide expected mismatch")
        }
        if !fixture.replayOnly,
           [.webcam, .continuity].contains(fixture.captureSource),
           fixture.orientation == nil {
            incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):missing orientation")
        }
        if !fixture.replayOnly,
           [.webcam, .continuity].contains(fixture.captureSource),
           let orientation = fixture.orientation,
           !orientation.hasPositiveImageDimensions {
            incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):invalid orientation dimensions")
        }
        if !fixture.replayOnly,
           [.webcam, .continuity].contains(fixture.captureSource),
           let orientation = fixture.orientation,
           !orientation.hasPositiveRawImageDimensions {
            incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):invalid raw orientation dimensions")
        }
        if !fixture.replayOnly,
           [.webcam, .continuity].contains(fixture.captureSource),
           let orientation = fixture.orientation,
           !orientation.agreesWithAngles(captureSource: fixture.captureSource) {
            incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):orientation angle mismatch")
        }
        if !fixture.replayOnly,
           [.webcam, .continuity].contains(fixture.captureSource),
           let orientation = fixture.orientation,
           !orientation.displayDimensionsMatchRawImage {
            incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):orientation raw/display dimension mismatch")
        }
        if [.webcam, .continuity].contains(fixture.captureSource), fixture.diagnostics == nil {
            incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):missing diagnostics")
        }
        if [.webcam, .continuity].contains(fixture.captureSource),
           fixture.diagnostics?.frameQualityMetrics == nil {
            incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):missing frame quality metrics")
        }
        if [.webcam, .continuity].contains(fixture.captureSource),
           fixture.diagnostics?.frameQualityMetrics?.isComplete == false {
            incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):invalid frame quality metrics")
        }
        if [.webcam, .continuity].contains(fixture.captureSource),
           fixture.diagnostics?.reasons == nil {
            incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):missing diagnostic reasons")
        }
        if [.webcam, .continuity].contains(fixture.captureSource),
           let diagnostics = fixture.diagnostics,
           (diagnostics.itemCount < 0
            || diagnostics.markerCount < 0) {
            incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):invalid diagnostic counts")
        }
        if [.webcam, .continuity].contains(fixture.captureSource),
           let diagnostics = fixture.diagnostics,
           diagnostics.canCapture == false,
           diagnostics.reasons?.isEmpty == true {
            incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):empty rejection reasons")
        }
        if [.webcam, .continuity].contains(fixture.captureSource),
           let diagnostics = fixture.diagnostics,
           diagnostics.canCapture,
           diagnostics.reasons?.isEmpty == false {
            incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):accepted fixture has rejection reasons")
        }
        if [.webcam, .continuity].contains(fixture.captureSource),
           fixture.expect == .accept,
           fixture.diagnostics?.canCapture == false {
            incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):accepted fixture diagnostics reject")
        }
        if [.webcam, .continuity].contains(fixture.captureSource),
           fixture.expect == .reject,
           fixture.diagnostics?.canCapture == true {
            incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):rejected fixture diagnostics accept")
        }
        if [.webcam, .continuity].contains(fixture.captureSource), fixture.observed == nil {
            incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):missing observed")
        }
        if [.webcam, .continuity].contains(fixture.captureSource),
           let diagnostics = fixture.diagnostics,
           let observed = fixture.observed,
           diagnostics.missingFrontNames != observed.observedFrontMissingNames {
            incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):missingFrontNames mismatch")
        }
        if [.webcam, .continuity].contains(fixture.captureSource), fixture.observedItems == nil {
            incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):missing observedItems")
        }
        if [.webcam, .continuity].contains(fixture.captureSource),
           let diagnostics = fixture.diagnostics,
           let observedItems = fixture.observedItems,
           diagnostics.itemCount != observedItems.count {
            incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):observedItems count mismatch")
        }
        if [.webcam, .continuity].contains(fixture.captureSource),
           let diagnostics = fixture.diagnostics,
           let observed = fixture.observed,
           let observedItems = fixture.observedItems {
            let replayItems = ScanCaptureLogic.sortedRecognizedItems(observedItems.map(\.recognizedItem))
            var replayObserved = ScanCaptureLogic.parseRecognizedItems(
                replayItems,
                barcodePayloads: fixture.observedBarcodes.map(\.payload)
            )
            replayObserved.calculateCodiceFiscaleIfPossible()
            let observedMismatches = observed.mismatchedFields(comparedTo: replayObserved)
            if !observedMismatches.isEmpty {
                incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):observed OCR replay mismatch \(observedMismatches.joined(separator: "|"))")
            }
            if fixture.expect == .accept,
               FixtureDocumentSide(documentType: replayObserved.documentType) != fixture.documentSide {
                incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):documentSide replay mismatch")
            }
            let replayReadiness = ScanCaptureLogic.captureReadiness(
                parsed: replayObserved,
                items: replayItems,
                frameQuality: diagnostics.frameQualityMetrics?.isComplete == true
                    ? diagnostics.frameQualityMetrics?.captureFrameQuality
                    : observedItemsFrameQuality(for: fixture.quality)
            )
            if diagnostics.markerCount != replayReadiness.markerCount {
                incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):observedItems marker count mismatch")
            }
            if fixture.quality != .ignore,
               diagnostics.score != replayReadiness.score {
                incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):readiness score mismatch")
            }
            if fixture.quality != .ignore,
               diagnostics.canCapture != replayReadiness.canCapture {
                incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):readiness capture mismatch")
            }
            if fixture.quality != .ignore,
               diagnostics.canGuideLiveScan != replayReadiness.canGuideLiveScan {
                incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):readiness guidance mismatch")
            }
            if let reasons = diagnostics.reasons,
               reasons != replayReadiness.reasons {
                incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):readiness reasons mismatch")
            }
        }
        if [.webcam, .continuity].contains(fixture.captureSource),
           let observedItems = fixture.observedItems,
           observedItems.contains(where: { !$0.isComplete }) {
            incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):invalid observedItems")
        }
        if [.webcam, .continuity].contains(fixture.captureSource),
           fixture.observedBarcodes.contains(where: { !$0.isComplete }) {
            incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):invalid observedBarcodes")
        }
    }

    mutating func recordLoadedImage(_ image: NSImage, fixture: RealImageFixture, manifestURL: URL) {
        guard [.webcam, .continuity].contains(fixture.captureSource),
              let orientation = fixture.orientation,
              let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
            return
        }
        if orientation.imageWidth != cgImage.width || orientation.imageHeight != cgImage.height {
            incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):orientation image dimensions mismatch")
        }
        if let metrics = fixture.diagnostics?.frameQualityMetrics,
           !metrics.matches(IDScanner.assessFrameQuality(cgImage)) {
            incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):frame quality metrics mismatch")
        }
        if let observedItems = fixture.observedItems,
           observedItems.contains(where: { !$0.imageBoundsMatch(imageWidth: cgImage.width, imageHeight: cgImage.height) }) {
            incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):observedItems image bounds mismatch")
        }
        if fixture.observedBarcodes.contains(where: { !$0.imageBoundsMatch(imageWidth: cgImage.width, imageHeight: cgImage.height) }) {
            incompleteMetadata.append("\(manifestURL.lastPathComponent):\(fixture.name):observedBarcodes image bounds mismatch")
        }
    }

    func printSummary() {
        guard fixtures > 0 else { return }
        print("\nReal fixture coverage:")
        print("- manifests: \(manifests)")
        print("- fixtures: \(fixtures) (\(accepted) accept, \(rejected) reject, \(replayOnlyFixtures) replay-only)")
        print("- sources: \(captureSources.sorted().joined(separator: ", "))")
        print("- sides: \(documentSides.sorted().joined(separator: ", "))")
        for row in acceptedSourceSideMatrixRows() {
            print(row)
        }
        print("- conditions: \(conditions.sorted().joined(separator: ", "))")
        for row in sourceConditionMatrixRows() {
            print(row)
        }
        if !incompleteMetadata.isEmpty {
            print("WARNING: Fixtures with incomplete metadata: \(incompleteMetadata.joined(separator: ", "))")
        }
    }

    func acceptedSourceSideMatrixRows() -> [String] {
        Self.requiredSources.sorted().map { source in
            let sideStatuses = Self.requiredAcceptedSides.sorted().map { side in
                let status = acceptedSourceDocumentSides.contains("\(source):\(side)") ? "ok" : "missing"
                return "\(side)=\(status)"
            }
            return "- accepted \(source): \(sideStatuses.joined(separator: ", "))"
        }
    }

    func sourceConditionMatrixRows() -> [String] {
        Self.requiredSources.sorted().map { source in
            let conditionStatuses = Self.requiredConditions.sorted().map { condition in
                let status = sourceConditions.contains("\(source):\(condition)") ? "ok" : "missing"
                return "\(condition)=\(status)"
            }
            return "- conditions \(source): \(conditionStatuses.joined(separator: ", "))"
        }
    }

    func strictCoverageFailures() -> [String] {
        var failures: [String] = []
        if manifests == 0 { failures.append("at least one real fixture manifest") }
        if fixtures == 0 { failures.append("at least one real fixture") }
        if accepted == 0 { failures.append("at least one accepted document fixture") }
        if rejected == 0 { failures.append("at least one rejected bad-frame/non-document fixture") }

        for source in Self.requiredSources.subtracting(captureSources).sorted() {
            failures.append("capture source \(source)")
        }

        for side in Self.requiredAcceptedSides.subtracting(acceptedDocumentSides).sorted() {
            failures.append("accepted document side \(side)")
        }

        for source in Self.requiredSources.sorted() {
            for side in Self.requiredAcceptedSides.sorted()
            where !acceptedSourceDocumentSides.contains("\(source):\(side)") {
                failures.append("accepted \(source) document side \(side)")
            }
        }

        for condition in Self.requiredConditions.subtracting(conditions).sorted() {
            failures.append("condition \(condition)")
        }

        for source in Self.requiredSources.sorted() {
            for condition in Self.requiredConditions.sorted()
            where !sourceConditions.contains("\(source):\(condition)") {
                failures.append("condition \(source) \(condition)")
            }
        }

        for source in Self.requiredSources.sorted()
        where !acceptedSourceConditions.contains("\(source):good") {
            failures.append("accepted condition \(source) good")
        }

        for source in Self.requiredSources.sorted() {
            for condition in Self.requiredRejectedConditions.sorted()
            where !rejectedSourceConditions.contains("\(source):\(condition)") {
                failures.append("rejected condition \(source) \(condition)")
            }
        }

        if !acceptedSourceConditions.contains(where: { $0.hasSuffix(":good") }) {
            failures.append("accepted condition good")
        }
        for condition in Self.requiredRejectedConditions.sorted()
        where !rejectedSourceConditions.contains(where: { $0.hasSuffix(":\(condition)") }) {
            failures.append("rejected condition \(condition)")
        }

        if !incompleteMetadata.isEmpty {
            failures.append("complete fixture metadata")
        }
        return failures
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
    NSColor(calibratedWhite: 0.90, alpha: 1).setFill()
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

func rotatedFixtureImage(_ image: NSImage, orientation: CGImagePropertyOrientation) -> NSImage {
    guard let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        return image
    }
    let output = CIImage(cgImage: cgImage).oriented(orientation)
    let extent = output.extent.integral
    let context = CIContext()
    guard let rotated = context.createCGImage(output, from: extent) else {
        return image
    }
    return NSImage(cgImage: rotated, size: NSSize(width: rotated.width, height: rotated.height))
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
    let items: [RecognizedItem]
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
    var recognizedItems: [RecognizedItem] = []
    ScanCaptureLogic.recognizeTextWithOptionalAutoCrop(
        image: image,
        cgImage: cgImage,
        autoCrop: true,
        boundsItems: [],
        fallbackItems: [],
        fallbackParsed: IDData(documentType: "UNKNOWN", rawText: [])
    ) { _, items, _, result in
        recognizedItems = items
        parsed = result
        parsed.calculateCodiceFiscaleIfPossible()
        semaphore.signal()
    }

    while semaphore.wait(timeout: .now() + 0.05) == .timedOut {
        RunLoop.current.run(mode: .default, before: Date(timeIntervalSinceNow: 0.05))
    }

    return StaticCaptureFixtureResult(parsed: parsed, items: recognizedItems, frameQuality: frameQuality)
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
    assertTrue(
        !result.items.isEmpty,
        "\(name) preserves OCR items for item-aware final capture gate"
    )
    assertTrue(
        ScanCaptureLogic.shouldAcceptCapture(parsed, items: result.items, frameQuality: result.frameQuality),
        "\(name) passes final capture gate - \(ScanCaptureLogic.captureReadiness(parsed: parsed, items: result.items, frameQuality: result.frameQuality).reasons.joined(separator: ","))"
    )
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
        !ScanCaptureLogic.shouldAcceptCapture(result.parsed, items: result.items, frameQuality: result.frameQuality),
        "\(name) is rejected by final capture gate"
    )
}

func observedItemsFrameQuality(for expectation: FixtureQualityExpectation) -> CaptureFrameQuality? {
    switch expectation {
    case .usable:
        return .good
    case .unusable:
        return CaptureFrameQuality(sharpness: 0, glareRatio: 0, darkRatio: 0, meanLuma: 128)
    case .ignore:
        return nil
    }
}

func runObservedItemsFixture(_ fixture: RealImageFixture, name: String) {
    guard let observedItems = fixture.observedItems else { return }
    let items = ScanCaptureLogic.sortedRecognizedItems(observedItems.map(\.recognizedItem))
    var parsed = ScanCaptureLogic.parseRecognizedItems(
        items,
        barcodePayloads: fixture.observedBarcodes.map(\.payload)
    )
    parsed.calculateCodiceFiscaleIfPossible()
    let frameQuality = observedItemsFrameQuality(for: fixture.quality)
    let accepts = ScanCaptureLogic.shouldAcceptCapture(parsed, items: items, frameQuality: frameQuality)

    switch fixture.expect {
    case .accept:
        guard let expected = fixture.expected else {
            verificationFailures += 1
            print("❌ FAIL: \(name) observed OCR replay has expected data")
            return
        }
        assertTrue(accepts, "\(name) observed OCR replay passes final capture gate")
        assertDataField(parsed, \.documentType, expected.documentType, "\(name) observed OCR replay document type")
        assertDataField(parsed, \.surname, expected.surname, "\(name) observed OCR replay surname")
        assertDataField(parsed, \.name, expected.name, "\(name) observed OCR replay name")
        assertDataField(parsed, \.codiceFiscale, expected.codiceFiscale, "\(name) observed OCR replay codice fiscale")
        assertDataField(parsed, \.documentNumber, expected.documentNumber, "\(name) observed OCR replay document number")
        assertDataField(parsed, \.dateOfBirth, expected.dateOfBirth, "\(name) observed OCR replay date of birth")
        assertDataField(parsed, \.placeOfBirth, expected.placeOfBirth, "\(name) observed OCR replay place of birth")
        assertDataField(parsed, \.gender, expected.gender, "\(name) observed OCR replay gender")
        assertDataField(parsed, \.expiryDate, expected.expiryDate, "\(name) observed OCR replay expiry")
        assertDataField(parsed, \.nationality, expected.nationality, "\(name) observed OCR replay nationality")
        assertDataField(parsed, \.cardNumber, expected.cardNumber, "\(name) observed OCR replay card number")
    case .reject:
        assertTrue(!accepts, "\(name) observed OCR replay is rejected by final capture gate")
    }
}

func runRealImageFixtureCorpus() {
    let rootURL = realImageFixtureRootURL()
    let manifestURLs = realImageFixtureManifestURLs(rootURL: rootURL)
    let requiresRealFixtures = ProcessInfo.processInfo.environment["SCANID_REQUIRE_REAL_OCR_FIXTURES"] == "1"
    let failsIncompleteMetadata = ProcessInfo.processInfo.environment["SCANID_FAIL_INCOMPLETE_OCR_FIXTURE_METADATA"] == "1"

    guard !manifestURLs.isEmpty else {
        if requiresRealFixtures {
            verificationFailures += 1
            print("❌ FAIL: SCANID_REQUIRE_REAL_OCR_FIXTURES=1 but no OCRFixtures manifest.json files were found")
            print("Missing strict fixture coverage: \(FixtureCoverage().strictCoverageFailures().joined(separator: ", "))")
        } else {
            print("No OCRFixtures manifest.json files found; skipping real image OCR fixture corpus.")
        }
        return
    }

    var coverage = FixtureCoverage()
    for manifestURL in manifestURLs {
        runRealImageFixtureManifest(manifestURL, coverage: &coverage)
    }
    coverage.printSummary()
    if failsIncompleteMetadata && !requiresRealFixtures && !coverage.incompleteMetadata.isEmpty {
        verificationFailures += 1
        print("❌ FAIL: OCR fixture metadata incomplete \(coverage.incompleteMetadata.joined(separator: ", "))")
    }
    if requiresRealFixtures {
        let failures = coverage.strictCoverageFailures()
        if failures.isEmpty {
            print("✅ PASS: Real fixture strict coverage requirements")
        } else {
            verificationFailures += 1
            print("❌ FAIL: Real fixture strict coverage missing \(failures.joined(separator: ", "))")
        }
    }
}

func realImageFixtureRootURL(
    environment: [String: String] = ProcessInfo.processInfo.environment,
    currentDirectoryPath: String = FileManager.default.currentDirectoryPath
) -> URL {
    let override = environment["SCANID_OCR_FIXTURES_DIR"]?
        .trimmingCharacters(in: .whitespacesAndNewlines)
    guard let override, !override.isEmpty else {
        return URL(fileURLWithPath: currentDirectoryPath)
            .appendingPathComponent("OCRFixtures", isDirectory: true)
    }
    if override.hasPrefix("/") {
        return URL(fileURLWithPath: override, isDirectory: true)
    }
    return URL(fileURLWithPath: currentDirectoryPath)
        .appendingPathComponent(override, isDirectory: true)
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
            let fixtureName = "Real fixture \(fixture.name)"
            if fixture.replayOnly {
                runObservedItemsFixture(fixture, name: fixtureName)
                continue
            }
            guard fixture.hasSafeRelativeImagePath else {
                verificationFailures += 1
                print("❌ FAIL: \(fixture.name) image path must stay inside the fixture folder: \(fixture.image ?? "<missing>")")
                continue
            }
            guard let imagePath = fixture.image else {
                verificationFailures += 1
                print("❌ FAIL: \(fixture.name) declares image path")
                continue
            }
            let imageURL = fixtureBaseURL.appendingPathComponent(imagePath)
            guard let image = NSImage(contentsOf: imageURL) else {
                verificationFailures += 1
                print("❌ FAIL: \(fixture.name) loads image at \(imageURL.path)")
                continue
            }
            coverage.recordLoadedImage(image, fixture: fixture, manifestURL: manifestURL)
            runObservedItemsFixture(fixture, name: fixtureName)
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

let replayOnlyManifestString = """
{
  "fixtures": [
    {
      "name": "redacted-replay",
      "replayOnly": true,
      "expect": "reject",
      "quality": "ignore",
      "ocrProvider": "vision",
      "captureSource": "continuity",
      "documentSide": "negative",
      "condition": "non-document",
      "matrixTarget": "reject continuity negative non-document",
      "diagnostics": {
        "frameQuality": "usable (sharpness 12.00, glare 0.000, dark 0.000, mean 180.0)",
        "frameQualityMetrics": {
          "sharpness": 12.0,
          "glareRatio": 0.0,
          "darkRatio": 0.0,
          "meanLuma": 180.0,
          "usable": true,
          "failureReasons": []
        },
        "canCapture": false,
        "canGuideLiveScan": false,
        "score": 3,
        "markerCount": 0,
        "itemCount": 0,
        "missingFrontNames": false,
        "reasons": ["unknownDocumentType", "missingIdentifier"]
      },
      "observed": {
        "documentType": "UNKNOWN",
        "surname": null,
        "name": null,
        "codiceFiscale": null,
        "documentNumber": null,
        "dateOfBirth": null,
        "placeOfBirth": null,
        "gender": null,
        "expiryDate": null,
        "nationality": null,
        "cardNumber": null
      },
      "observedItems": []
    }
  ]
}
"""
let replayOnlyManifestJSON = replayOnlyManifestString.data(using: .utf8)!
let decodedReplayOnlyManifest = try? JSONDecoder().decode(RealImageFixtureManifest.self, from: replayOnlyManifestJSON)
assertTrue(decodedReplayOnlyManifest?.fixtures.first?.replayOnly == true, "Replay-only fixture decodes without an image")
assertTrue(decodedReplayOnlyManifest?.fixtures.first?.hasSafeRelativeImagePath == true, "Replay-only fixture does not require an image path")
if let fixture = decodedReplayOnlyManifest?.fixtures.first {
    var replayOnlyCoverage = FixtureCoverage()
    replayOnlyCoverage.record(fixture, manifestURL: URL(fileURLWithPath: "manifest.json"))
    assertTrue(
        replayOnlyCoverage.incompleteMetadata.isEmpty,
        "Replay-only fixture without image or orientation metadata is complete - \(replayOnlyCoverage.incompleteMetadata.joined(separator: ", "))"
    )
}

let replayOnlyWithImageManifestJSON = replayOnlyManifestString
    .replacingOccurrences(of: "\"replayOnly\": true,", with: "\"replayOnly\": true,\n      \"image\": \"capture.png\",")
    .data(using: .utf8)!
let decodedReplayOnlyWithImage = try? JSONDecoder().decode(RealImageFixtureManifest.self, from: replayOnlyWithImageManifestJSON)
if let fixture = decodedReplayOnlyWithImage?.fixtures.first {
    var replayOnlyImageCoverage = FixtureCoverage()
    replayOnlyImageCoverage.record(fixture, manifestURL: URL(fileURLWithPath: "manifest.json"))
    assertTrue(
        replayOnlyImageCoverage.incompleteMetadata.contains { $0.contains("replay-only image path") },
        "Replay-only fixture with image path is incomplete"
    )
}

let replayOnlyWithOrientationManifestJSON = replayOnlyManifestString
    .replacingOccurrences(
        of: "\"replayOnly\": true,",
        with:
        """
        "replayOnly": true,
              "orientation": {
                "ocrVisionOrientation": "up",
                "snapshotDisplayOrientation": "left",
                "basePreviewRotationAngle": 180,
                "scanPreviewRotationAngle": 270,
                "baseCaptureRotationAngle": 0,
                "scanCaptureRotationAngle": 90,
                "rawImageWidth": 1080,
                "rawImageHeight": 1920,
                "imageWidth": 1920,
                "imageHeight": 1080
              },
        """
    )
    .data(using: .utf8)!
let decodedReplayOnlyWithOrientation = try? JSONDecoder().decode(RealImageFixtureManifest.self, from: replayOnlyWithOrientationManifestJSON)
if let fixture = decodedReplayOnlyWithOrientation?.fixtures.first {
    var replayOnlyOrientationCoverage = FixtureCoverage()
    replayOnlyOrientationCoverage.record(fixture, manifestURL: URL(fileURLWithPath: "manifest.json"))
    assertTrue(
        replayOnlyOrientationCoverage.incompleteMetadata.contains { $0.contains("replay-only orientation") },
        "Replay-only fixture with orientation metadata is incomplete"
    )
}

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
      "ocrProvider": "vision",
      "captureSource": "continuity",
      "documentSide": "cie_front",
      "condition": "good",
      "matrixTarget": "accept continuity cie_front good",
      "orientation": {
        "ocrVisionOrientation": "up",
        "snapshotDisplayOrientation": "left",
        "basePreviewRotationAngle": 180,
        "scanPreviewRotationAngle": 270,
        "baseCaptureRotationAngle": 0,
        "scanCaptureRotationAngle": 90,
        "rawImageWidth": 1080,
        "rawImageHeight": 1920,
        "imageWidth": 1920,
        "imageHeight": 1080
      },
      "diagnostics": {
        "frameQuality": "usable (sharpness 12.00, glare 0.000, dark 0.000, mean 180.0)",
        "frameQualityMetrics": {
          "sharpness": 12.0,
          "glareRatio": 0.0,
          "darkRatio": 0.0,
          "meanLuma": 180.0,
          "usable": true,
          "failureReasons": []
        },
        "canCapture": true,
        "canGuideLiveScan": true,
        "score": 32,
        "markerCount": 7,
        "itemCount": 11,
        "missingFrontNames": false,
        "reasons": []
      },
      "observed": {
        "documentType": "CIE_FRONT",
        "surname": "ROSSI",
        "name": "MARIO",
        "codiceFiscale": "RSSMRA90M15H501Y",
        "documentNumber": "CA12345AA",
        "dateOfBirth": "15/08/1990",
        "placeOfBirth": "ROMA",
        "gender": "M",
        "expiryDate": "15/08/2030",
        "nationality": "ITA",
        "cardNumber": null
      },
      "observedItems": [
        {
          "text": "REPUBBLICA ITALIANA",
          "confidence": 0.96,
          "boundingBox": {
            "x": 0.55,
            "y": 0.80,
            "width": 0.28,
            "height": 0.05
          }
        },
        {
          "text": "CARTA DI IDENTITA",
          "confidence": 0.95,
          "boundingBox": {
            "x": 0.55,
            "y": 0.72,
            "width": 0.28,
            "height": 0.05
          }
        },
        {
          "text": "COGNOME ROSSI",
          "confidence": 0.94,
          "boundingBox": {
            "x": 0.10,
            "y": 0.62,
            "width": 0.22,
            "height": 0.05
          }
        },
        {
          "text": "NOME MARIO",
          "confidence": 0.93,
          "boundingBox": {
            "x": 0.10,
            "y": 0.54,
            "width": 0.20,
            "height": 0.05
          }
        },
        {
          "text": "CODICE FISCALE RSSMRA90M15H501Y",
          "confidence": 0.95,
          "boundingBox": {
            "x": 0.10,
            "y": 0.44,
            "width": 0.38,
            "height": 0.05
          }
        },
        {
          "text": "DOCUMENTO CA12345AA",
          "confidence": 0.92,
          "boundingBox": {
            "x": 0.56,
            "y": 0.62,
            "width": 0.24,
            "height": 0.05
          }
        },
        {
          "text": "DATA DI NASCITA 15/08/1990",
          "confidence": 0.91,
          "boundingBox": {
            "x": 0.56,
            "y": 0.54,
            "width": 0.28,
            "height": 0.05
          }
        },
        {
          "text": "LUOGO DI NASCITA ROMA",
          "confidence": 0.90,
          "boundingBox": {
            "x": 0.56,
            "y": 0.46,
            "width": 0.26,
            "height": 0.05
          }
        },
        {
          "text": "SESSO M",
          "confidence": 0.89,
          "boundingBox": {
            "x": 0.56,
            "y": 0.38,
            "width": 0.12,
            "height": 0.05
          }
        },
        {
          "text": "CITTADINANZA ITA",
          "confidence": 0.90,
          "boundingBox": {
            "x": 0.56,
            "y": 0.22,
            "width": 0.22,
            "height": 0.05
          }
        },
        {
          "text": "SCADENZA 15/08/2030",
          "confidence": 0.90,
          "boundingBox": {
            "x": 0.56,
            "y": 0.30,
            "width": 0.25,
            "height": 0.05
          }
        }
      ],
      "expected": {
        "documentType": "CIE_FRONT",
        "surname": "ROSSI",
        "name": "MARIO",
        "codiceFiscale": "RSSMRA90M15H501Y",
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
assertEqual(decodedAcceptQualityManifest?.fixtures.first?.ocrProvider, "vision", "Fixture OCR provider decodes")
assertEqual(decodedAcceptQualityManifest?.fixtures.first?.captureSource.rawValue, "continuity", "Fixture capture source decodes")
assertEqual(decodedAcceptQualityManifest?.fixtures.first?.documentSide.rawValue, "cie_front", "Fixture document side decodes")
assertEqual(decodedAcceptQualityManifest?.fixtures.first?.condition, "good", "Fixture condition decodes")
assertEqual(decodedAcceptQualityManifest?.fixtures.first?.matrixTarget, "accept continuity cie_front good", "Fixture matrix target decodes")
assertEqual(decodedAcceptQualityManifest?.fixtures.first?.orientation?.snapshotDisplayOrientation, "left", "Fixture orientation metadata decodes")
assertEqual(String(decodedAcceptQualityManifest?.fixtures.first?.orientation?.rawImageWidth ?? -1), "1080", "Fixture raw orientation width decodes")
assertEqual(String(decodedAcceptQualityManifest?.fixtures.first?.diagnostics?.score ?? -1), "32", "Fixture diagnostics metadata decodes")
assertEqual(String(decodedAcceptQualityManifest?.fixtures.first?.diagnostics?.frameQualityMetrics?.usable ?? false), "true", "Fixture frame quality metrics decode")
assertEqual(String(decodedAcceptQualityManifest?.fixtures.first?.diagnostics?.reasons?.count ?? -1), "0", "Accepted fixture diagnostic reasons decode empty")
assertEqual(decodedAcceptQualityManifest?.fixtures.first?.observed?.surname, "ROSSI", "Fixture observed metadata decodes")
assertEqual(decodedAcceptQualityManifest?.fixtures.first?.observedItems?.first?.text, "REPUBBLICA ITALIANA", "Fixture observed OCR items decode")
assertEqual(String(decodedAcceptQualityManifest?.fixtures.first?.observedBarcodes.count ?? -1), "0", "Fixture observed barcode metadata defaults empty")

let observedItemsReplayManifestJSON = """
{
  "fixtures": [
    {
      "name": "observed-items-accepted-tessera-front",
      "image": "webcam/tessera-front.png",
      "expect": "accept",
      "quality": "usable",
      "ocrProvider": "vision",
      "captureSource": "webcam",
      "documentSide": "tessera_front",
      "condition": "good",
      "observedItems": [
        {
          "text": "TESSERA SANITARIA",
          "confidence": 0.96,
          "boundingBox": { "x": 0.12, "y": 0.82, "width": 0.38, "height": 0.05 }
        },
        {
          "text": "COGNOME",
          "confidence": 0.95,
          "boundingBox": { "x": 0.12, "y": 0.68, "width": 0.15, "height": 0.04 }
        },
        {
          "text": "ROSSI",
          "confidence": 0.96,
          "boundingBox": { "x": 0.34, "y": 0.68, "width": 0.16, "height": 0.04 }
        },
        {
          "text": "NOME",
          "confidence": 0.95,
          "boundingBox": { "x": 0.12, "y": 0.60, "width": 0.12, "height": 0.04 }
        },
        {
          "text": "MARIA",
          "confidence": 0.96,
          "boundingBox": { "x": 0.34, "y": 0.60, "width": 0.16, "height": 0.04 }
        },
        {
          "text": "DATA DI NASCITA",
          "confidence": 0.94,
          "boundingBox": { "x": 0.12, "y": 0.52, "width": 0.26, "height": 0.04 }
        },
        {
          "text": "24/12/1995",
          "confidence": 0.96,
          "boundingBox": { "x": 0.44, "y": 0.52, "width": 0.18, "height": 0.04 }
        },
        {
          "text": "LUOGO DI NASCITA",
          "confidence": 0.94,
          "boundingBox": { "x": 0.12, "y": 0.44, "width": 0.28, "height": 0.04 }
        },
        {
          "text": "MILANO",
          "confidence": 0.96,
          "boundingBox": { "x": 0.44, "y": 0.44, "width": 0.16, "height": 0.04 }
        },
        {
          "text": "CODICE FISCALE",
          "confidence": 0.95,
          "boundingBox": { "x": 0.12, "y": 0.36, "width": 0.26, "height": 0.04 }
        },
        {
          "text": "RSSMRA95T64F205W",
          "confidence": 0.97,
          "boundingBox": { "x": 0.44, "y": 0.36, "width": 0.28, "height": 0.04 }
        },
        {
          "text": "SCADENZA",
          "confidence": 0.95,
          "boundingBox": { "x": 0.12, "y": 0.28, "width": 0.16, "height": 0.04 }
        },
        {
          "text": "24/12/2029",
          "confidence": 0.96,
          "boundingBox": { "x": 0.44, "y": 0.28, "width": 0.18, "height": 0.04 }
        }
      ],
      "expected": {
        "documentType": "TESSERA_SANITARIA_FRONT",
        "surname": "ROSSI",
        "name": "MARIA",
        "codiceFiscale": "RSSMRA95T64F205W",
        "documentNumber": null,
        "dateOfBirth": "24/12/1995",
        "placeOfBirth": "MILANO",
        "gender": "F",
        "expiryDate": "24/12/2029",
        "nationality": null,
        "cardNumber": null
      }
    },
    {
      "name": "observed-items-rejected-non-document",
      "image": "webcam/non-document.png",
      "expect": "reject",
      "quality": "ignore",
      "ocrProvider": "vision",
      "captureSource": "webcam",
      "documentSide": "negative",
      "condition": "non-document",
      "observedItems": [
        {
          "text": "FATTURA TOTALE 24/12/2029",
          "confidence": 0.97,
          "boundingBox": { "x": 0.12, "y": 0.80, "width": 0.35, "height": 0.05 }
        }
      ]
    },
    {
      "name": "observed-barcodes-rejected-tessera-back",
      "image": "webcam/tessera-back-barcode.png",
      "expect": "reject",
      "quality": "ignore",
      "ocrProvider": "vision",
      "captureSource": "webcam",
      "documentSide": "negative",
      "condition": "partial-frame",
      "matrixTarget": "reject webcam negative partial-frame",
      "orientation": {
        "ocrVisionOrientation": "up",
        "snapshotDisplayOrientation": "up",
        "basePreviewRotationAngle": 0,
        "scanPreviewRotationAngle": 0,
        "baseCaptureRotationAngle": 0,
        "scanCaptureRotationAngle": 0,
        "rawImageWidth": 1280,
        "rawImageHeight": 720,
        "imageWidth": 1280,
        "imageHeight": 720
      },
      "diagnostics": {
        "frameQuality": "usable (sharpness 12.00, glare 0.000, dark 0.000, mean 180.0)",
        "canCapture": false,
        "canGuideLiveScan": false,
        "score": 0,
        "markerCount": 1,
        "itemCount": 1,
        "missingFrontNames": false,
        "reasons": ["missingFieldEvidence"]
      },
      "observed": {
        "documentType": "TESSERA_SANITARIA_BACK",
        "surname": null,
        "name": null,
        "codiceFiscale": "RSSMRA90A15H501Y",
        "documentNumber": null,
        "dateOfBirth": null,
        "placeOfBirth": null,
        "gender": null,
        "expiryDate": null,
        "nationality": null,
        "cardNumber": "80380000000000012345"
      },
      "observedItems": [
        {
          "text": "TESSERA SANITARIA",
          "confidence": 0.95,
          "boundingBox": { "x": 0.12, "y": 0.82, "width": 0.38, "height": 0.05 },
          "imageBounds": { "x": 153.6, "y": 93.6, "width": 486.4, "height": 36 }
        }
      ],
      "observedBarcodes": [
        {
          "payload": "80380000000000012345|RSSMRA90A15H501Y",
          "confidence": 0.98,
          "boundingBox": { "x": 0.20, "y": 0.30, "width": 0.30, "height": 0.10 },
          "imageBounds": { "x": 256, "y": 432, "width": 384, "height": 72 }
        }
      ]
    }
  ]
}
""".data(using: .utf8)!
let decodedObservedItemsReplayManifest = try? JSONDecoder().decode(
    RealImageFixtureManifest.self,
    from: observedItemsReplayManifestJSON
)
if let fixtures = decodedObservedItemsReplayManifest?.fixtures {
    fixtures.forEach { runObservedItemsFixture($0, name: "Manifest unit fixture \($0.name)") }
    if let barcodeFixture = fixtures.first(where: { $0.name == "observed-barcodes-rejected-tessera-back" }) {
        var barcodeReplayCoverage = FixtureCoverage()
        barcodeReplayCoverage.record(barcodeFixture, manifestURL: URL(fileURLWithPath: "manifest.json"))
        assertTrue(
            !barcodeReplayCoverage.incompleteMetadata.contains { $0.contains("observed OCR replay mismatch") },
            "Camera fixture observed barcode payloads participate in parser replay"
        )
    }
}

if let fixture = decodedAcceptQualityManifest?.fixtures.first {
    var orientationCoverage = FixtureCoverage()
    orientationCoverage.record(fixture, manifestURL: URL(fileURLWithPath: "manifest.json"))
    assertTrue(
        orientationCoverage.incompleteMetadata.isEmpty,
        "Camera fixture with orientation and diagnostics metadata is complete - \(orientationCoverage.incompleteMetadata.joined(separator: ", "))"
    )
}

if let acceptQualityManifestString = String(data: acceptQualityManifestJSON, encoding: .utf8) {
    let matrixTargetMismatchData = acceptQualityManifestString
        .replacingOccurrences(
            of: "\"matrixTarget\": \"accept continuity cie_front good\"",
            with: "\"matrixTarget\": \"reject webcam negative glare\""
        )
        .data(using: .utf8)!
    let decodedMatrixTargetMismatch = try? JSONDecoder().decode(RealImageFixtureManifest.self, from: matrixTargetMismatchData)
    if let fixture = decodedMatrixTargetMismatch?.fixtures.first {
        var matrixTargetMismatchCoverage = FixtureCoverage()
        matrixTargetMismatchCoverage.record(fixture, manifestURL: URL(fileURLWithPath: "manifest.json"))
        assertTrue(
            matrixTargetMismatchCoverage.incompleteMetadata.contains { $0.contains("matrixTarget mismatch") },
            "Camera fixture with stale matrix target is incomplete"
        )
    }
    let missingOCRProviderData = acceptQualityManifestString
        .replacingOccurrences(
            of: "      \"ocrProvider\": \"vision\",\n",
            with: ""
        )
        .data(using: .utf8)!
    let decodedMissingOCRProvider = try? JSONDecoder().decode(RealImageFixtureManifest.self, from: missingOCRProviderData)
    if let fixture = decodedMissingOCRProvider?.fixtures.first {
        var missingOCRProviderCoverage = FixtureCoverage()
        missingOCRProviderCoverage.record(fixture, manifestURL: URL(fileURLWithPath: "manifest.json"))
        assertTrue(
            missingOCRProviderCoverage.incompleteMetadata.contains { $0.contains("missing OCR provider") },
            "Camera fixture without OCR provider metadata is incomplete"
        )
    }

    let documentSideMismatchData = acceptQualityManifestString
        .replacingOccurrences(
            of: "\"documentSide\": \"cie_front\"",
            with: "\"documentSide\": \"tessera_front\""
        )
        .replacingOccurrences(
            of: "\"matrixTarget\": \"accept continuity cie_front good\"",
            with: "\"matrixTarget\": \"accept continuity tessera_front good\""
        )
        .data(using: .utf8)!
    let decodedDocumentSideMismatch = try? JSONDecoder().decode(RealImageFixtureManifest.self, from: documentSideMismatchData)
    if let fixture = decodedDocumentSideMismatch?.fixtures.first {
        var documentSideMismatchCoverage = FixtureCoverage()
        documentSideMismatchCoverage.record(fixture, manifestURL: URL(fileURLWithPath: "manifest.json"))
        assertTrue(
            documentSideMismatchCoverage.incompleteMetadata.contains { $0.contains("documentSide expected mismatch") },
            "Accepted camera fixture with document side that disagrees with expected document type is incomplete"
        )
        assertTrue(
            documentSideMismatchCoverage.incompleteMetadata.contains { $0.contains("documentSide replay mismatch") },
            "Accepted camera fixture with document side that disagrees with OCR replay is incomplete"
        )
    }

    let escapedImagePathData = acceptQualityManifestString
        .replacingOccurrences(
            of: "\"image\": \"continuity/cie-front.png\"",
            with: "\"image\": \"../outside.png\""
        )
        .data(using: .utf8)!
    let decodedEscapedImagePath = try? JSONDecoder().decode(RealImageFixtureManifest.self, from: escapedImagePathData)
    if let fixture = decodedEscapedImagePath?.fixtures.first {
        var escapedImagePathCoverage = FixtureCoverage()
        escapedImagePathCoverage.record(fixture, manifestURL: URL(fileURLWithPath: "manifest.json"))
        assertTrue(
            !fixture.hasSafeRelativeImagePath,
            "Fixture image path rejects parent directory traversal"
        )
        assertTrue(
            escapedImagePathCoverage.incompleteMetadata.contains { $0.contains("invalid image path") },
            "Camera fixture with escaped image path is incomplete"
        )
    }

    let negativeDiagnosticCountData = acceptQualityManifestString
        .replacingOccurrences(
            of: "\"markerCount\": 7",
            with: "\"markerCount\": -1"
        )
        .data(using: .utf8)!
    let decodedNegativeDiagnosticCount = try? JSONDecoder().decode(RealImageFixtureManifest.self, from: negativeDiagnosticCountData)
    if let fixture = decodedNegativeDiagnosticCount?.fixtures.first {
        var negativeDiagnosticCountCoverage = FixtureCoverage()
        negativeDiagnosticCountCoverage.record(fixture, manifestURL: URL(fileURLWithPath: "manifest.json"))
        assertTrue(
            negativeDiagnosticCountCoverage.incompleteMetadata.contains { $0.contains("invalid diagnostic counts") },
            "Camera fixture with negative diagnostic counts is incomplete"
        )
    }

    let staleMarkerCountData = acceptQualityManifestString
        .replacingOccurrences(
            of: "\"markerCount\": 7",
            with: "\"markerCount\": 0"
        )
        .data(using: .utf8)!
    let decodedStaleMarkerCount = try? JSONDecoder().decode(RealImageFixtureManifest.self, from: staleMarkerCountData)
    if let fixture = decodedStaleMarkerCount?.fixtures.first {
        var staleMarkerCountCoverage = FixtureCoverage()
        staleMarkerCountCoverage.record(fixture, manifestURL: URL(fileURLWithPath: "manifest.json"))
        assertTrue(
            staleMarkerCountCoverage.incompleteMetadata.contains { $0.contains("observedItems marker count mismatch") },
            "Camera fixture with stale marker count diagnostics is incomplete"
        )
    }

    let staleReadinessScoreData = acceptQualityManifestString
        .replacingOccurrences(
            of: "\"score\": 32",
            with: "\"score\": 31"
        )
        .data(using: .utf8)!
    let decodedStaleReadinessScore = try? JSONDecoder().decode(RealImageFixtureManifest.self, from: staleReadinessScoreData)
    if let fixture = decodedStaleReadinessScore?.fixtures.first {
        var staleReadinessScoreCoverage = FixtureCoverage()
        staleReadinessScoreCoverage.record(fixture, manifestURL: URL(fileURLWithPath: "manifest.json"))
        assertTrue(
            staleReadinessScoreCoverage.incompleteMetadata.contains { $0.contains("readiness score mismatch") },
            "Camera fixture with stale readiness score diagnostics is incomplete"
        )
    }

    let staleReadinessReasonsData = acceptQualityManifestString
        .replacingOccurrences(
            of: "\"reasons\": []",
            with: "\"reasons\": [\"implausibleLayout\"]"
        )
        .data(using: .utf8)!
    let decodedStaleReadinessReasons = try? JSONDecoder().decode(RealImageFixtureManifest.self, from: staleReadinessReasonsData)
    if let fixture = decodedStaleReadinessReasons?.fixtures.first {
        var staleReadinessReasonsCoverage = FixtureCoverage()
        staleReadinessReasonsCoverage.record(fixture, manifestURL: URL(fileURLWithPath: "manifest.json"))
        assertTrue(
            staleReadinessReasonsCoverage.incompleteMetadata.contains { $0.contains("readiness reasons mismatch") },
            "Camera fixture with stale readiness reason diagnostics is incomplete"
        )
    }

    let staleObservedData = acceptQualityManifestString
        .replacingOccurrences(
            of: """
      "observed": {
        "documentType": "CIE_FRONT",
        "surname": "ROSSI"
""",
            with: """
      "observed": {
        "documentType": "CIE_FRONT",
        "surname": "VERDI"
"""
        )
        .data(using: .utf8)!
    let decodedStaleObserved = try? JSONDecoder().decode(RealImageFixtureManifest.self, from: staleObservedData)
    if let fixture = decodedStaleObserved?.fixtures.first {
        var staleObservedCoverage = FixtureCoverage()
        staleObservedCoverage.record(fixture, manifestURL: URL(fileURLWithPath: "manifest.json"))
        assertTrue(
            staleObservedCoverage.incompleteMetadata.contains { $0.contains("observed OCR replay mismatch") },
            "Camera fixture with stale observed metadata is incomplete"
        )
    }

    let orientationMismatchData = acceptQualityManifestString
        .replacingOccurrences(
            of: "\"snapshotDisplayOrientation\": \"left\"",
            with: "\"snapshotDisplayOrientation\": \"up\""
        )
        .data(using: .utf8)!
    let decodedOrientationMismatch = try? JSONDecoder().decode(RealImageFixtureManifest.self, from: orientationMismatchData)
    if let fixture = decodedOrientationMismatch?.fixtures.first {
        var orientationMismatchCoverage = FixtureCoverage()
        orientationMismatchCoverage.record(fixture, manifestURL: URL(fileURLWithPath: "manifest.json"))
        assertTrue(
            orientationMismatchCoverage.incompleteMetadata.contains { $0.contains("orientation angle mismatch") },
            "Camera fixture with stale orientation angle metadata is incomplete"
        )
    }

    let previewAngleMismatchData = acceptQualityManifestString
        .replacingOccurrences(
            of: "\"scanPreviewRotationAngle\": 270",
            with: "\"scanPreviewRotationAngle\": 180"
        )
        .data(using: .utf8)!
    let decodedPreviewAngleMismatch = try? JSONDecoder().decode(RealImageFixtureManifest.self, from: previewAngleMismatchData)
    if let fixture = decodedPreviewAngleMismatch?.fixtures.first {
        var previewAngleMismatchCoverage = FixtureCoverage()
        previewAngleMismatchCoverage.record(fixture, manifestURL: URL(fileURLWithPath: "manifest.json"))
        assertTrue(
            previewAngleMismatchCoverage.incompleteMetadata.contains { $0.contains("orientation angle mismatch") },
            "Camera fixture with stale preview orientation angle metadata is incomplete"
        )
    }

    let invalidOrientationDimensionsData = acceptQualityManifestString
        .replacingOccurrences(
            of: "\"imageWidth\": 1920",
            with: "\"imageWidth\": 0"
        )
        .data(using: .utf8)!
    let decodedInvalidOrientationDimensions = try? JSONDecoder().decode(
        RealImageFixtureManifest.self,
        from: invalidOrientationDimensionsData
    )
    if let fixture = decodedInvalidOrientationDimensions?.fixtures.first {
        var invalidOrientationDimensionsCoverage = FixtureCoverage()
        invalidOrientationDimensionsCoverage.record(fixture, manifestURL: URL(fileURLWithPath: "manifest.json"))
        assertTrue(
            invalidOrientationDimensionsCoverage.incompleteMetadata.contains { $0.contains("invalid orientation dimensions") },
            "Camera fixture with invalid orientation dimensions is incomplete"
        )
    }

    let invalidRawOrientationData = acceptQualityManifestString
        .replacingOccurrences(
            of: "\"rawImageWidth\": 1080",
            with: "\"rawImageWidth\": 0"
        )
        .data(using: .utf8)!
    let decodedInvalidRawOrientation = try? JSONDecoder().decode(RealImageFixtureManifest.self, from: invalidRawOrientationData)
    if let fixture = decodedInvalidRawOrientation?.fixtures.first {
        var invalidRawOrientationCoverage = FixtureCoverage()
        invalidRawOrientationCoverage.record(fixture, manifestURL: URL(fileURLWithPath: "manifest.json"))
        assertTrue(
            invalidRawOrientationCoverage.incompleteMetadata.contains { $0.contains("invalid raw orientation dimensions") },
            "Camera fixture with invalid raw orientation dimensions is incomplete"
        )
    }

    let rawDisplayMismatchData = acceptQualityManifestString
        .replacingOccurrences(
            of: "\"rawImageWidth\": 1080",
            with: "\"rawImageWidth\": 1920"
        )
        .data(using: .utf8)!
    let decodedRawDisplayMismatch = try? JSONDecoder().decode(RealImageFixtureManifest.self, from: rawDisplayMismatchData)
    if let fixture = decodedRawDisplayMismatch?.fixtures.first {
        var rawDisplayMismatchCoverage = FixtureCoverage()
        rawDisplayMismatchCoverage.record(fixture, manifestURL: URL(fileURLWithPath: "manifest.json"))
        assertTrue(
            rawDisplayMismatchCoverage.incompleteMetadata.contains { $0.contains("orientation raw/display dimension mismatch") },
            "Camera fixture with stale raw/display orientation dimensions is incomplete"
        )
    }

    let croppedOrientationData = acceptQualityManifestString
        .replacingOccurrences(
            of: "\"rawImageWidth\": 1080",
            with: "\"rawImageWidth\": null"
        )
        .replacingOccurrences(
            of: "\"rawImageHeight\": 1920",
            with: "\"rawImageHeight\": null"
        )
        .replacingOccurrences(
            of: "\"imageWidth\": 1920",
            with: "\"imageWidth\": 806"
        )
        .replacingOccurrences(
            of: "\"imageHeight\": 1080",
            with: "\"imageHeight\": 801"
        )
        .data(using: .utf8)!
    let decodedCroppedOrientation = try? JSONDecoder().decode(RealImageFixtureManifest.self, from: croppedOrientationData)
    if let fixture = decodedCroppedOrientation?.fixtures.first {
        var croppedOrientationCoverage = FixtureCoverage()
        croppedOrientationCoverage.record(fixture, manifestURL: URL(fileURLWithPath: "manifest.json"))
        assertTrue(
            croppedOrientationCoverage.incompleteMetadata.isEmpty,
            "Camera fixture with cropped orientation metadata is complete - \(croppedOrientationCoverage.incompleteMetadata.joined(separator: ", "))"
        )
    }
}

let acceptWithoutOrientationJSON = """
{
  "fixtures": [
    {
      "name": "webcam-cie-front",
      "image": "webcam/cie-front.png",
      "expect": "accept",
      "quality": "usable",
      "ocrProvider": "vision",
      "captureSource": "webcam",
      "documentSide": "cie_front",
      "condition": "good",
      "expected": {
        "documentType": "CIE_FRONT",
        "surname": "ROSSI",
        "name": "MARIO",
        "codiceFiscale": "RSSMRA90M15H501Y",
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
let decodedAcceptWithoutOrientation = try? JSONDecoder().decode(RealImageFixtureManifest.self, from: acceptWithoutOrientationJSON)
if let fixture = decodedAcceptWithoutOrientation?.fixtures.first {
    var missingOrientationCoverage = FixtureCoverage()
    missingOrientationCoverage.record(fixture, manifestURL: URL(fileURLWithPath: "manifest.json"))
    assertTrue(
        missingOrientationCoverage.incompleteMetadata.contains { $0.contains("missing orientation") },
        "Camera fixture without orientation metadata is incomplete"
    )
    assertTrue(
        missingOrientationCoverage.incompleteMetadata.contains { $0.contains("missing matrixTarget") },
        "Camera fixture without matrix target is incomplete"
    )
    assertTrue(
        missingOrientationCoverage.incompleteMetadata.contains { $0.contains("missing diagnostics") },
        "Camera fixture without diagnostics metadata is incomplete"
    )
    assertTrue(
        missingOrientationCoverage.incompleteMetadata.contains { $0.contains("missing observed") },
        "Camera fixture without observed metadata is incomplete"
    )
    assertTrue(
        missingOrientationCoverage.incompleteMetadata.contains { $0.contains("missing observedItems") },
        "Camera fixture without observed OCR item metadata is incomplete"
    )
}

let malformedObservedItemsJSON = """
{
  "fixtures": [
    {
      "name": "webcam-malformed-ocr-items",
      "image": "webcam/malformed.png",
      "expect": "reject",
      "quality": "ignore",
      "ocrProvider": "vision",
      "captureSource": "webcam",
      "documentSide": "negative",
      "condition": "non-document",
      "orientation": {
        "ocrVisionOrientation": "up",
        "snapshotDisplayOrientation": "up",
        "basePreviewRotationAngle": 0,
        "scanPreviewRotationAngle": 0,
        "baseCaptureRotationAngle": 0,
        "scanCaptureRotationAngle": 0,
        "rawImageWidth": 1280,
        "rawImageHeight": 720,
        "imageWidth": 1280,
        "imageHeight": 720
      },
      "diagnostics": {
        "frameQuality": "usable (sharpness 12.00, glare 0.000, dark 0.000, mean 180.0)",
        "canCapture": false,
        "canGuideLiveScan": false,
        "score": 0,
        "markerCount": 0,
        "itemCount": 2,
        "missingFrontNames": false,
        "reasons": []
      },
      "observed": {
        "documentType": "UNKNOWN",
        "surname": null,
        "name": null,
        "codiceFiscale": null,
        "documentNumber": null,
        "dateOfBirth": null,
        "placeOfBirth": null,
        "gender": null,
        "expiryDate": null,
        "nationality": null,
        "cardNumber": null
      },
      "observedItems": [
        {
          "text": "",
          "confidence": 1.2,
          "boundingBox": {
            "x": -0.1,
            "y": 0.2,
            "width": 0.3,
            "height": 0.4
          }
        }
      ]
    }
  ]
}
""".data(using: .utf8)!
let decodedMalformedObservedItems = try? JSONDecoder().decode(RealImageFixtureManifest.self, from: malformedObservedItemsJSON)
if let fixture = decodedMalformedObservedItems?.fixtures.first {
    var malformedObservedItemsCoverage = FixtureCoverage()
    malformedObservedItemsCoverage.record(fixture, manifestURL: URL(fileURLWithPath: "manifest.json"))
    assertTrue(
        malformedObservedItemsCoverage.incompleteMetadata.contains { $0.contains("invalid observedItems") },
        "Camera fixture with malformed observed OCR items is incomplete"
    )
    assertTrue(
        malformedObservedItemsCoverage.incompleteMetadata.contains { $0.contains("observedItems count mismatch") },
        "Camera fixture with mismatched observed OCR item count is incomplete"
    )
    assertTrue(
        malformedObservedItemsCoverage.incompleteMetadata.contains { $0.contains("empty rejection reasons") },
        "Rejected camera fixture with empty diagnostic reasons is incomplete"
    )
}

let malformedObservedBarcodesJSON = """
{
  "fixtures": [
    {
      "name": "webcam-malformed-barcode",
      "image": "webcam/malformed-barcode.png",
      "expect": "reject",
      "quality": "ignore",
      "ocrProvider": "vision",
      "captureSource": "webcam",
      "documentSide": "negative",
      "condition": "non-document",
      "orientation": {
        "ocrVisionOrientation": "up",
        "snapshotDisplayOrientation": "up",
        "basePreviewRotationAngle": 0,
        "scanPreviewRotationAngle": 0,
        "baseCaptureRotationAngle": 0,
        "scanCaptureRotationAngle": 0,
        "rawImageWidth": 1280,
        "rawImageHeight": 720,
        "imageWidth": 1280,
        "imageHeight": 720
      },
      "diagnostics": {
        "frameQuality": "usable (sharpness 12.00, glare 0.000, dark 0.000, mean 180.0)",
        "canCapture": false,
        "canGuideLiveScan": false,
        "score": 0,
        "markerCount": 0,
        "itemCount": 0,
        "missingFrontNames": false,
        "reasons": ["missingIdentifier"]
      },
      "observed": {
        "documentType": "UNKNOWN",
        "surname": null,
        "name": null,
        "codiceFiscale": null,
        "documentNumber": null,
        "dateOfBirth": null,
        "placeOfBirth": null,
        "gender": null,
        "expiryDate": null,
        "nationality": null,
        "cardNumber": null
      },
      "observedItems": [],
      "observedBarcodes": [
        {
          "payload": "",
          "confidence": 1.2,
          "boundingBox": { "x": -0.1, "y": 0.2, "width": 0.3, "height": 0.4 },
          "imageBounds": { "x": -1, "y": 1, "width": 0, "height": 2 }
        }
      ]
    }
  ]
}
""".data(using: .utf8)!
let decodedMalformedObservedBarcodes = try? JSONDecoder().decode(RealImageFixtureManifest.self, from: malformedObservedBarcodesJSON)
if let fixture = decodedMalformedObservedBarcodes?.fixtures.first {
    var malformedObservedBarcodesCoverage = FixtureCoverage()
    malformedObservedBarcodesCoverage.record(fixture, manifestURL: URL(fileURLWithPath: "manifest.json"))
    let image = NSImage(
        cgImage: makeSolidCGImage(width: 1280, height: 720),
        size: NSSize(width: 1280, height: 720)
    )
    malformedObservedBarcodesCoverage.recordLoadedImage(image, fixture: fixture, manifestURL: URL(fileURLWithPath: "manifest.json"))
    assertTrue(
        malformedObservedBarcodesCoverage.incompleteMetadata.contains { $0.contains("invalid observedBarcodes") },
        "Camera fixture with malformed observed barcode metadata is incomplete"
    )
    assertTrue(
        malformedObservedBarcodesCoverage.incompleteMetadata.contains { $0.contains("observedBarcodes image bounds mismatch") },
        "Camera fixture with stale observed barcode image bounds is incomplete"
    )
}

let inconsistentDiagnosticsJSON = """
{
  "fixtures": [
    {
      "name": "webcam-accepted-but-diagnostics-reject",
      "image": "webcam/accepted.png",
      "expect": "accept",
      "quality": "usable",
      "ocrProvider": "vision",
      "captureSource": "webcam",
      "documentSide": "tessera_front",
      "condition": "good",
      "orientation": {
        "ocrVisionOrientation": "up",
        "snapshotDisplayOrientation": "up",
        "basePreviewRotationAngle": 0,
        "scanPreviewRotationAngle": 0,
        "baseCaptureRotationAngle": 0,
        "scanCaptureRotationAngle": 0,
        "rawImageWidth": 1280,
        "rawImageHeight": 720,
        "imageWidth": 1280,
        "imageHeight": 720
      },
      "diagnostics": {
        "frameQuality": "usable (sharpness 12.00, glare 0.000, dark 0.000, mean 180.0)",
        "canCapture": false,
        "canGuideLiveScan": true,
        "score": 18,
        "markerCount": 3,
        "itemCount": 1,
        "missingFrontNames": false,
        "reasons": ["missingFrontNames"]
      },
      "observed": {
        "documentType": "TESSERA_SANITARIA_FRONT",
        "surname": "ROSSI",
        "name": "MARIA",
        "codiceFiscale": "RSSMRA95T64F205W",
        "documentNumber": null,
        "dateOfBirth": "24/12/1995",
        "placeOfBirth": "MILANO",
        "gender": null,
        "expiryDate": "24/12/2029",
        "nationality": null,
        "cardNumber": null
      },
      "observedItems": [
        {
          "text": "COGNOME ROSSI",
          "confidence": 0.95,
          "boundingBox": {
            "x": 0.20,
            "y": 0.62,
            "width": 0.25,
            "height": 0.05
          }
        }
      ],
      "expected": {
        "documentType": "TESSERA_SANITARIA_FRONT",
        "surname": "ROSSI",
        "name": "MARIA",
        "codiceFiscale": "RSSMRA95T64F205W",
        "documentNumber": null,
        "dateOfBirth": "24/12/1995",
        "placeOfBirth": "MILANO",
        "gender": null,
        "expiryDate": "24/12/2029",
        "nationality": null,
        "cardNumber": null
      }
    },
    {
      "name": "webcam-rejected-but-diagnostics-accept",
      "image": "webcam/rejected.png",
      "expect": "reject",
      "quality": "ignore",
      "ocrProvider": "vision",
      "captureSource": "webcam",
      "documentSide": "negative",
      "condition": "partial-frame",
      "orientation": {
        "ocrVisionOrientation": "up",
        "snapshotDisplayOrientation": "up",
        "basePreviewRotationAngle": 0,
        "scanPreviewRotationAngle": 0,
        "baseCaptureRotationAngle": 0,
        "scanCaptureRotationAngle": 0,
        "rawImageWidth": 1280,
        "rawImageHeight": 720,
        "imageWidth": 1280,
        "imageHeight": 720
      },
      "diagnostics": {
        "frameQuality": "usable (sharpness 12.00, glare 0.000, dark 0.000, mean 180.0)",
        "canCapture": true,
        "canGuideLiveScan": true,
        "score": 18,
        "markerCount": 3,
        "itemCount": 1,
        "missingFrontNames": false,
        "reasons": []
      },
      "observed": {
        "documentType": "UNKNOWN",
        "surname": null,
        "name": null,
        "codiceFiscale": null,
        "documentNumber": null,
        "dateOfBirth": null,
        "placeOfBirth": null,
        "gender": null,
        "expiryDate": null,
        "nationality": null,
        "cardNumber": null
      },
      "observedItems": [
        {
          "text": "TESSERA SANITARIA",
          "confidence": 0.90,
          "boundingBox": {
            "x": 0.20,
            "y": 0.62,
            "width": 0.25,
            "height": 0.05
          }
        }
      ]
    },
    {
      "name": "webcam-front-missing-names-stale-diagnostics",
      "image": "webcam/front-missing-names.png",
      "expect": "reject",
      "quality": "ignore",
      "ocrProvider": "vision",
      "captureSource": "webcam",
      "documentSide": "negative",
      "condition": "partial-frame",
      "orientation": {
        "ocrVisionOrientation": "up",
        "snapshotDisplayOrientation": "up",
        "basePreviewRotationAngle": 0,
        "scanPreviewRotationAngle": 0,
        "baseCaptureRotationAngle": 0,
        "scanCaptureRotationAngle": 0,
        "rawImageWidth": 1280,
        "rawImageHeight": 720,
        "imageWidth": 1280,
        "imageHeight": 720
      },
      "diagnostics": {
        "frameQuality": "usable (sharpness 12.00, glare 0.000, dark 0.000, mean 180.0)",
        "canCapture": false,
        "canGuideLiveScan": true,
        "score": 8,
        "markerCount": 2,
        "itemCount": 1,
        "missingFrontNames": false,
        "reasons": ["missingFrontNames"]
      },
      "observed": {
        "documentType": "TESSERA_SANITARIA_FRONT",
        "surname": null,
        "name": null,
        "codiceFiscale": "RSSMRA95T64F205W",
        "documentNumber": null,
        "dateOfBirth": "24/12/1995",
        "placeOfBirth": null,
        "gender": null,
        "expiryDate": null,
        "nationality": null,
        "cardNumber": null
      },
      "observedItems": [
        {
          "text": "CODICE FISCALE RSSMRA95T64F205W",
          "confidence": 0.92,
          "boundingBox": {
            "x": 0.20,
            "y": 0.62,
            "width": 0.35,
            "height": 0.05
          }
        }
      ]
    }
  ]
}
""".data(using: .utf8)!
let decodedInconsistentDiagnostics = try? JSONDecoder().decode(RealImageFixtureManifest.self, from: inconsistentDiagnosticsJSON)
if let fixtures = decodedInconsistentDiagnostics?.fixtures {
    var inconsistentDiagnosticsCoverage = FixtureCoverage()
    for fixture in fixtures {
        inconsistentDiagnosticsCoverage.record(fixture, manifestURL: URL(fileURLWithPath: "manifest.json"))
    }
    assertTrue(
        inconsistentDiagnosticsCoverage.incompleteMetadata.contains { $0.contains("accepted fixture diagnostics reject") },
        "Accepted camera fixture with rejecting diagnostics is incomplete"
    )
    assertTrue(
        inconsistentDiagnosticsCoverage.incompleteMetadata.contains { $0.contains("rejected fixture diagnostics accept") },
        "Rejected camera fixture with accepting diagnostics is incomplete"
    )
    assertTrue(
        inconsistentDiagnosticsCoverage.incompleteMetadata.contains { $0.contains("missingFrontNames mismatch") },
        "Camera fixture with stale missing-front-names diagnostics is incomplete"
    )
}

let orientationDimensionMismatchJSON = """
{
  "fixtures": [
    {
      "name": "webcam-orientation-size-mismatch",
      "image": "webcam/mismatch.png",
      "expect": "reject",
      "quality": "ignore",
      "ocrProvider": "vision",
      "captureSource": "webcam",
      "documentSide": "negative",
      "condition": "partial-frame",
      "orientation": {
        "ocrVisionOrientation": "up",
        "snapshotDisplayOrientation": "up",
        "basePreviewRotationAngle": 0,
        "scanPreviewRotationAngle": 0,
        "baseCaptureRotationAngle": 0,
        "scanCaptureRotationAngle": 0,
        "rawImageWidth": 1280,
        "rawImageHeight": 720,
        "imageWidth": 1280,
        "imageHeight": 720
      },
      "diagnostics": {
        "frameQuality": "usable (sharpness 12.00, glare 0.000, dark 0.000, mean 180.0)",
        "canCapture": false,
        "canGuideLiveScan": false,
        "score": 0,
        "markerCount": 0,
        "itemCount": 1,
        "missingFrontNames": false,
        "reasons": ["implausibleLayout"]
      },
      "observed": {
        "documentType": "UNKNOWN",
        "surname": null,
        "name": null,
        "codiceFiscale": null,
        "documentNumber": null,
        "dateOfBirth": null,
        "placeOfBirth": null,
        "gender": null,
        "expiryDate": null,
        "nationality": null,
        "cardNumber": null
      },
      "observedItems": [
        {
          "text": "TESSERA SANITARIA",
          "confidence": 0.90,
          "boundingBox": {
            "x": 0.20,
            "y": 0.62,
            "width": 0.25,
            "height": 0.05
          }
        }
      ]
    }
  ]
}
""".data(using: .utf8)!
let decodedOrientationDimensionMismatch = try? JSONDecoder().decode(RealImageFixtureManifest.self, from: orientationDimensionMismatchJSON)
if let fixture = decodedOrientationDimensionMismatch?.fixtures.first {
    var orientationDimensionCoverage = FixtureCoverage()
    let image = NSImage(
        cgImage: makeSolidCGImage(width: 320, height: 240),
        size: NSSize(width: 320, height: 240)
    )
    orientationDimensionCoverage.record(fixture, manifestURL: URL(fileURLWithPath: "manifest.json"))
    orientationDimensionCoverage.recordLoadedImage(image, fixture: fixture, manifestURL: URL(fileURLWithPath: "manifest.json"))
    assertTrue(
        orientationDimensionCoverage.incompleteMetadata.contains { $0.contains("orientation image dimensions mismatch") },
        "Camera fixture with stale orientation image dimensions is incomplete"
    )
}

let observedImageBoundsMismatchJSON = """
{
  "fixtures": [
    {
      "name": "webcam-observed-image-bounds-mismatch",
      "image": "webcam/bounds-mismatch.png",
      "expect": "reject",
      "quality": "ignore",
      "ocrProvider": "vision",
      "captureSource": "webcam",
      "documentSide": "negative",
      "condition": "partial-frame",
      "orientation": {
        "ocrVisionOrientation": "up",
        "snapshotDisplayOrientation": "up",
        "basePreviewRotationAngle": 0,
        "scanPreviewRotationAngle": 0,
        "baseCaptureRotationAngle": 0,
        "scanCaptureRotationAngle": 0,
        "rawImageWidth": 320,
        "rawImageHeight": 240,
        "imageWidth": 320,
        "imageHeight": 240
      },
      "diagnostics": {
        "frameQuality": "usable (sharpness 12.00, glare 0.000, dark 0.000, mean 180.0)",
        "canCapture": false,
        "canGuideLiveScan": false,
        "score": 0,
        "markerCount": 0,
        "itemCount": 1,
        "missingFrontNames": false,
        "reasons": ["implausibleLayout"]
      },
      "observed": {
        "documentType": "UNKNOWN",
        "surname": null,
        "name": null,
        "codiceFiscale": null,
        "documentNumber": null,
        "dateOfBirth": null,
        "placeOfBirth": null,
        "gender": null,
        "expiryDate": null,
        "nationality": null,
        "cardNumber": null
      },
      "observedItems": [
        {
          "text": "TESSERA SANITARIA",
          "confidence": 0.90,
          "boundingBox": {
            "x": 0.20,
            "y": 0.60,
            "width": 0.25,
            "height": 0.10
          },
          "imageBounds": {
            "x": 64,
            "y": 144,
            "width": 80,
            "height": 24
          }
        }
      ]
    }
  ]
}
""".data(using: .utf8)!
let decodedObservedImageBoundsMismatch = try? JSONDecoder().decode(RealImageFixtureManifest.self, from: observedImageBoundsMismatchJSON)
if let fixture = decodedObservedImageBoundsMismatch?.fixtures.first {
    var observedImageBoundsCoverage = FixtureCoverage()
    let image = NSImage(
        cgImage: makeSolidCGImage(width: 320, height: 240),
        size: NSSize(width: 320, height: 240)
    )
    observedImageBoundsCoverage.record(fixture, manifestURL: URL(fileURLWithPath: "manifest.json"))
    observedImageBoundsCoverage.recordLoadedImage(image, fixture: fixture, manifestURL: URL(fileURLWithPath: "manifest.json"))
    assertTrue(
        observedImageBoundsCoverage.incompleteMetadata.contains { $0.contains("observedItems image bounds mismatch") },
        "Camera fixture with stale observed OCR image bounds is incomplete"
    )
}

let frameQualityMetricsMismatchJSON = """
{
  "fixtures": [
    {
      "name": "webcam-frame-quality-metrics-mismatch",
      "image": "webcam/quality-mismatch.png",
      "expect": "reject",
      "quality": "ignore",
      "ocrProvider": "vision",
      "captureSource": "webcam",
      "documentSide": "negative",
      "condition": "partial-frame",
      "orientation": {
        "ocrVisionOrientation": "up",
        "snapshotDisplayOrientation": "up",
        "basePreviewRotationAngle": 0,
        "scanPreviewRotationAngle": 0,
        "baseCaptureRotationAngle": 0,
        "scanCaptureRotationAngle": 0,
        "rawImageWidth": 320,
        "rawImageHeight": 240,
        "imageWidth": 320,
        "imageHeight": 240
      },
      "diagnostics": {
        "frameQuality": "usable (sharpness 12.00, glare 0.000, dark 0.000, mean 180.0)",
        "frameQualityMetrics": {
          "sharpness": 12.0,
          "glareRatio": 0.0,
          "darkRatio": 0.0,
          "meanLuma": 180.0,
          "usable": true,
          "failureReasons": []
        },
        "canCapture": false,
        "canGuideLiveScan": false,
        "score": 0,
        "markerCount": 0,
        "itemCount": 1,
        "missingFrontNames": false,
        "reasons": ["implausibleLayout"]
      },
      "observed": {
        "documentType": "UNKNOWN",
        "surname": null,
        "name": null,
        "codiceFiscale": null,
        "documentNumber": null,
        "dateOfBirth": null,
        "placeOfBirth": null,
        "gender": null,
        "expiryDate": null,
        "nationality": null,
        "cardNumber": null
      },
      "observedItems": [
        {
          "text": "TESSERA SANITARIA",
          "confidence": 0.90,
          "boundingBox": {
            "x": 0.20,
            "y": 0.60,
            "width": 0.25,
            "height": 0.10
          },
          "imageBounds": {
            "x": 64,
            "y": 72,
            "width": 80,
            "height": 24
          }
        }
      ]
    }
  ]
}
""".data(using: .utf8)!
let decodedFrameQualityMetricsMismatch = try? JSONDecoder().decode(RealImageFixtureManifest.self, from: frameQualityMetricsMismatchJSON)
if let fixture = decodedFrameQualityMetricsMismatch?.fixtures.first {
    var frameQualityMetricsCoverage = FixtureCoverage()
    let image = NSImage(
        cgImage: makeSolidCGImage(width: 320, height: 240),
        size: NSSize(width: 320, height: 240)
    )
    frameQualityMetricsCoverage.record(fixture, manifestURL: URL(fileURLWithPath: "manifest.json"))
    frameQualityMetricsCoverage.recordLoadedImage(image, fixture: fixture, manifestURL: URL(fileURLWithPath: "manifest.json"))
    assertTrue(
        frameQualityMetricsCoverage.incompleteMetadata.contains { $0.contains("frame quality metrics mismatch") },
        "Camera fixture with stale frame quality metrics is incomplete"
    )
}

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

let defaultFixtureRoot = realImageFixtureRootURL(environment: [:], currentDirectoryPath: "/tmp/scanid")
assertEqual(defaultFixtureRoot.path, "/tmp/scanid/OCRFixtures", "Fixture root defaults to OCRFixtures under current directory")
let relativeFixtureRoot = realImageFixtureRootURL(
    environment: ["SCANID_OCR_FIXTURES_DIR": "tmp-fixtures"],
    currentDirectoryPath: "/tmp/scanid"
)
assertEqual(relativeFixtureRoot.path, "/tmp/scanid/tmp-fixtures", "Fixture root accepts relative environment override")
let absoluteFixtureRoot = realImageFixtureRootURL(
    environment: ["SCANID_OCR_FIXTURES_DIR": "/tmp/scanid-custom-fixtures"],
    currentDirectoryPath: "/tmp/scanid"
)
assertEqual(absoluteFixtureRoot.path, "/tmp/scanid-custom-fixtures", "Fixture root accepts absolute environment override")

let emptyCoverageFailures = FixtureCoverage().strictCoverageFailures()
assertTrue(emptyCoverageFailures.contains("at least one real fixture manifest"), "Strict fixture coverage reports missing manifest")
assertTrue(emptyCoverageFailures.contains("capture source webcam"), "Strict fixture coverage reports missing webcam from empty corpus")
assertTrue(emptyCoverageFailures.contains("capture source continuity"), "Strict fixture coverage reports missing Continuity Camera from empty corpus")
assertTrue(emptyCoverageFailures.contains("accepted document side cie_front"), "Strict fixture coverage reports missing document sides from empty corpus")
assertTrue(emptyCoverageFailures.contains("accepted webcam document side cie_front"), "Strict fixture coverage reports missing webcam document-side matrix")
assertTrue(emptyCoverageFailures.contains("accepted continuity document side cie_front"), "Strict fixture coverage reports missing Continuity Camera document-side matrix")
assertTrue(emptyCoverageFailures.contains("condition tilted"), "Strict fixture coverage reports missing tilted condition from empty corpus")
assertTrue(emptyCoverageFailures.contains("condition non-document"), "Strict fixture coverage reports missing non-document condition from empty corpus")
assertTrue(emptyCoverageFailures.contains("condition webcam non-document"), "Strict fixture coverage reports missing webcam non-document condition")
assertTrue(emptyCoverageFailures.contains("condition continuity non-document"), "Strict fixture coverage reports missing Continuity Camera non-document condition")
assertTrue(emptyCoverageFailures.contains("accepted condition good"), "Strict fixture coverage reports missing accepted good condition")
assertTrue(emptyCoverageFailures.contains("rejected condition non-document"), "Strict fixture coverage reports missing rejected non-document condition")

var incompleteCoverage = FixtureCoverage()
incompleteCoverage.manifests = 1
incompleteCoverage.fixtures = 1
incompleteCoverage.accepted = 1
incompleteCoverage.captureSources = ["webcam"]
incompleteCoverage.acceptedDocumentSides = ["cie_front"]
incompleteCoverage.acceptedSourceDocumentSides = ["webcam:cie_front"]
incompleteCoverage.conditions = ["good"]
incompleteCoverage.sourceConditions = ["webcam:good"]
let incompleteCoverageFailures = incompleteCoverage.strictCoverageFailures()
let incompleteMatrixRows = incompleteCoverage.acceptedSourceSideMatrixRows()
let incompleteConditionRows = incompleteCoverage.sourceConditionMatrixRows()
assertTrue(incompleteCoverageFailures.contains("capture source continuity"), "Strict fixture coverage requires Continuity Camera")
assertTrue(incompleteCoverageFailures.contains("accepted document side tessera_back"), "Strict fixture coverage requires all accepted document sides")
assertTrue(incompleteCoverageFailures.contains("accepted continuity document side cie_front"), "Strict fixture coverage requires each document side per camera source")
assertTrue(incompleteCoverageFailures.contains("condition partial-frame"), "Strict fixture coverage requires bad-frame conditions")
assertTrue(incompleteCoverageFailures.contains("condition non-document"), "Strict fixture coverage requires non-document conditions")
assertTrue(incompleteCoverageFailures.contains("condition webcam partial-frame"), "Strict fixture coverage requires webcam bad-frame conditions")
assertTrue(incompleteCoverageFailures.contains("condition continuity good"), "Strict fixture coverage requires Continuity Camera good condition")
assertTrue(incompleteCoverageFailures.contains("rejected condition webcam partial-frame"), "Strict fixture coverage requires webcam rejected bad-frame conditions")
assertTrue(incompleteCoverageFailures.contains("accepted condition continuity good"), "Strict fixture coverage requires Continuity Camera accepted good condition")
assertTrue(
    incompleteMatrixRows.contains("- accepted webcam: cie_back=missing, cie_front=ok, tessera_back=missing, tessera_front=missing"),
    "Strict fixture matrix summary marks collected webcam side"
)
assertTrue(
    incompleteMatrixRows.contains("- accepted continuity: cie_back=missing, cie_front=missing, tessera_back=missing, tessera_front=missing"),
    "Strict fixture matrix summary marks missing Continuity sides"
)
assertTrue(
    incompleteConditionRows.contains("- conditions webcam: dark-background=missing, glare=missing, good=ok, light-background=missing, non-document=missing, partial-frame=missing, slight-blur=missing, tilted=missing"),
    "Strict fixture condition matrix summary marks collected webcam condition"
)
assertTrue(
    incompleteConditionRows.contains("- conditions continuity: dark-background=missing, glare=missing, good=missing, light-background=missing, non-document=missing, partial-frame=missing, slight-blur=missing, tilted=missing"),
    "Strict fixture condition matrix summary marks missing Continuity conditions"
)

var completeCoverage = FixtureCoverage()
completeCoverage.manifests = 2
completeCoverage.fixtures = 11
completeCoverage.accepted = 8
completeCoverage.rejected = 3
completeCoverage.captureSources = ["webcam", "continuity"]
completeCoverage.acceptedDocumentSides = ["cie_front", "cie_back", "tessera_front", "tessera_back"]
completeCoverage.acceptedSourceDocumentSides = Set(
    FixtureCoverage.requiredSources.flatMap { source in
        FixtureCoverage.requiredAcceptedSides.map { side in "\(source):\(side)" }
    }
)
completeCoverage.rejectedDocumentSides = ["negative"]
completeCoverage.documentSides = completeCoverage.acceptedDocumentSides.union(completeCoverage.rejectedDocumentSides)
completeCoverage.conditions = [
    "good",
    "tilted",
    "glare",
    "slight-blur",
    "dark-background",
    "light-background",
    "partial-frame",
    "non-document",
]
completeCoverage.sourceConditions = Set(
    FixtureCoverage.requiredSources.flatMap { source in
        FixtureCoverage.requiredConditions.map { condition in "\(source):\(condition)" }
    }
)
completeCoverage.acceptedSourceConditions = Set(
    FixtureCoverage.requiredSources.map { source in "\(source):good" }
)
completeCoverage.rejectedSourceConditions = Set(
    FixtureCoverage.requiredSources.flatMap { source in
        FixtureCoverage.requiredRejectedConditions.map { condition in "\(source):\(condition)" }
    }
)
let completeMatrixRows = completeCoverage.acceptedSourceSideMatrixRows()
let completeConditionRows = completeCoverage.sourceConditionMatrixRows()
assertTrue(completeCoverage.strictCoverageFailures().isEmpty, "Strict fixture coverage passes complete matrix")
assertTrue(
    completeMatrixRows.allSatisfy { !$0.contains("missing") },
    "Strict fixture matrix summary marks complete matrix"
)
assertTrue(
    completeConditionRows.allSatisfy { !$0.contains("missing") },
    "Strict fixture condition matrix summary marks complete condition matrix"
)

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
    "RSSMRA90M15H501Y",
    "Scadenza / Expiry Date",
    "15/08/2030"
]

let parsedCieFront = IDParser.parse(lines: cieFrontLines)
assertEqual(parsedCieFront.documentType, "CIE_FRONT", "CIE Front Type")
assertEqual(parsedCieFront.surname, "ROSSI", "CIE Front Surname")
assertEqual(parsedCieFront.name, "MARIO", "CIE Front Name")
assertEqual(parsedCieFront.codiceFiscale, "RSSMRA90M15H501Y", "CIE Front Codice Fiscale")
assertEqual(parsedCieFront.documentNumber, "CA12345AA", "CIE Front Document Number")
assertEqual(parsedCieFront.dateOfBirth, "15/08/1990", "CIE Front Date of Birth")
assertEqual(parsedCieFront.placeOfBirth, "ROMA", "CIE Front Place of Birth")
assertEqual(parsedCieFront.gender, "M", "CIE Front Gender")
assertEqual(parsedCieFront.expiryDate, "15/08/2030", "CIE Front Expiry Date")
assertEqual(parsedCieFront.nationality, "ITA", "CIE Front Nationality")

let spatialCieFrontNationality = IDParser.parse(ocrItems: [
    OCRTextItem(text: "REPUBBLICA ITALIANA", midX: 0.10, midY: 0.42),
    OCRTextItem(text: "CARTA DI IDENTITA", midX: 0.16, midY: 0.38),
    OCRTextItem(text: "DOCUMENTO NUMERO CA12345AA", midX: 0.23, midY: 0.31),
    OCRTextItem(text: "COGNOME ROSSI", midX: 0.30, midY: 0.20),
    OCRTextItem(text: "NOME MARIO", midX: 0.38, midY: 0.15),
    OCRTextItem(text: "SESSO M", midX: 0.60, midY: 0.13),
    OCRTextItem(text: "CITTADINANZA ITA", midX: 0.67, midY: 0.21),
    OCRTextItem(text: "CODICE FISCALE RSSMRA90M15H501Y", midX: 0.74, midY: 0.35),
])
assertEqual(
    spatialCieFrontNationality.nationality,
    "ITA",
    "CIE Front spatial nationality prefers label suffix over nearby gender label"
)

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

let cieBackWithConflictingCF = [
    "I<ITACA00000AA6<<<<<<<<<<<<<<<",
    "9008153M3008154ITA<<<<<<<<<<<6",
    "ROSSI<<MARIO<<<<<<<<<<<<<<<<<<",
    "VRDGPP80A01H501U",
    "VIA APPIA NUOVA 12",
    "ROMA (RM)"
]
let parsedCieBackWithConflictingCF = IDParser.parse(lines: cieBackWithConflictingCF)
assertEqual(parsedCieBackWithConflictingCF.documentType, "CIE_BACK", "CIE Back conflicting CF keeps MRZ type")
assertEqual(parsedCieBackWithConflictingCF.surname, "ROSSI", "CIE Back conflicting CF keeps MRZ surname")
assertEqual(parsedCieBackWithConflictingCF.name, "MARIO", "CIE Back conflicting CF keeps MRZ name")
assertEqual(parsedCieBackWithConflictingCF.codiceFiscale, nil, "CIE Back conflicting CF drops inconsistent codice fiscale")
assertEqual(parsedCieBackWithConflictingCF.dateOfBirth, "15/08/1990", "CIE Back conflicting CF keeps MRZ birth date")

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

let strongFrontOCRWithStaleBarcode = [
    makeItem("TESSERA SANITARIA", x: 0.20, y: 0.90),
    makeItem("COGNOME ROSSI", x: 0.20, y: 0.78),
    makeItem("NOME MARIA", x: 0.20, y: 0.70),
    makeItem("CODICE FISCALE RSSMRA95T64F205W", x: 0.20, y: 0.62),
    makeItem("DATA DI NASCITA 24/12/1995", x: 0.20, y: 0.54),
]
let parsedFrontWithStaleTSBackBarcode = ScanCaptureLogic.parseRecognizedItems(
    strongFrontOCRWithStaleBarcode,
    barcodePayloads: ["80380000000000012345|VRDGPP80A01H501U"]
)
assertEqual(
    parsedFrontWithStaleTSBackBarcode.documentType,
    "TESSERA_SANITARIA_FRONT",
    "Stale TS-back barcode does not override strong front OCR type"
)
assertEqual(
    parsedFrontWithStaleTSBackBarcode.codiceFiscale,
    "RSSMRA95T64F205W",
    "Stale TS-back barcode does not replace visible front codice fiscale"
)
assertEqual(
    parsedFrontWithStaleTSBackBarcode.cardNumber,
    nil,
    "Stale TS-back barcode does not inject card number into front OCR"
)
let weakVisibleFrontOCRWithStaleMRZ = [
    makeItem("TESSERA SANITARIA", x: 0.20, y: 0.90),
    makeItem("Cognome", x: 0.20, y: 0.78),
    makeItem("ESPOSITO", x: 0.38, y: 0.78),
    makeItem("Nome", x: 0.20, y: 0.70),
    makeItem("MARIO", x: 0.38, y: 0.70),
]
let staleCieBackMRZPayload = [
    "I<ITACA99999AA6<<<<<<<<<<<<<<<",
    "8001019M3001015ITA<<<<<<<<<<<6",
    "VERDI<<GIUSEPPE<<<<<<<<<<<<<<<",
    "VRDGPP80A01H501U"
].joined(separator: "\n")
let parsedWeakFrontWithStaleMRZ = ScanCaptureLogic.parseRecognizedItems(
    weakVisibleFrontOCRWithStaleMRZ,
    barcodePayloads: [staleCieBackMRZPayload]
)
assertEqual(
    parsedWeakFrontWithStaleMRZ.documentType,
    "TESSERA_SANITARIA_FRONT",
    "High-scoring stale CIE-back MRZ does not replace visible front OCR type"
)
assertEqual(
    parsedWeakFrontWithStaleMRZ.surname,
    "ESPOSITO",
    "High-scoring stale CIE-back MRZ does not replace visible front surname"
)
assertEqual(
    parsedWeakFrontWithStaleMRZ.name,
    "MARIO",
    "High-scoring stale CIE-back MRZ does not replace visible front name"
)
assertEqual(
    parsedWeakFrontWithStaleMRZ.codiceFiscale,
    nil,
    "High-scoring stale CIE-back MRZ does not inject incompatible codice fiscale"
)
let visibleFrontCFMissingNamesWithStaleMRZ = [
    makeItem("TESSERA SANITARIA", x: 0.20, y: 0.90),
    makeItem("Codice Fiscale SPSMRA71C05G023H", x: 0.20, y: 0.78),
]
let parsedFrontCFMissingNamesWithStaleMRZ = ScanCaptureLogic.parseRecognizedItems(
    visibleFrontCFMissingNamesWithStaleMRZ,
    barcodePayloads: [staleCieBackMRZPayload]
)
assertEqual(
    parsedFrontCFMissingNamesWithStaleMRZ.documentType,
    "TESSERA_SANITARIA_FRONT",
    "Stale CIE-back MRZ does not replace visible front OCR when names are missing"
)
assertEqual(
    parsedFrontCFMissingNamesWithStaleMRZ.codiceFiscale,
    "SPSMRA71C05G023H",
    "Stale CIE-back MRZ does not replace visible front codice fiscale when names are missing"
)
assertEqual(
    parsedFrontCFMissingNamesWithStaleMRZ.surname,
    nil,
    "Stale CIE-back MRZ does not inject surname into front OCR missing names"
)
assertEqual(
    parsedFrontCFMissingNamesWithStaleMRZ.name,
    nil,
    "Stale CIE-back MRZ does not inject name into front OCR missing names"
)
let visibleFrontLabelsOnlyWithStaleMRZ = [
    makeItem("TESSERA SANITARIA", x: 0.20, y: 0.90),
    makeItem("Cognome", x: 0.20, y: 0.78),
    makeItem("Nome", x: 0.20, y: 0.70),
]
let parsedFrontLabelsOnlyWithStaleMRZ = ScanCaptureLogic.parseRecognizedItems(
    visibleFrontLabelsOnlyWithStaleMRZ,
    barcodePayloads: [staleCieBackMRZPayload]
)
assertEqual(
    parsedFrontLabelsOnlyWithStaleMRZ.documentType,
    "TESSERA_SANITARIA_FRONT",
    "Stale CIE-back MRZ does not replace front labels-only OCR type"
)
assertEqual(
    parsedFrontLabelsOnlyWithStaleMRZ.codiceFiscale,
    nil,
    "Stale CIE-back MRZ does not inject codice fiscale when front names are missing"
)
assertEqual(
    parsedFrontLabelsOnlyWithStaleMRZ.surname,
    nil,
    "Stale CIE-back MRZ does not inject surname into labels-only front OCR"
)
assertEqual(
    parsedFrontLabelsOnlyWithStaleMRZ.name,
    nil,
    "Stale CIE-back MRZ does not inject name into labels-only front OCR"
)

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

let croppedTSFrontServiceHeaderLines = [
    "CARTA NAZ",
    "DEI SERVIZI",
    "CARTA REGIONALE DEI SERVIZI",
    "Codice SPSMRA71C05G023H",
    "Fiscale",
    "Cognome",
    "ESPOSITO",
    "Nome",
    "MARIO",
    "Luogo",
    "OLEVANO SUL TUSCIANO",
    "Data 05/03/1971",
    "di nascita",
    "Sesso",
    "M",
    "07/07/2031",
]
let parsedCroppedTSFrontServiceHeader = IDParser.parse(lines: croppedTSFrontServiceHeaderLines)
assertEqual(
    parsedCroppedTSFrontServiceHeader.documentType,
    "TESSERA_SANITARIA_FRONT",
    "Cropped TS front service header type"
)
assertEqual(parsedCroppedTSFrontServiceHeader.surname, "ESPOSITO", "Cropped TS front service header surname")
assertEqual(parsedCroppedTSFrontServiceHeader.name, "MARIO", "Cropped TS front service header name")
assertEqual(
    parsedCroppedTSFrontServiceHeader.codiceFiscale,
    "SPSMRA71C05G023H",
    "Cropped TS front service header codice fiscale"
)
assertEqual(parsedCroppedTSFrontServiceHeader.gender, "M", "Cropped TS front service header derives gender from CF")

let croppedTSFrontWithoutGenderLines = croppedTSFrontServiceHeaderLines.filter { $0 != "Sesso" && $0 != "M" }
let parsedCroppedTSFrontWithoutGender = IDParser.parse(lines: croppedTSFrontWithoutGenderLines)
assertEqual(
    parsedCroppedTSFrontWithoutGender.gender,
    "M",
    "Cropped TS front without printed gender derives gender from CF"
)

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
assertEqual(parsedTSNoSurname.surname, nil, "TS No Surname clears CF-inconsistent surname")
assertEqual(parsedTSNoSurname.name, nil, "TS No Surname clears birthplace misread as name")

let tsSidewaysContradictionLines = [
    "TESSERA SANITARIA",
    "Cognome ARTO",
    "Nome pinn",
    "Codice Fiscale SPSMRA71C05G023H",
    "Data di nascita 05/03/1971",
    "Sesso M",
    "Scadenza 07/07/2031",
]
let parsedTSSidewaysContradiction = IDParser.parse(lines: tsSidewaysContradictionLines)
assertEqual(parsedTSSidewaysContradiction.codiceFiscale, "SPSMRA71C05G023H", "Sideways TS keeps valid codice fiscale")
assertEqual(parsedTSSidewaysContradiction.surname, nil, "Sideways TS clears CF-inconsistent surname")
assertEqual(parsedTSSidewaysContradiction.name, nil, "Sideways TS clears CF-inconsistent name")
assertEqual(parsedTSSidewaysContradiction.dateOfBirth, "05/03/1971", "Sideways TS keeps CF-consistent birth date")
assertEqual(parsedTSSidewaysContradiction.gender, "M", "Sideways TS keeps CF-consistent gender")

let lowercaseSpatialNoiseItems = [
    OCRTextItem(text: "TESSERA SANITARIA", midX: 0.5, midY: 0.92),
    OCRTextItem(text: "Cognome", midX: 0.28, midY: 0.70),
    OCRTextItem(text: "arto", midX: 0.48, midY: 0.70),
    OCRTextItem(text: "Nome", midX: 0.28, midY: 0.62),
    OCRTextItem(text: "pinn", midX: 0.48, midY: 0.62),
]
let lowercaseSpatialNoiseParsed = IDParser.parse(ocrItems: lowercaseSpatialNoiseItems)
assertEqual(
    lowercaseSpatialNoiseParsed.surname,
    nil,
    "Spatial lowercase noise does not become unvalidated surname"
)
assertEqual(
    lowercaseSpatialNoiseParsed.name,
    nil,
    "Spatial lowercase noise does not become unvalidated name"
)

let tsBirthContradictionLines = [
    "TESSERA SANITARIA",
    "Cognome ROSSI",
    "Nome MARIO",
    "Codice Fiscale RSSMRA90A15H501Y",
    "Data di nascita 16/08/1990",
    "Sesso M",
]
let parsedTSBirthContradiction = IDParser.parse(lines: tsBirthContradictionLines)
assertEqual(parsedTSBirthContradiction.surname, "ROSSI", "TS birth contradiction keeps CF-consistent surname")
assertEqual(parsedTSBirthContradiction.name, "MARIO", "TS birth contradiction keeps CF-consistent name")
assertEqual(parsedTSBirthContradiction.dateOfBirth, nil, "TS birth contradiction clears CF-inconsistent date")
assertEqual(parsedTSBirthContradiction.gender, nil, "TS birth contradiction clears CF-inconsistent gender")

let tsBirthContradictionWithoutGenderLines = [
    "TESSERA SANITARIA",
    "Cognome ROSSI",
    "Nome MARIO",
    "Codice Fiscale RSSMRA90A15H501Y",
    "Data di nascita 16/08/1990",
]
let parsedTSBirthContradictionWithoutGender = IDParser.parse(lines: tsBirthContradictionWithoutGenderLines)
assertEqual(parsedTSBirthContradictionWithoutGender.surname, "ROSSI", "TS birth contradiction without gender keeps CF-consistent surname")
assertEqual(parsedTSBirthContradictionWithoutGender.name, "MARIO", "TS birth contradiction without gender keeps CF-consistent name")
assertEqual(parsedTSBirthContradictionWithoutGender.dateOfBirth, nil, "TS birth contradiction without gender clears CF-inconsistent date")

let tsPlaceContradictionLines = [
    "TESSERA SANITARIA",
    "Cognome ROSSI",
    "Nome MARIO",
    "Codice Fiscale RSSMRA90A15H501Y",
    "Data di nascita 15/01/1990",
    "Sesso M",
    "Luogo di nascita MILANO",
]
let parsedTSPlaceContradiction = IDParser.parse(lines: tsPlaceContradictionLines)
assertEqual(parsedTSPlaceContradiction.surname, "ROSSI", "TS place contradiction keeps CF-consistent surname")
assertEqual(parsedTSPlaceContradiction.name, "MARIO", "TS place contradiction keeps CF-consistent name")
assertEqual(parsedTSPlaceContradiction.dateOfBirth, "15/01/1990", "TS place contradiction keeps CF-consistent birth date")
assertEqual(parsedTSPlaceContradiction.placeOfBirth, nil, "TS place contradiction clears CF-inconsistent birthplace")

// Test Case 16: UI panel visible — spatial fields must come from card, not results panel
assertEqual(parsedTSUIPollution.placeOfBirth, "PONTECAGNANO FAIANO", "TS UI Pollution Place of Birth")
assertEqual(parsedTSUIPollution.dateOfBirth, "04/03/1952", "TS UI Pollution DOB")
assertEqual(parsedTSUIPollution.gender, "F", "TS UI Pollution Gender")

// Test Case 17: Canonicalize aligns parsed values with exact OCR bounding-box text
let canonicalItems = [
    RecognizedItem(text: "ROSSI", boundingBox: CGRect(x: 0.2, y: 0.7, width: 0.1, height: 0.03)),
    RecognizedItem(text: "MARIO", boundingBox: CGRect(x: 0.2, y: 0.6, width: 0.1, height: 0.03)),
    RecognizedItem(text: "Codice SPSMRA71C05G023H", boundingBox: CGRect(x: 0.2, y: 0.5, width: 0.3, height: 0.03)),
]
var canonicalParsed = IDData(
    documentType: "CIE_FRONT",
    surname: "ROSSI ",
    name: "mario",
    codiceFiscale: "SPSMRA71C05G023H",
    rawText: []
)
ScanCaptureLogic.canonicalizeFieldsToOCRItems(&canonicalParsed, items: canonicalItems)
assertEqual(canonicalParsed.surname, "ROSSI", "Canonicalize prefers exact OCR item text")
assertEqual(canonicalParsed.name, "MARIO", "Canonicalize prefers exact OCR item casing")
assertEqual(canonicalParsed.codiceFiscale, "SPSMRA71C05G023H", "Canonicalize keeps codice fiscale without label prefix")

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
assertTrue(
    ScanIDLaunchConfiguration.isLaunchSmokeTest(environment: ["SCANID_LAUNCH_SMOKE_TEST": "1"]),
    "Launch smoke test flag is enabled by environment"
)
assertTrue(
    !ScanIDLaunchConfiguration.isLaunchSmokeTest(environment: [:]),
    "Launch smoke test flag defaults off"
)
assertTrue(
    ScanIDLaunchConfiguration.disablesCameraAccess(environment: ["SCANID_LAUNCH_SMOKE_TEST": "1"]),
    "Launch smoke test disables camera access"
)
assertTrue(
    !ScanIDLaunchConfiguration.disablesCameraAccess(environment: [:]),
    "Normal launch keeps camera access available"
)
assertTrue(CameraOrientation.looksLikeContinuityCameraName("Mark's iPhone Camera"), "iPhone name hint")
assertTrue(!CameraOrientation.looksLikeContinuityCameraName("Logitech BRIO"), "Non-continuity name hint")

assertOrientation(CameraOrientation.visionOrientation(for: 0), .up, "Vision orientation 0°")
assertOrientation(CameraOrientation.visionOrientation(for: 90), .right, "Vision orientation 90°")
assertOrientation(CameraOrientation.visionOrientation(for: 180), .down, "Vision orientation 180°")
assertOrientation(CameraOrientation.visionOrientation(for: 270), .left, "Vision orientation 270°")
assertOrientation(CameraOrientation.visionOrientation(for: -90), .left, "Vision orientation -90°")
assertOrientation(CameraOrientation.visionOrientation(for: 450), .right, "Vision orientation wraps 450° to 90°")
assertEqual(CameraOrientation.orientationName(.right), "right", "Orientation name serializes right")
assertEqual(CameraOrientation.orientationName(.down), "down", "Orientation name serializes down")
assertOrientation(
    CameraOrientation.visionOrientationForOCR(baseCaptureAngle: 180),
    .down,
    "OCR orientation uses horizon capture angle without document offset"
)
assertTrue(
    CameraOrientation.videoDataOutputRotationAngle(scanCaptureAngle: 270) == nil,
    "Video data output stays raw so snapshot orientation is applied exactly once"
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
assertTrue(
    ScanIDDefaults.autoZoomOnCapture,
    "Auto zoom defaults on for stronger post-capture OCR"
)
assertTrue(
    ScanCaptureLogic.fixtureConditionLabels.contains("tilted"),
    "Fixture condition labels include tilted for real capture matrix exports"
)
assertTrue(
    Set(["good", "glare", "slight-blur", "dark-background", "light-background", "partial-frame", "non-document"])
        .isSubset(of: Set(ScanCaptureLogic.fixtureConditionLabels)),
    "Fixture condition labels include strict coverage labels"
)
assertEqual(
    ScanCaptureLogic.fixtureConditionChoices(accepted: true).joined(separator: ","),
    "good",
    "Accepted fixture condition picker only offers good"
)
assertTrue(
    !ScanCaptureLogic.fixtureConditionChoices(accepted: false).contains("good"),
    "Rejected fixture condition picker excludes good"
)
assertTrue(
    !ScanCaptureLogic.fixtureConditionChoices(accepted: false).contains("negative"),
    "Rejected fixture condition picker excludes legacy negative condition"
)
assertTrue(
    Set(["tilted", "glare", "slight-blur", "dark-background", "light-background", "partial-frame", "non-document"])
        .isSubset(of: Set(ScanCaptureLogic.fixtureConditionChoices(accepted: false))),
    "Rejected fixture condition picker offers degraded conditions"
)

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

let portraitCardImage = NSImage(cgImage: makeSolidCGImage(width: 300, height: 500), size: NSSize(width: 300, height: 500))
let portraitCardCGImage = portraitCardImage.cgImage(forProposedRect: nil, context: nil, hints: nil)!
let orientationCandidates = ScanCaptureLogic.cardOCRImageCandidates(
    image: portraitCardImage,
    cgImage: portraitCardCGImage
)
assertTrue(orientationCandidates.contains { $0.rotation == .up }, "OCR orientation candidates keep original image")
assertTrue(
    orientationCandidates.contains { $0.cgImage.width > $0.cgImage.height },
    "OCR orientation candidates include landscape rotation for sideways card"
)

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
    OCRTextItem(text: "Codice Fiscale SPSMRA71C05G023H", midX: 0.55, midY: 0.78),
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

let espositoHealthHeaderTrapItems = [
    OCRTextItem(text: "TESSERA SANITARIA", midX: 0.5, midY: 0.92),
    OCRTextItem(text: "Codice Fiscale SPSMRA71C05G023H", midX: 0.55, midY: 0.78),
    OCRTextItem(text: "Cognome", midX: 0.35, midY: 0.70),
    OCRTextItem(text: "ESPOSITO", midX: 0.55, midY: 0.70),
    OCRTextItem(text: "Nome", midX: 0.35, midY: 0.62),
    OCRTextItem(text: "MARIO", midX: 0.55, midY: 0.62),
    OCRTextItem(text: "Data di nascita", midX: 0.35, midY: 0.50),
    OCRTextItem(text: "05/03/1971", midX: 0.55, midY: 0.50),
    OCRTextItem(text: "Luogo di nascita", midX: 0.35, midY: 0.42),
    OCRTextItem(text: "NO SUL TUSCIANO", midX: 0.55, midY: 0.42),
    OCRTextItem(text: "Dati sanitari regionali", midX: 0.72, midY: 0.39),
    OCRTextItem(text: "Scadenza 07/07/2031", midX: 0.55, midY: 0.34),
]
let espositoHealthHeaderTrapParsed = IDParser.parse(ocrItems: espositoHealthHeaderTrapItems)
assertEqual(espositoHealthHeaderTrapParsed.surname, "ESPOSITO", "Health header trap keeps surname")
assertEqual(espositoHealthHeaderTrapParsed.name, "MARIO", "Health header trap keeps name")
assertEqual(espositoHealthHeaderTrapParsed.placeOfBirth, nil, "Health header trap rejects health metadata as birthplace")

assertEqual(noisyParsed.codiceFiscale, "SPSMRA71C05G023H", "Sanitize extracts codice fiscale without label prefix")
assertEqual(noisyParsed.dateOfBirth, "05/03/1971", "Sanitize extracts birth date without label prefix")

let edgeCaseLines = ["", "Cognome", "Nome", "SA", "M"]
let edgeParsed = IDParser.parse(lines: edgeCaseLines)
assertTrue(edgeParsed.documentType == "UNKNOWN" || edgeParsed.documentType != "", "Edge-case lines do not crash parser")

print("\n=== Running OCR Fixture Image Tests ===")

let syntheticTesseraFrontImage = makeOCRFixtureImage(lines: [
    "REPUBBLICA ITALIANA",
    "SERVIZIO SANITARIO NAZIONALE",
    "TESSERA SANITARIA",
    "COGNOME ROSSI",
    "NOME MARIA",
    "DATA DI NASCITA 24/12/1995",
    "LUOGO DI NASCITA MILANO",
    "CODICE FISCALE RSSMRA95T64F205W",
    "SCADENZA 24/12/2029",
])
let syntheticTesseraFrontExpected = IDData(
    documentType: "TESSERA_SANITARIA_FRONT",
    surname: "ROSSI",
    name: "MARIA",
    codiceFiscale: "RSSMRA95T64F205W",
    documentNumber: nil,
    dateOfBirth: "24/12/1995",
    placeOfBirth: "MILANO",
    gender: "F",
    expiryDate: "24/12/2029",
    nationality: nil,
    cardNumber: nil,
    rawText: []
)

let ocrFixtures = [
    RenderedOCRFixture(
        name: "Synthetic Tessera front",
        image: syntheticTesseraFrontImage,
        expected: syntheticTesseraFrontExpected
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
            "CODICE FISCALE RSSMRA90M15H501Y",
            "SCADENZA 15/08/2030",
        ]),
        expected: IDData(
            documentType: "CIE_FRONT",
            surname: "ROSSI",
            name: "MARIO",
            codiceFiscale: "RSSMRA90M15H501Y",
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

runAcceptedStaticCaptureFixture(
    name: "Rotated synthetic Tessera front static capture",
    image: rotatedFixtureImage(syntheticTesseraFrontImage, orientation: .right),
    expected: syntheticTesseraFrontExpected,
    qualityExpectation: .usable
)

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
let reliableCaptureItems = [
    makeItem("TESSERA SANITARIA", x: 0.25, y: 0.78),
    makeItem("Cognome", x: 0.20, y: 0.66),
    makeItem("ROSSI", x: 0.42, y: 0.66),
    makeItem("Nome", x: 0.20, y: 0.56),
    makeItem("MARIO", x: 0.42, y: 0.56),
    makeItem("RSSMRA90A15H501Y", x: 0.34, y: 0.46),
]
assertTrue(
    !ScanCaptureLogic.shouldAcceptCapture(reliableParsed),
    "Parser-only capture requires OCR item evidence"
)
assertTrue(
    ScanCaptureLogic.shouldAcceptCapture(reliableParsed, items: reliableCaptureItems),
    "CF plus identity fields with OCR item evidence is accepted"
)
var cieBackMRZParsed = IDData(documentType: "CIE_BACK", rawText: [])
cieBackMRZParsed.codiceFiscale = "RSSMRA90A15H501Y"
cieBackMRZParsed.documentNumber = "CA00000AA"
cieBackMRZParsed.surname = "ROSSI"
cieBackMRZParsed.name = "MARIO"
let cieBackMRZEvidenceItems = [
    RecognizedItem(text: "CARTA DI IDENTITA - RETRO", boundingBox: CGRect(x: 0.12, y: 0.78, width: 0.42, height: 0.05), confidence: 1),
    RecognizedItem(text: "CODICE FISCALE RSSMRA90A15H501Y", boundingBox: CGRect(x: 0.12, y: 0.68, width: 0.48, height: 0.05), confidence: 1),
    RecognizedItem(text: "VIA APPIA NUOVA 12", boundingBox: CGRect(x: 0.12, y: 0.58, width: 0.30, height: 0.05), confidence: 1),
    RecognizedItem(text: "ROMA RM", boundingBox: CGRect(x: 0.52, y: 0.58, width: 0.16, height: 0.05), confidence: 1),
    RecognizedItem(text: "I<ITACA00000AA6<<<<<<<<<<<<<<<", boundingBox: CGRect(x: 0.12, y: 0.30, width: 0.64, height: 0.05), confidence: 1),
    RecognizedItem(text: "9008153M3008154ITA<<<<<<<<<<<6", boundingBox: CGRect(x: 0.12, y: 0.22, width: 0.64, height: 0.05), confidence: 1),
    RecognizedItem(text: "ROSSI<<MARIO<<<<<<<<<<<<<<<<<<", boundingBox: CGRect(x: 0.12, y: 0.14, width: 0.64, height: 0.05), confidence: 1),
]
assertTrue(
    ScanCaptureLogic.shouldAcceptCapture(cieBackMRZParsed, items: cieBackMRZEvidenceItems),
    "CIE back MRZ compact OCR counts as identity and document-number evidence"
)
var frontWithoutNamesParsed = IDData(documentType: "TESSERA_SANITARIA_FRONT", rawText: [])
frontWithoutNamesParsed.codiceFiscale = "SPSMRA71C05G023H"
frontWithoutNamesParsed.dateOfBirth = "05/03/1971"
frontWithoutNamesParsed.gender = "M"
assertTrue(
    !ScanCaptureLogic.shouldAcceptCapture(frontWithoutNamesParsed),
    "Front capture rejects CF plus birth fields without reliable names"
)
assertTrue(
    ScanCaptureLogic.captureReadiness(parsed: frontWithoutNamesParsed).reasons.contains("missingFrontNames"),
    "Front capture reports missing name reason"
)
var conflictingCFParsed = IDData(documentType: "TESSERA_SANITARIA_FRONT", rawText: [])
conflictingCFParsed.codiceFiscale = "SPSMRA71C05G023H"
conflictingCFParsed.surname = "ARTO"
conflictingCFParsed.name = "PINN"
conflictingCFParsed.dateOfBirth = "05/03/1971"
conflictingCFParsed.gender = "M"
assertTrue(
    !ScanCaptureLogic.shouldAcceptCapture(conflictingCFParsed),
    "Final capture rejects name fields that conflict with codice fiscale"
)
assertTrue(
    ScanCaptureLogic.captureReadiness(parsed: conflictingCFParsed).reasons.contains("codiceFiscaleNameConflict"),
    "Final capture reports codice fiscale name conflict reason"
)
var conflictingCFBirthParsed = IDData(documentType: "TESSERA_SANITARIA_FRONT", rawText: [])
conflictingCFBirthParsed.codiceFiscale = "RSSMRA90A15H501Y"
conflictingCFBirthParsed.surname = "ROSSI"
conflictingCFBirthParsed.name = "MARIO"
conflictingCFBirthParsed.dateOfBirth = "16/08/1990"
conflictingCFBirthParsed.gender = "M"
assertTrue(
    !ScanCaptureLogic.shouldAcceptCapture(conflictingCFBirthParsed),
    "Final capture rejects birth fields that conflict with codice fiscale"
)
assertTrue(
    ScanCaptureLogic.captureReadiness(parsed: conflictingCFBirthParsed).reasons.contains("codiceFiscaleBirthConflict"),
    "Final capture reports codice fiscale birth conflict reason"
)
var conflictingCFBirthWithoutGenderParsed = IDData(documentType: "TESSERA_SANITARIA_FRONT", rawText: [])
conflictingCFBirthWithoutGenderParsed.codiceFiscale = "RSSMRA90A15H501Y"
conflictingCFBirthWithoutGenderParsed.surname = "ROSSI"
conflictingCFBirthWithoutGenderParsed.name = "MARIO"
conflictingCFBirthWithoutGenderParsed.dateOfBirth = "16/08/1990"
assertTrue(
    !ScanCaptureLogic.shouldAcceptCapture(conflictingCFBirthWithoutGenderParsed),
    "Final capture rejects birth date that conflicts with codice fiscale even without gender"
)
assertTrue(
    ScanCaptureLogic.captureReadiness(parsed: conflictingCFBirthWithoutGenderParsed).reasons.contains("codiceFiscaleBirthConflict"),
    "Final capture reports codice fiscale birth conflict without gender"
)
var conflictingCFPlaceParsed = IDData(documentType: "TESSERA_SANITARIA_FRONT", rawText: [])
conflictingCFPlaceParsed.codiceFiscale = "RSSMRA90A15H501Y"
conflictingCFPlaceParsed.surname = "ROSSI"
conflictingCFPlaceParsed.name = "MARIO"
conflictingCFPlaceParsed.dateOfBirth = "15/01/1990"
conflictingCFPlaceParsed.gender = "M"
conflictingCFPlaceParsed.placeOfBirth = "MILANO"
assertTrue(
    !ScanCaptureLogic.shouldAcceptCapture(conflictingCFPlaceParsed),
    "Final capture rejects birthplace that conflicts with codice fiscale"
)
assertTrue(
    ScanCaptureLogic.captureReadiness(parsed: conflictingCFPlaceParsed).reasons.contains("codiceFiscalePlaceConflict"),
    "Final capture reports codice fiscale birthplace conflict"
)
let scatteredFinalCaptureItems = [
    makeItem("TESSERA SANITARIA", x: 0.05, y: 0.92),
    makeItem("COGNOME ROSSI", x: 0.86, y: 0.12),
    makeItem("NOME MARIA", x: 0.12, y: 0.18),
    makeItem("CODICE FISCALE RSSMRA95T64F205W", x: 0.92, y: 0.82),
    makeItem("DATA DI NASCITA 24/12/1995", x: 0.48, y: 0.50),
]
assertTrue(
    !ScanCaptureLogic.shouldAcceptCapture(syntheticTesseraFrontExpected, items: scatteredFinalCaptureItems),
    "Final capture rejects strong fields when OCR layout is scattered"
)
assertTrue(
    ScanCaptureLogic.captureReadiness(parsed: syntheticTesseraFrontExpected, items: scatteredFinalCaptureItems).reasons.contains("implausibleLayout"),
    "Final capture reports implausible layout reason"
)
let scatteredReadiness = ScanCaptureLogic.captureReadiness(
    parsed: syntheticTesseraFrontExpected,
    items: scatteredFinalCaptureItems,
    frameQuality: .good
)
assertEqual(
    ScanCaptureLogic.fixtureConditionLabel(
        accepted: false,
        readiness: scatteredReadiness,
        frameQuality: .good
    ),
    "partial-frame",
    "Fixture condition labels implausible layout as partial frame"
)
let unknownDocumentReadiness = ScanCaptureLogic.captureReadiness(
    parsed: IDData(documentType: "UNKNOWN", rawText: []),
    items: [
        makeItem("WELCOME", x: 0.25, y: 0.78),
        makeItem("MENU", x: 0.25, y: 0.68),
        makeItem("TOTAL", x: 0.25, y: 0.58),
    ],
    frameQuality: .good
)
assertEqual(
    ScanCaptureLogic.fixtureConditionLabel(
        accepted: false,
        readiness: unknownDocumentReadiness,
        frameQuality: .good
    ),
    "non-document",
    "Fixture condition labels missing identifiers as non-document"
)
assertEqual(
    ScanCaptureLogic.fixtureConditionLabel(
        accepted: false,
        readiness: ScanCaptureLogic.captureReadiness(parsed: conflictingCFPlaceParsed, frameQuality: .good),
        frameQuality: .good
    ),
    "partial-frame",
    "Fixture condition labels codice fiscale conflicts as partial frame"
)
assertEqual(
    ScanCaptureLogic.fixtureConditionLabel(
        accepted: false,
        readiness: scatteredReadiness,
        frameQuality: CaptureFrameQuality(sharpness: 2, glareRatio: 0, darkRatio: 0, meanLuma: 128)
    ),
    "slight-blur",
    "Fixture condition labels low sharpness as slight blur"
)
assertEqual(
    ScanCaptureLogic.fixtureConditionLabel(
        accepted: false,
        readiness: scatteredReadiness,
        frameQuality: CaptureFrameQuality(sharpness: 12, glareRatio: 0.4, darkRatio: 0, meanLuma: 128)
    ),
    "glare",
    "Fixture condition labels glare"
)
assertEqual(
    ScanCaptureLogic.fixtureConditionLabel(
        accepted: false,
        readiness: scatteredReadiness,
        frameQuality: CaptureFrameQuality(sharpness: 12, glareRatio: 0, darkRatio: 0.6, meanLuma: 20)
    ),
    "dark-background",
    "Fixture condition labels dark frames"
)
assertEqual(
    ScanCaptureLogic.fixtureConditionLabel(
        accepted: false,
        readiness: scatteredReadiness,
        frameQuality: CaptureFrameQuality(sharpness: 12, glareRatio: 0, darkRatio: 0, meanLuma: 250)
    ),
    "light-background",
    "Fixture condition labels overexposed frames"
)
assertEqual(
    ScanCaptureLogic.fixtureConditionLabel(
        accepted: true,
        readiness: scatteredReadiness,
        frameQuality: .good
    ),
    "good",
    "Fixture condition labels accepted captures as good"
)
assertEqual(
    ScanCaptureLogic.fixtureConditionLabel(
        accepted: false,
        readiness: ScanCaptureLogic.CaptureReadiness(
            score: 6,
            markerCount: 2,
            itemCount: 6,
            frameQuality: .good,
            canCapture: false,
            canGuideLiveScan: true,
            reasons: []
        ),
        frameQuality: .good
    ),
    "partial-frame",
    "Fixture condition labels otherwise unclassified rejected document evidence as partial frame"
)
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
let lowConfidenceFieldItems = [
    makeItem("TESSERA SANITARIA", x: 0.5, y: 0.9, confidence: 1.0),
    makeItem("Cognome", x: 0.2, y: 0.7, confidence: 1.0),
    makeItem("ROSSI", x: 0.4, y: 0.7, confidence: 0.2),
    makeItem("Nome", x: 0.2, y: 0.6, confidence: 1.0),
    makeItem("MARIO", x: 0.4, y: 0.6, confidence: 0.2),
    makeItem("RSSMRA90A15H501Y", x: 0.4, y: 0.5, confidence: 0.2),
]
assertTrue(
    !ScanCaptureLogic.shouldAcceptLiveFrame(parsed: reliableParsed, items: lowConfidenceFieldItems),
    "Live frame rejects low-confidence extracted identity fields"
)
assertTrue(
    ScanCaptureLogic.captureReadiness(parsed: reliableParsed, items: lowConfidenceFieldItems).reasons.contains("lowFieldConfidence"),
    "Live frame reports low extracted field confidence"
)
let missingFieldEvidenceItems = [
    makeItem("TESSERA SANITARIA", x: 0.5, y: 0.9, confidence: 1.0),
    makeItem("Cognome", x: 0.2, y: 0.7, confidence: 1.0),
    makeItem("Nome", x: 0.2, y: 0.6, confidence: 1.0),
    makeItem("Codice Fiscale", x: 0.2, y: 0.5, confidence: 1.0),
    makeItem("Data di nascita", x: 0.2, y: 0.4, confidence: 1.0),
]
assertTrue(
    !ScanCaptureLogic.shouldAcceptLiveFrame(parsed: reliableParsed, items: missingFieldEvidenceItems),
    "Live frame rejects extracted fields without OCR item evidence"
)
assertTrue(
    ScanCaptureLogic.captureReadiness(parsed: reliableParsed, items: missingFieldEvidenceItems).reasons.contains("missingFieldEvidence"),
    "Live frame reports missing extracted field evidence"
)
let outsideDocumentFieldItems = [
    makeItem("TESSERA SANITARIA", x: 0.24, y: 0.78),
    makeItem("Cognome", x: 0.20, y: 0.66),
    makeItem("Nome", x: 0.20, y: 0.56),
    makeItem("Codice Fiscale", x: 0.20, y: 0.46),
    makeItem("ROSSI", x: 0.86, y: 0.18),
    makeItem("MARIO", x: 0.86, y: 0.12),
    makeItem("RSSMRA90A15H501Y", x: 0.86, y: 0.06),
]
assertTrue(
    !ScanCaptureLogic.shouldAcceptLiveFrame(parsed: reliableParsed, items: outsideDocumentFieldItems),
    "Live frame rejects identity fields found outside the detected document"
)
let outsideDocumentReadiness = ScanCaptureLogic.captureReadiness(
    parsed: reliableParsed,
    items: outsideDocumentFieldItems,
    frameQuality: .good
)
assertTrue(
    outsideDocumentReadiness.reasons.contains("fieldEvidenceOutsideDocument"),
    "Live frame reports identity fields outside the detected document"
)
assertEqual(
    ScanCaptureLogic.fixtureConditionLabel(
        accepted: false,
        readiness: outsideDocumentReadiness,
        frameQuality: .good
    ),
    "partial-frame",
    "Fixture condition labels outside-document field evidence as partial frame"
)
assertEqual(
    ScanCaptureLogic.fixtureConditionLabel(
        accepted: false,
        readiness: ScanCaptureLogic.captureReadiness(parsed: reliableParsed, items: lowConfidenceFieldItems, frameQuality: .good),
        frameQuality: .good
    ),
    "slight-blur",
    "Fixture condition labels low extracted field confidence as slight blur"
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
assertEqual(
    ScanCaptureLogic.scanFeedbackKey(for: reliableParsed, items: lowConfidenceFieldItems),
    "scan_status_sharpen_text",
    "Low extracted field confidence asks for sharper text"
)
var frontMissingNamesFeedback = IDData(documentType: "TESSERA_SANITARIA_FRONT", rawText: [])
frontMissingNamesFeedback.codiceFiscale = "SPSMRA71C05G023H"
frontMissingNamesFeedback.dateOfBirth = "05/03/1971"
frontMissingNamesFeedback.gender = "M"
assertEqual(
    ScanCaptureLogic.scanFeedbackKey(for: frontMissingNamesFeedback, itemCount: 6),
    "scan_status_need_names",
    "Front document with CF but missing names asks for names"
)
assertEqual(
    ScanCaptureLogic.scanFeedbackKey(for: frontMissingNamesFeedback, items: coherentIdentityItems),
    "scan_status_need_names",
    "Live front document with CF but missing names asks for names"
)

let providerCGImage = makeSolidCGImage(width: 420, height: 260)
let providerImage = NSImage(cgImage: providerCGImage, size: NSSize(width: 420, height: 260))
var providerRecognitionLevels: [VNRequestTextRecognitionLevel] = []
var providerBarcodeCalls = 0
var providerGeometryCalls = 0
let injectedProviderItems = [
    makeItem("TESSERA SANITARIA", x: 0.20, y: 0.78),
    makeItem("Cognome", x: 0.20, y: 0.66),
    makeItem("ROSSI", x: 0.42, y: 0.66),
    makeItem("Nome", x: 0.20, y: 0.56),
    makeItem("MARIO", x: 0.42, y: 0.56),
    makeItem("Codice Fiscale", x: 0.20, y: 0.46),
    makeItem("RSSMRA90A15H501Y", x: 0.42, y: 0.46),
]
let injectedProvider = OCRProvider(
    name: "fixture-test-provider",
    recognizeText: { _, level, completion in
        providerRecognitionLevels.append(level)
        completion(injectedProviderItems)
    },
    detectBarcodes: { _, completion in
        providerBarcodeCalls += 1
        completion([
            DetectedBarcode(
                payload: "provider-barcode-payload",
                boundingBox: CGRect(x: 0.1, y: 0.1, width: 0.2, height: 0.05),
                confidence: 0.9
            )
        ])
    },
    detectCardGeometry: { _, completion in
        providerGeometryCalls += 1
        completion(nil)
    }
)
let providerSemaphore = DispatchSemaphore(value: 0)
var providerParsed = IDData(documentType: "UNKNOWN", rawText: [])
var providerItems: [RecognizedItem] = []
var providerBarcodes: [DetectedBarcode] = []
ScanCaptureLogic.recognizeTextWithOptionalAutoCrop(
    image: providerImage,
    cgImage: providerCGImage,
    autoCrop: false,
    boundsItems: [],
    fallbackItems: [],
    fallbackParsed: IDData(documentType: "UNKNOWN", rawText: []),
    ocrProvider: injectedProvider
) { _, items, barcodes, parsed in
    providerItems = items
    providerBarcodes = barcodes
    providerParsed = parsed
    providerSemaphore.signal()
}
while providerSemaphore.wait(timeout: .now() + 0.05) == .timedOut {
    RunLoop.current.run(mode: .default, before: Date(timeIntervalSinceNow: 0.05))
}
assertTrue(
    providerRecognitionLevels.contains(.accurate),
    "recognizeTextWithOptionalAutoCrop uses injected provider for accurate OCR"
)
assertTrue(providerBarcodeCalls > 0, "recognizeTextWithOptionalAutoCrop uses injected provider for barcodes")
assertEqual(providerGeometryCalls == 0 ? "none" : "called", "none", "Auto-crop disabled skips provider geometry detection")
assertEqual(providerParsed.codiceFiscale, "RSSMRA90A15H501Y", "Injected provider OCR feeds final parser")
assertEqual(providerItems.first?.text, "TESSERA SANITARIA", "Injected provider OCR items feed final capture output")
assertEqual(providerBarcodes.first?.payload, "provider-barcode-payload", "Injected provider barcodes feed final capture output")

let fallbackItems = [makeItem("fallback", x: 0.5, y: 0.5)]
let fallbackParsed = IDData(documentType: "UNKNOWN", rawText: ["fallback"])
var freshParsed = IDData(documentType: "TESSERA_SANITARIA_FRONT", rawText: [])
freshParsed.surname = "ROSSI"
freshParsed.name = "MARIO"
freshParsed.codiceFiscale = "RSSMRA90A15H501Y"
let freshItems = [
    makeItem("TESSERA SANITARIA", x: 0.20, y: 0.78),
    makeItem("Cognome", x: 0.20, y: 0.66),
    makeItem("ROSSI", x: 0.42, y: 0.66),
    makeItem("Nome", x: 0.20, y: 0.56),
    makeItem("MARIO", x: 0.42, y: 0.56),
    makeItem("RSSMRA90A15H501Y", x: 0.32, y: 0.46),
]
let accepted = ScanCaptureLogic.selectCaptureResults(
    freshParsed: freshParsed,
    freshItems: freshItems,
    fallbackItems: fallbackItems,
    fallbackParsed: fallbackParsed
)
assertEqual(accepted.parsed.codiceFiscale, "RSSMRA90A15H501Y", "selectCaptureResults prefers accepted fresh parse")
assertEqual(accepted.items.first?.text, "TESSERA SANITARIA", "selectCaptureResults keeps fresh display-oriented items when accepted")
assertTrue(accepted.source == .fresh, "selectCaptureResults labels accepted fresh parse as fresh")

var strongerFallback = freshParsed
strongerFallback.documentNumber = "CA12345AA"
let coherentFreshWithStrongerFallback = ScanCaptureLogic.selectCaptureResults(
    freshParsed: freshParsed,
    freshItems: freshItems,
    fallbackItems: [
        makeItem("REPUBBLICA ITALIANA", x: 0.18, y: 0.78),
        makeItem("ROSSI", x: 0.42, y: 0.66),
        makeItem("MARIO", x: 0.42, y: 0.56),
        makeItem("RSSMRA90A15H501Y", x: 0.32, y: 0.46),
        makeItem("CA12345AA", x: 0.32, y: 0.36),
    ],
    fallbackParsed: strongerFallback
)
assertEqual(
    coherentFreshWithStrongerFallback.items.first?.text,
    "TESSERA SANITARIA",
    "selectCaptureResults keeps fresh OCR boxes for accepted display image even when fallback has more fields"
)

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
assertEqual(
    qualityPick.parsed.name,
    "REPUBBLICA ITALIANA",
    "selectCaptureResults keeps contradictory snapshot OCR instead of stale fallback"
)

let acceptedFallbackForEmptySnapshot = ScanCaptureLogic.selectCaptureResults(
    freshParsed: IDData(documentType: "UNKNOWN", rawText: []),
    freshItems: [],
    fallbackItems: freshItems,
    fallbackParsed: freshParsed
)
assertEqual(
    acceptedFallbackForEmptySnapshot.parsed.codiceFiscale,
    "RSSMRA90A15H501Y",
    "selectCaptureResults lets fallback rescue empty snapshot OCR"
)
assertTrue(
    acceptedFallbackForEmptySnapshot.source == .fallback,
    "selectCaptureResults labels empty-snapshot rescue as fallback"
)
let acceptedFallbackForNoiseSnapshot = ScanCaptureLogic.selectCaptureResults(
    freshParsed: IDData(documentType: "UNKNOWN", rawText: ["receipt", "menu", "total"]),
    freshItems: [
        makeItem("receipt", x: 0.16, y: 0.82),
        makeItem("menu", x: 0.42, y: 0.48),
        makeItem("total", x: 0.76, y: 0.12),
    ],
    fallbackItems: freshItems,
    fallbackParsed: freshParsed
)
assertEqual(
    acceptedFallbackForNoiseSnapshot.parsed.codiceFiscale,
    "RSSMRA90A15H501Y",
    "selectCaptureResults lets fallback rescue generic frozen OCR noise"
)
assertEqual(
    acceptedFallbackForNoiseSnapshot.items.first?.text,
    "TESSERA SANITARIA",
    "selectCaptureResults replaces generic frozen OCR noise with accepted fallback items"
)
assertTrue(
    acceptedFallbackForNoiseSnapshot.source == .fallback,
    "selectCaptureResults labels generic-noise rescue as fallback"
)

let staleAcceptedFallback = ScanCaptureLogic.selectCaptureResults(
    freshParsed: badFresh,
    freshItems: [
        makeItem("TESSERA SANITARIA", x: 0.20, y: 0.78),
        makeItem("Cognome ESPOSITO", x: 0.20, y: 0.66),
        makeItem("Nome REPUBBLICA ITALIANA", x: 0.20, y: 0.56),
        makeItem("SPSMRA71C05E632H", x: 0.32, y: 0.46),
    ],
    fallbackItems: [
        makeItem("TESSERA SANITARIA", x: 0.20, y: 0.78),
        makeItem("Cognome ESPOSITO", x: 0.20, y: 0.66),
        makeItem("Nome MARIO", x: 0.20, y: 0.56),
        makeItem("SPSMRA71C05E632H", x: 0.32, y: 0.46),
    ],
    fallbackParsed: goodFallback
)
assertEqual(
    staleAcceptedFallback.parsed.name,
    "REPUBBLICA ITALIANA",
    "selectCaptureResults rejects stale accepted fallback over contradictory snapshot OCR"
)
let markerOnlyFresh = IDData(documentType: "UNKNOWN", rawText: ["TESSERA SANITARIA", "Cognome", "Nome"])
let markerOnlyBlocksFallback = ScanCaptureLogic.selectCaptureResults(
    freshParsed: markerOnlyFresh,
    freshItems: [
        makeItem("TESSERA SANITARIA", x: 0.20, y: 0.78),
        makeItem("Cognome", x: 0.20, y: 0.66),
        makeItem("Nome", x: 0.20, y: 0.56),
    ],
    fallbackItems: freshItems,
    fallbackParsed: freshParsed
)
assertEqual(
    markerOnlyBlocksFallback.parsed.documentType,
    "UNKNOWN",
    "selectCaptureResults keeps frozen document-marker OCR instead of stale fallback"
)
assertEqual(
    markerOnlyBlocksFallback.items.first?.text,
    "TESSERA SANITARIA",
    "selectCaptureResults preserves frozen document-marker OCR items"
)
assertTrue(
    markerOnlyBlocksFallback.source == .fresh,
    "selectCaptureResults labels document-marker snapshot evidence as fresh"
)

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

swiftc \
    "$SCRIPT_DIR/Parser.swift" \
    "$SCRIPT_DIR/BelfioreCodes.swift" \
    "$SCRIPT_DIR/Scanner.swift" \
    "$SCRIPT_DIR/ScanCaptureLogic.swift" \
    "$SCRIPT_DIR/LiveScanController.swift" \
    "$TEST_MAIN" \
    -o "$TEST_RUNNER"

(
    cd "$SCRIPT_DIR"
    "$TEST_RUNNER"
)
