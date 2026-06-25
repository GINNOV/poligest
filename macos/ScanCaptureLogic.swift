import Foundation
import AVFoundation
import AppKit
import CoreGraphics
import CoreImage
import ImageIO
import Vision

struct OCRProvider {
    let name: String
    let recognizeText: (
        _ cgImage: CGImage,
        _ level: VNRequestTextRecognitionLevel,
        _ completion: @escaping ([RecognizedItem]) -> Void
    ) -> Void
    let detectBarcodes: (_ cgImage: CGImage, _ completion: @escaping ([DetectedBarcode]) -> Void) -> Void
    let detectCardGeometry: (_ cgImage: CGImage, _ completion: @escaping (DetectedCardGeometry?) -> Void) -> Void

    static let vision = OCRProvider(
        name: "vision",
        recognizeText: { cgImage, level, completion in
            IDScanner.recognizeText(in: cgImage, level: level, completion: completion)
        },
        detectBarcodes: { cgImage, completion in
            IDScanner.detectBarcodes(in: cgImage, completion: completion)
        },
        detectCardGeometry: { cgImage, completion in
            IDScanner.detectCardGeometry(in: cgImage, completion: completion)
        }
    )
}

enum ScanCaptureState {
    case idle
    case scanning
    case countdown
    case captured
}

enum ScanIDLaunchConfiguration {
    static let launchSmokeTestKey = "SCANID_LAUNCH_SMOKE_TEST"

    static func isLaunchSmokeTest(environment: [String: String] = ProcessInfo.processInfo.environment) -> Bool {
        environment[launchSmokeTestKey] == "1"
    }

    static func disablesCameraAccess(environment: [String: String] = ProcessInfo.processInfo.environment) -> Bool {
        isLaunchSmokeTest(environment: environment)
    }
}

enum ScanIDDefaults {
    static let autoZoomOnCapture = true
}

enum CameraOrientation {
    static let continuityCameraRotationAngle: CGFloat = 180
    /// Portrait-mounted Continuity Camera over a flat, horizontal ID card needs an extra
    /// quarter turn so the preview matches the card's physical orientation.
    static let continuityDocumentScanOffset: CGFloat = 90

    struct DeviceTraits {
        let isContinuityCamera: Bool
        let isExternal: Bool
        let localizedName: String
    }

    static func looksLikeContinuityCameraName(_ name: String) -> Bool {
        let lower = name.lowercased()
        return lower.contains("iphone") || lower.contains("ipad")
    }

    static func isContinuityCameraDevice(traits: DeviceTraits) -> Bool {
        if traits.isContinuityCamera {
            return true
        }
        guard traits.isExternal else { return false }
        return looksLikeContinuityCameraName(traits.localizedName)
    }

    static func isContinuityCameraDevice(_ device: AVCaptureDevice?) -> Bool {
        guard let device else { return false }
        return isContinuityCameraDevice(traits: DeviceTraits(
            isContinuityCamera: device.isContinuityCamera,
            isExternal: device.deviceType == .external,
            localizedName: device.localizedName
        ))
    }

    static func fallbackRotationAngle(for device: AVCaptureDevice?) -> CGFloat {
        isContinuityCameraDevice(device) ? continuityCameraRotationAngle : 0
    }

    static func fallbackRotationAngle(traits: DeviceTraits) -> CGFloat {
        isContinuityCameraDevice(traits: traits) ? continuityCameraRotationAngle : 0
    }

    static func normalizeRotationAngle(_ angle: CGFloat) -> CGFloat {
        var normalized = angle.truncatingRemainder(dividingBy: 360)
        if normalized < 0 {
            normalized += 360
        }
        return normalized
    }

    static func documentScanRotationOffset(for device: AVCaptureDevice?) -> CGFloat {
        isContinuityCameraDevice(device) ? continuityDocumentScanOffset : 0
    }

    static func documentScanRotationOffset(traits: DeviceTraits) -> CGFloat {
        isContinuityCameraDevice(traits: traits) ? continuityDocumentScanOffset : 0
    }

    static func resolveScanRotationAngle(baseAngle: CGFloat, device: AVCaptureDevice?) -> CGFloat {
        normalizeRotationAngle(baseAngle + documentScanRotationOffset(for: device))
    }

    static func resolveScanRotationAngle(baseAngle: CGFloat, traits: DeviceTraits) -> CGFloat {
        normalizeRotationAngle(baseAngle + documentScanRotationOffset(traits: traits))
    }

    static func apply(to connection: AVCaptureConnection?, angle: CGFloat) {
        guard let connection else { return }
        guard connection.isVideoRotationAngleSupported(angle) else { return }
        if connection.videoRotationAngle != angle {
            connection.videoRotationAngle = angle
        }
    }

    static func videoDataOutputRotationAngle(scanCaptureAngle: CGFloat) -> CGFloat? {
        nil
    }

    static func visionOrientation(for rotationAngle: CGFloat) -> CGImagePropertyOrientation {
        switch Int(round(normalizeRotationAngle(rotationAngle))) {
        case 90:
            return .right
        case 180:
            return .down
        case 270:
            return .left
        default:
            return .up
        }
    }

    static func orientationName(_ orientation: CGImagePropertyOrientation) -> String {
        switch orientation {
        case .up: return "up"
        case .upMirrored: return "upMirrored"
        case .down: return "down"
        case .downMirrored: return "downMirrored"
        case .left: return "left"
        case .leftMirrored: return "leftMirrored"
        case .right: return "right"
        case .rightMirrored: return "rightMirrored"
        }
    }

    /// Vision OCR should use horizon-level capture rotation only — not the extra document-scan
    /// preview offset, which is for display alignment and breaks live text recognition.
    static func visionOrientationForOCR(baseCaptureAngle: CGFloat) -> CGImagePropertyOrientation {
        visionOrientation(for: baseCaptureAngle)
    }

    /// Reorients a camera buffer so pixel data matches the rotated preview the user sees.
    static func orientedCIImage(_ image: CIImage, orientation: CGImagePropertyOrientation) -> CIImage {
        guard orientation != .up else { return image }
        return image.oriented(orientation)
    }
}

enum ScanCaptureLogic {
    enum CaptureResultSource: Equatable {
        case fresh
        case fallback
    }

    struct CaptureResultSelection {
        let items: [RecognizedItem]
        let parsed: IDData
        let source: CaptureResultSource
    }

    static let fixtureConditionLabels = [
        "good",
        "tilted",
        "glare",
        "slight-blur",
        "dark-background",
        "light-background",
        "partial-frame",
        "non-document",
    ]

    static func fixtureConditionChoices(accepted: Bool) -> [String] {
        if accepted {
            return ["good"]
        }
        return fixtureConditionLabels.filter { $0 != "good" }
    }

    struct CardOCRImageCandidate {
        let image: NSImage
        let cgImage: CGImage
        let rotation: CGImagePropertyOrientation
    }

    struct CaptureReadiness {
        let score: Int
        let markerCount: Int
        let itemCount: Int
        let frameQuality: CaptureFrameQuality?
        let canCapture: Bool
        let canGuideLiveScan: Bool
        let reasons: [String]
    }

    static func sortedRecognizedItems(_ items: [RecognizedItem]) -> [RecognizedItem] {
        items.sorted { item1, item2 in
            let yDiff = abs(item1.boundingBox.midY - item2.boundingBox.midY)
            if yDiff < 0.035 {
                return item1.boundingBox.minX < item2.boundingBox.minX
            }
            return item1.boundingBox.midY > item2.boundingBox.midY
        }
    }

    static func parseRecognizedItems(
        _ items: [RecognizedItem],
        barcodePayloads: [String] = []
    ) -> IDData {
        let textLines = items.sortedLines()
        let decodedLines = decodedBarcodeLines(from: barcodePayloads)
        let fallbackLines = textLines + decodedLines
        let ocrItems = items.map {
            OCRTextItem(
                text: $0.text,
                midX: $0.boundingBox.midX,
                midY: $0.boundingBox.midY
            )
        }
        let parsedFromOCR = IDParser.parse(ocrItems: ocrItems, fallbackLines: fallbackLines)
        let parsedFromDecodedPayloads = decodedLines.isEmpty ? nil : IDParser.parse(lines: fallbackLines)
        var parsed: IDData
        if let parsedFromDecodedPayloads,
           IDParser.parseQualityScore(parsedFromDecodedPayloads) > IDParser.parseQualityScore(parsedFromOCR),
           !decodedPayloadConflictsWithVisibleFront(decoded: parsedFromDecodedPayloads, visible: parsedFromOCR) {
            parsed = parsedFromDecodedPayloads
        } else {
            parsed = parsedFromOCR
            if let parsedFromDecodedPayloads {
                mergeDecodedPayloadFields(parsedFromDecodedPayloads, into: &parsed)
            }
        }
        canonicalizeFieldsToOCRItems(&parsed, items: items)
        return parsed
    }

    static func decodedBarcodeLines(from payloads: [String]) -> [String] {
        var lines: [String] = []
        for payload in payloads {
            let trimmedPayload = payload.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmedPayload.isEmpty else { continue }
            lines.append(trimmedPayload)

            let splitLines = trimmedPayload
                .components(separatedBy: CharacterSet.newlines)
                .flatMap { $0.components(separatedBy: "|") }
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }

            if splitLines.count > 1 {
                lines.append(contentsOf: splitLines)
            }
        }

        var seen = Set<String>()
        return lines.filter { seen.insert($0).inserted }
    }

    private static func mergeDecodedPayloadFields(_ decoded: IDData, into parsed: inout IDData) {
        let decodedConflictsWithVisibleFront = decodedPayloadConflictsWithVisibleFront(decoded: decoded, visible: parsed)

        if decoded.documentType != "UNKNOWN", !decodedConflictsWithVisibleFront {
            parsed.documentType = decoded.documentType
        }

        if let value = decoded.codiceFiscale,
           parsed.codiceFiscale == nil,
           (!decodedConflictsWithVisibleFront || hasVisibleIdentityPair(parsed)),
           decodedCodiceFiscaleCanMerge(value, into: parsed) {
            parsed.codiceFiscale = value
        }
        if let value = decoded.cardNumber, !decodedConflictsWithVisibleFront, parsed.cardNumber == nil {
            parsed.cardNumber = value
        }
        if let value = decoded.documentNumber, !decodedConflictsWithVisibleFront, parsed.documentNumber == nil {
            parsed.documentNumber = value
        }
        guard !decodedConflictsWithVisibleFront else { return }

        if parsed.surname == nil { parsed.surname = decoded.surname }
        if parsed.name == nil { parsed.name = decoded.name }
        if parsed.dateOfBirth == nil { parsed.dateOfBirth = decoded.dateOfBirth }
        if parsed.gender == nil { parsed.gender = decoded.gender }
        if parsed.expiryDate == nil { parsed.expiryDate = decoded.expiryDate }
        if parsed.nationality == nil { parsed.nationality = decoded.nationality }
    }

    private static func decodedPayloadConflictsWithVisibleFront(decoded: IDData, visible: IDData) -> Bool {
        isFrontDocument(visible.documentType) && isBackDocument(decoded.documentType)
    }

    private static func hasVisibleIdentityPair(_ parsed: IDData) -> Bool {
        parsed.surname?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
            && parsed.name?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
    }

    private static func isFrontDocument(_ documentType: String) -> Bool {
        ["CIE_FRONT", "TESSERA_SANITARIA_FRONT"].contains(documentType)
    }

    private static func isBackDocument(_ documentType: String) -> Bool {
        ["CIE_BACK", "TESSERA_SANITARIA_BACK"].contains(documentType)
    }

    private static func decodedCodiceFiscaleCanMerge(_ codiceFiscale: String, into parsed: IDData) -> Bool {
        guard let surname = parsed.surname?.trimmingCharacters(in: .whitespacesAndNewlines),
              let name = parsed.name?.trimmingCharacters(in: .whitespacesAndNewlines),
              !surname.isEmpty,
              !name.isEmpty else {
            return true
        }
        return IDParser.namesAreConsistentWithCodiceFiscale(
            surname: surname,
            name: name,
            codiceFiscale: codiceFiscale
        )
    }

    /// Aligns parsed field strings with the exact OCR bounding-box text the user sees.
    static func canonicalizeFieldsToOCRItems(_ data: inout IDData, items: [RecognizedItem]) {
        func canon(_ value: String?) -> String? {
            guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
                return nil
            }
            let matches = items.filter { CaptureDetection.textsMatch($0.text, value) }
            if let item = matches.max(by: { $0.text.count < $1.text.count }) {
                return item.text.trimmingCharacters(in: .whitespacesAndNewlines)
            }
            return value
        }

        data.surname = canon(data.surname)
        data.name = canon(data.name)
        data.codiceFiscale = IDParser.normalizeCodiceFiscale(data.codiceFiscale)
        data.documentNumber = canon(data.documentNumber)
        data.dateOfBirth = canon(data.dateOfBirth)
        data.placeOfBirth = canon(data.placeOfBirth)
        data.gender = canon(data.gender)
        data.expiryDate = canon(data.expiryDate)
        data.nationality = canon(data.nationality)
        data.cardNumber = canon(data.cardNumber)
    }

    static func captureReadiness(
        parsed: IDData,
        items: [RecognizedItem] = [],
        frameQuality: CaptureFrameQuality? = nil
    ) -> CaptureReadiness {
        let markerCount = documentMarkerCount(in: items)
        let itemCount = items.count
        let averageConfidence = recognizedTextConfidence(in: items)
        let documentBounds = documentAnchorBounds(in: items)
        let fieldEvidence = recognizedFieldEvidence(for: parsed, in: items, documentBounds: documentBounds)
        let directEvidenceValues = [
            parsed.surname,
            parsed.name,
            parsed.codiceFiscale,
            parsed.documentNumber,
            parsed.cardNumber,
        ]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        let extractedFieldConfidence = fieldEvidence.minimumConfidence
        let hasBackedExtractedFields = (items.isEmpty ? directEvidenceValues.isEmpty : true)
            && fieldEvidence.missingValues.isEmpty
            && fieldEvidence.outsideDocumentValues.isEmpty
        let hasUsableFrameQuality = frameQuality?.isUsableForCapture ?? true
        let hasDocumentLikeLayout = documentLayoutLooksPlausible(in: items)
        let hasUsableFieldConfidence = hasBackedExtractedFields
            && (extractedFieldConfidence.map { $0 >= 0.45 } ?? true)
        let hasDocumentType = parsed.documentType != "UNKNOWN"
        let hasCodiceFiscale = parsed.codiceFiscale != nil
        let hasCardNumber = parsed.cardNumber != nil
        let hasDocumentNumber = parsed.documentNumber != nil
        let identityFieldCount = [parsed.surname, parsed.name, parsed.dateOfBirth, parsed.placeOfBirth, parsed.gender]
            .filter { ($0?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false) }
            .count
        let hasIdentityPair = parsed.surname != nil && parsed.name != nil
        let hasConflictingCodiceFiscaleNames = namesConflictWithCodiceFiscale(parsed)
        let hasConflictingCodiceFiscaleBirthData = birthDataConflictsWithCodiceFiscale(parsed)
        let hasConflictingCodiceFiscalePlace = placeOfBirthConflictsWithCodiceFiscale(parsed)
        let isFrontIdentityDocument = ["CIE_FRONT", "TESSERA_SANITARIA_FRONT"].contains(parsed.documentType)
        let hasRequiredFrontIdentity = !isFrontIdentityDocument || hasIdentityPair
        let qualityScore = IDParser.parseQualityScore(parsed)

        var score = qualityScore
        score += min(markerCount, 3)
        if itemCount >= 6 { score += 1 }
        if averageConfidence >= 0.85 { score += 2 }
        if averageConfidence >= 0.70 { score += 1 }
        if itemCount > 0 && averageConfidence < 0.45 { score -= 4 }
        if !hasBackedExtractedFields { score -= 4 }
        if !hasUsableFieldConfidence { score -= 4 }
        if !hasUsableFrameQuality { score -= 5 }
        if hasDocumentType { score += 1 }
        if hasCodiceFiscale { score += 2 }
        if hasCardNumber { score += 2 }
        if hasDocumentNumber { score += 1 }
        if hasIdentityPair { score += 2 }
        if identityFieldCount >= 3 { score += 2 }

        let strongIdentifier = hasCodiceFiscale || hasCardNumber || hasDocumentNumber
        let hasUsableConfidence = itemCount == 0 || averageConfidence >= 0.45
        let canCapture = hasUsableFrameQuality
            && hasUsableConfidence
            && hasUsableFieldConfidence
            && hasDocumentLikeLayout
            && !hasConflictingCodiceFiscaleNames
            && !hasConflictingCodiceFiscaleBirthData
            && !hasConflictingCodiceFiscalePlace
            && hasRequiredFrontIdentity
            && (
            (hasCodiceFiscale && (hasIdentityPair || identityFieldCount >= 2 || hasDocumentType || markerCount >= 2))
            || (hasCardNumber && (hasCodiceFiscale || hasDocumentType || markerCount >= 1))
            || (hasDocumentNumber && hasIdentityPair && (hasDocumentType || markerCount >= 2))
            || (hasIdentityPair && identityFieldCount >= 3 && (hasDocumentType || markerCount >= 2))
            || (score >= 12 && strongIdentifier && (hasDocumentType || markerCount >= 2))
        )

        let canGuideLiveScan = hasUsableFrameQuality
            && hasUsableConfidence
            && hasUsableFieldConfidence
            && hasDocumentLikeLayout
            && (markerCount >= 2 || hasDocumentType || strongIdentifier)
        var reasons: [String] = []
        if !hasUsableFrameQuality { reasons.append("unusableFrameQuality") }
        if !hasUsableConfidence { reasons.append("lowConfidence") }
        if items.isEmpty && !directEvidenceValues.isEmpty { reasons.append("missingFieldEvidence") }
        if !fieldEvidence.missingValues.isEmpty { reasons.append("missingFieldEvidence") }
        if !fieldEvidence.outsideDocumentValues.isEmpty { reasons.append("fieldEvidenceOutsideDocument") }
        if hasBackedExtractedFields && !hasUsableFieldConfidence { reasons.append("lowFieldConfidence") }
        if !hasDocumentLikeLayout { reasons.append("implausibleLayout") }
        if hasConflictingCodiceFiscaleNames { reasons.append("codiceFiscaleNameConflict") }
        if hasConflictingCodiceFiscaleBirthData { reasons.append("codiceFiscaleBirthConflict") }
        if hasConflictingCodiceFiscalePlace { reasons.append("codiceFiscalePlaceConflict") }
        if !hasRequiredFrontIdentity { reasons.append("missingFrontNames") }
        if !hasDocumentType { reasons.append("unknownDocumentType") }
        if !strongIdentifier && !hasIdentityPair { reasons.append("missingIdentifier") }
        if score < 12 && strongIdentifier && !hasDocumentType && markerCount < 2 {
            reasons.append("weakDocumentEvidence")
        }

        return CaptureReadiness(
            score: score,
            markerCount: markerCount,
            itemCount: itemCount,
            frameQuality: frameQuality,
            canCapture: canCapture,
            canGuideLiveScan: canGuideLiveScan,
            reasons: canCapture ? [] : reasons
        )
    }

    static func shouldAcceptCapture(
        _ parsed: IDData,
        frameQuality: CaptureFrameQuality? = nil
    ) -> Bool {
        captureReadiness(parsed: parsed, frameQuality: frameQuality).canCapture
    }

    static func shouldAcceptCapture(
        _ parsed: IDData,
        items: [RecognizedItem],
        frameQuality: CaptureFrameQuality? = nil
    ) -> Bool {
        captureReadiness(parsed: parsed, items: items, frameQuality: frameQuality).canCapture
    }

    static func shouldAcceptLiveFrame(
        parsed: IDData,
        items: [RecognizedItem],
        frameQuality: CaptureFrameQuality? = nil
    ) -> Bool {
        captureReadiness(parsed: parsed, items: items, frameQuality: frameQuality).canCapture
    }

    static func fixtureConditionLabel(
        accepted: Bool,
        readiness: CaptureReadiness,
        frameQuality: CaptureFrameQuality
    ) -> String {
        if accepted {
            return "good"
        }
        if let qualityCondition = fixtureConditionLabel(for: frameQuality.failureReasons) {
            return qualityCondition
        }
        if readiness.reasons.contains("unknownDocumentType")
            && readiness.reasons.contains("missingIdentifier") {
            return "non-document"
        }
        if readiness.reasons.contains("implausibleLayout") {
            return "partial-frame"
        }
        if readiness.reasons.contains("fieldEvidenceOutsideDocument") {
            return "partial-frame"
        }
        if readiness.reasons.contains("lowConfidence")
            || readiness.reasons.contains("lowFieldConfidence") {
            return "slight-blur"
        }
        if readiness.reasons.contains("missingFrontNames")
            || readiness.reasons.contains("weakDocumentEvidence") {
            return "partial-frame"
        }
        if readiness.reasons.contains("codiceFiscaleNameConflict")
            || readiness.reasons.contains("codiceFiscaleBirthConflict")
            || readiness.reasons.contains("codiceFiscalePlaceConflict") {
            return "partial-frame"
        }
        return "partial-frame"
    }

    private static func fixtureConditionLabel(for failureReasons: [String]) -> String? {
        if failureReasons.contains("glare") {
            return "glare"
        }
        if failureReasons.contains("low sharpness") {
            return "slight-blur"
        }
        if failureReasons.contains("too dark") || failureReasons.contains("underexposed") {
            return "dark-background"
        }
        if failureReasons.contains("overexposed") {
            return "light-background"
        }
        return nil
    }

    static func scanFeedbackKey(for parsed: IDData, itemCount: Int) -> String {
        if itemCount < 3 {
            return "scan_status_move_closer"
        }
        if parsed.documentType == "UNKNOWN" {
            return "scan_status_align_document"
        }
        if frontIdentityDocumentMissingNames(parsed) {
            return "scan_status_need_names"
        }
        if parsed.surname == nil && parsed.name == nil && parsed.codiceFiscale == nil {
            return "scan_status_need_identity"
        }
        return "scan_status_reading_fields"
    }

    static func scanFeedbackKey(
        for parsed: IDData,
        items: [RecognizedItem],
        frameQuality: CaptureFrameQuality? = nil
    ) -> String {
        if items.count < 3 {
            return "scan_status_move_closer"
        }
        let readiness = captureReadiness(parsed: parsed, items: items, frameQuality: frameQuality)
        if readiness.reasons.contains("lowFieldConfidence") {
            return "scan_status_sharpen_text"
        }
        if frontIdentityDocumentMissingNames(parsed) {
            return "scan_status_need_names"
        }
        if !readiness.canGuideLiveScan {
            return "scan_status_align_document"
        }
        if !readiness.canCapture {
            return "scan_status_need_identity"
        }
        return "scan_status_reading_fields"
    }

    private static func frontIdentityDocumentMissingNames(_ parsed: IDData) -> Bool {
        guard ["CIE_FRONT", "TESSERA_SANITARIA_FRONT"].contains(parsed.documentType) else {
            return false
        }
        guard parsed.surname == nil || parsed.name == nil else {
            return false
        }
        return parsed.codiceFiscale != nil || parsed.dateOfBirth != nil || parsed.gender != nil
    }

    private static func documentMarkerCount(in items: [RecognizedItem]) -> Int {
        var markers = Set<String>()
        for item in items {
            let normalized = item.text
                .lowercased()
                .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "it_IT"))

            if normalized.contains("tessera sanitaria") { markers.insert("ts") }
            if normalized.contains("servizio sanitario") { markers.insert("ssn") }
            if normalized.contains("carta di identita") || normalized.contains("carta d'identita") {
                markers.insert("cie")
            }
            if normalized.contains("repubblica italiana") { markers.insert("italy") }
            if normalized.contains("codice") || normalized.contains("fiscal") { markers.insert("cf-label") }
            if normalized.contains("cognom") || normalized.contains("surname") { markers.insert("surname-label") }
            if normalized.contains("nome") || normalized.contains("name") { markers.insert("name-label") }
            if normalized.contains("nascit") || normalized.contains("birth") { markers.insert("birth-label") }
            if normalized.contains("scadenz") || normalized.contains("expiry") { markers.insert("expiry-label") }
        }
        return markers.count
    }

    private static func namesConflictWithCodiceFiscale(_ parsed: IDData) -> Bool {
        guard let codiceFiscale = parsed.codiceFiscale,
              let surname = parsed.surname?.trimmingCharacters(in: .whitespacesAndNewlines),
              let name = parsed.name?.trimmingCharacters(in: .whitespacesAndNewlines),
              !surname.isEmpty,
              !name.isEmpty else {
            return false
        }
        return !IDParser.namesAreConsistentWithCodiceFiscale(
            surname: surname,
            name: name,
            codiceFiscale: codiceFiscale
        )
    }

    private static func birthDataConflictsWithCodiceFiscale(_ parsed: IDData) -> Bool {
        guard let codiceFiscale = parsed.codiceFiscale,
              let dateOfBirth = parsed.dateOfBirth?.trimmingCharacters(in: .whitespacesAndNewlines),
              !dateOfBirth.isEmpty else {
            return false
        }
        guard let gender = parsed.gender?.trimmingCharacters(in: .whitespacesAndNewlines),
              !gender.isEmpty else {
            return !IDParser.birthDateMatchesCodiceFiscale(
                dateOfBirth: dateOfBirth,
                codiceFiscale: codiceFiscale
            )
        }
        return !IDParser.birthDataMatchesCodiceFiscale(
            dateOfBirth: dateOfBirth,
            gender: gender,
            codiceFiscale: codiceFiscale
        )
    }

    private static func placeOfBirthConflictsWithCodiceFiscale(_ parsed: IDData) -> Bool {
        guard let codiceFiscale = parsed.codiceFiscale,
              let placeOfBirth = parsed.placeOfBirth?.trimmingCharacters(in: .whitespacesAndNewlines),
              !placeOfBirth.isEmpty else {
            return false
        }
        return !IDParser.placeOfBirthMatchesCodiceFiscale(
            placeOfBirth: placeOfBirth,
            codiceFiscale: codiceFiscale
        )
    }

    private static func documentLayoutLooksPlausible(in items: [RecognizedItem]) -> Bool {
        guard !items.isEmpty else { return true }

        let cardItems = CaptureAutoZoom.cardBoundsItems(from: items)
        guard cardItems.count >= 4 else { return false }

        var union = CGRect.null
        for item in cardItems {
            union = union.union(item.boundingBox)
        }
        guard !union.isNull, union.width >= 0.18, union.height >= 0.12 else { return false }

        if union.width > 0.94 || union.height > 0.92 {
            return false
        }

        let aspectRatio = union.width / max(union.height, 0.01)
        return aspectRatio >= 0.80 && aspectRatio <= 4.20
    }

    private static func recognizedTextConfidence(in items: [RecognizedItem]) -> Float {
        guard !items.isEmpty else { return 1.0 }
        let total = items.reduce(Float(0)) { $0 + $1.confidence }
        return total / Float(items.count)
    }

    private static func documentAnchorBounds(in items: [RecognizedItem]) -> CGRect? {
        let anchors = items.filter { item in
            let normalized = item.text
                .lowercased()
                .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "it_IT"))
            let anchorNeedles = [
                "tessera", "sanitaria", "servizio sanitario", "repubblica", "documento",
                "carta", "identit", "codice", "fiscal", "cognom", "surname",
                "nome", "name", "nascit", "birth", "scadenz", "expiry",
            ]
            return anchorNeedles.contains { normalized.contains($0) }
        }
        guard anchors.count >= 3 else { return nil }

        var union = CGRect.null
        for item in anchors {
            union = union.union(item.boundingBox)
        }
        guard !union.isNull, union.width > 0.02, union.height > 0.02 else { return nil }

        let horizontalExpansion = max(union.width * 0.9, 0.24)
        let verticalExpansion = max(union.height * 0.8, 0.12)
        return union.insetBy(dx: -horizontalExpansion, dy: -verticalExpansion)
    }

    private struct RecognizedFieldEvidence {
        let minimumConfidence: Float?
        let missingValues: [String]
        let outsideDocumentValues: [String]
    }

    private static func recognizedFieldEvidence(
        for parsed: IDData,
        in items: [RecognizedItem],
        documentBounds: CGRect?
    ) -> RecognizedFieldEvidence {
        guard !items.isEmpty else {
            return RecognizedFieldEvidence(minimumConfidence: nil, missingValues: [], outsideDocumentValues: [])
        }
        let values = [
            parsed.surname,
            parsed.name,
            parsed.codiceFiscale,
            parsed.documentNumber,
            parsed.cardNumber,
        ]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        var confidences: [Float] = []
        var missingValues: [String] = []
        var outsideDocumentValues: [String] = []
        for value in values {
            let matches = items
                .filter { fieldValueMatchesOCRItem(itemText: $0.text, fieldValue: value) }
            let documentMatches = matches.filter { itemBelongsToDocument($0, documentBounds: documentBounds) }
            if let confidence = documentMatches.map(\.confidence).max() {
                confidences.append(confidence)
            } else if !matches.isEmpty {
                outsideDocumentValues.append(value)
            } else {
                missingValues.append(value)
            }
        }
        return RecognizedFieldEvidence(
            minimumConfidence: confidences.min(),
            missingValues: missingValues,
            outsideDocumentValues: outsideDocumentValues
        )
    }

    private static func itemBelongsToDocument(_ item: RecognizedItem, documentBounds: CGRect?) -> Bool {
        guard let documentBounds, !documentBounds.isNull, !documentBounds.isEmpty else { return true }
        let tolerantBounds = documentBounds.insetBy(dx: -0.04, dy: -0.04)
        let center = CGPoint(x: item.boundingBox.midX, y: item.boundingBox.midY)
        return tolerantBounds.intersects(item.boundingBox) || tolerantBounds.contains(center)
    }

    private static func fieldValueMatchesOCRItem(itemText: String, fieldValue: String) -> Bool {
        if CaptureDetection.textsMatch(itemText, fieldValue) {
            return true
        }

        let normalizedItem = normalizedFieldEvidenceText(itemText)
        let normalizedValue = normalizedFieldEvidenceText(fieldValue)
        guard !normalizedItem.isEmpty, !normalizedValue.isEmpty else { return false }
        if normalizedItem == normalizedValue { return true }
        if normalizedItem.contains(" \(normalizedValue) ") { return true }
        let compactItem = normalizedItem.replacingOccurrences(of: " ", with: "")
        let compactValue = normalizedValue.replacingOccurrences(of: " ", with: "")
        if compactValue.count >= 5, compactItem.contains(compactValue) {
            return true
        }

        let itemTokens = Set(normalizedItem.split(separator: " ").map(String.init))
        let valueTokens = normalizedValue.split(separator: " ").map(String.init)
        guard !valueTokens.isEmpty else { return false }
        return valueTokens.allSatisfy { token in
            token.count >= 5 && itemTokens.contains(String(token))
        }
    }

    private static func normalizedFieldEvidenceText(_ text: String) -> String {
        let folded = text
            .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "it_IT"))
            .lowercased()
        let scalars = folded.unicodeScalars.map { scalar -> Character in
            CharacterSet.alphanumerics.contains(scalar) ? Character(scalar) : " "
        }
        return String(scalars)
            .split(separator: " ")
            .joined(separator: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }


    static func selectCaptureResults(
        freshParsed: IDData,
        freshItems: [RecognizedItem],
        fallbackItems: [RecognizedItem],
        fallbackParsed: IDData
    ) -> CaptureResultSelection {
        let freshReadiness = captureReadiness(parsed: freshParsed, items: freshItems)
        let fallbackReadiness = captureReadiness(parsed: fallbackParsed, items: fallbackItems)
        let freshHasSnapshotEvidence = hasSnapshotEvidence(parsed: freshParsed, items: freshItems)

        if freshReadiness.canCapture {
            return CaptureResultSelection(items: freshItems, parsed: freshParsed, source: .fresh)
        }
        if fallbackReadiness.canCapture && !freshHasSnapshotEvidence {
            return CaptureResultSelection(items: fallbackItems, parsed: fallbackParsed, source: .fallback)
        }
        if freshHasSnapshotEvidence {
            return CaptureResultSelection(items: freshItems, parsed: freshParsed, source: .fresh)
        }

        let freshScore = IDParser.parseQualityScore(freshParsed)
        let fallbackScore = IDParser.parseQualityScore(fallbackParsed)

        if freshScore > fallbackScore {
            return CaptureResultSelection(items: freshItems, parsed: freshParsed, source: .fresh)
        }
        if fallbackScore > freshScore {
            return CaptureResultSelection(items: fallbackItems, parsed: fallbackParsed, source: .fallback)
        }
        if freshReadiness.score > fallbackReadiness.score {
            return CaptureResultSelection(items: freshItems, parsed: freshParsed, source: .fresh)
        }
        return CaptureResultSelection(items: fallbackItems, parsed: fallbackParsed, source: .fallback)
    }

    private static func hasSnapshotEvidence(parsed: IDData, items: [RecognizedItem]) -> Bool {
        if documentMarkerCount(in: items) >= 2 { return true }
        if parsed.documentType != "UNKNOWN" { return true }
        if IDParser.parseQualityScore(parsed) > 0 { return true }
        return false
    }

    private static func scoreCandidate(parsed: IDData, items: [RecognizedItem]) -> Int {
        let readiness = captureReadiness(parsed: parsed, items: items)
        return readiness.score + (readiness.canCapture ? 100 : 0)
    }

    static func cardOCRImageCandidates(image: NSImage, cgImage: CGImage) -> [CardOCRImageCandidate] {
        let rotations: [CGImagePropertyOrientation] = [.up, .right, .left, .down]
        var seenSizes = Set<String>()
        return rotations.compactMap { rotation in
            let candidateImage: NSImage
            let candidateCGImage: CGImage

            if rotation == .up {
                candidateImage = image
                candidateCGImage = cgImage
            } else {
                guard let rotatedImage = rotateImage(cgImage, orientation: rotation),
                      let rotatedCGImage = rotatedImage.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
                    return nil
                }
                candidateImage = rotatedImage
                candidateCGImage = rotatedCGImage
            }

            let sizeKey = "\(candidateCGImage.width)x\(candidateCGImage.height)-\(rotation.rawValue)"
            guard seenSizes.insert(sizeKey).inserted else { return nil }
            return CardOCRImageCandidate(
                image: candidateImage,
                cgImage: candidateCGImage,
                rotation: rotation
            )
        }
    }

    private static func rotateImage(_ cgImage: CGImage, orientation: CGImagePropertyOrientation) -> NSImage? {
        let output = CIImage(cgImage: cgImage).oriented(orientation)
        let extent = output.extent.integral
        let context = CIContext()
        guard let rotated = context.createCGImage(output, from: extent) else { return nil }
        return NSImage(cgImage: rotated, size: NSSize(width: rotated.width, height: rotated.height))
    }

    /// When auto-crop is enabled: detect card edges, crop the image, then run accurate OCR on the crop.
    static func recognizeTextWithOptionalAutoCrop(
        image: NSImage,
        cgImage: CGImage,
        autoCrop: Bool,
        boundsItems: [RecognizedItem],
        fallbackItems: [RecognizedItem],
        fallbackParsed: IDData,
        ocrProvider: OCRProvider = .vision,
        completion: @escaping (_ displayImage: NSImage, _ items: [RecognizedItem], _ barcodes: [DetectedBarcode], _ parsed: IDData) -> Void
    ) {
        func finishAccurateOCR(on ocrImage: NSImage, ocrCGImage: CGImage) {
            let candidates = cardOCRImageCandidates(image: ocrImage, cgImage: ocrCGImage)
            let group = DispatchGroup()
            var candidateResults: [(candidate: CardOCRImageCandidate, items: [RecognizedItem], barcodes: [DetectedBarcode], parsed: IDData, score: Int)] = []

            for candidate in candidates {
                group.enter()
                let candidateGroup = DispatchGroup()
                var recognizedItems: [RecognizedItem] = []
                var detectedBarcodes: [DetectedBarcode] = []

                candidateGroup.enter()
                ocrProvider.recognizeText(candidate.cgImage, .accurate) { items in
                    recognizedItems = items
                    candidateGroup.leave()
                }

                candidateGroup.enter()
                ocrProvider.detectBarcodes(candidate.cgImage) { barcodes in
                    detectedBarcodes = barcodes
                    candidateGroup.leave()
                }

                candidateGroup.notify(queue: .main) {
                    let sortedItems = sortedRecognizedItems(recognizedItems)
                    var parsed = parseRecognizedItems(sortedItems, barcodePayloads: detectedBarcodes.map(\.payload))
                    parsed.calculateCodiceFiscaleIfPossible()
                    candidateResults.append((
                        candidate: candidate,
                        items: sortedItems,
                        barcodes: detectedBarcodes,
                        parsed: parsed,
                        score: scoreCandidate(parsed: parsed, items: sortedItems)
                    ))
                    group.leave()
                }
            }

            group.notify(queue: .main) {
                let bestResult = candidateResults.max {
                    if $0.score == $1.score {
                        return $0.items.count < $1.items.count
                    }
                    return $0.score < $1.score
                }
                let selectedCandidate = bestResult?.candidate ?? CardOCRImageCandidate(
                    image: ocrImage,
                    cgImage: ocrCGImage,
                    rotation: .up
                )
                let freshItems = bestResult?.items ?? []
                let freshBarcodes = bestResult?.barcodes ?? []
                let freshParsed = bestResult?.parsed ?? IDData(documentType: "UNKNOWN", rawText: [])

                let results = selectCaptureResults(
                    freshParsed: freshParsed,
                    freshItems: freshItems,
                    fallbackItems: fallbackItems,
                    fallbackParsed: fallbackParsed
                )
                let selectedBarcodes = results.source == .fresh ? freshBarcodes : []
                let displayImage = results.source == .fresh ? selectedCandidate.image : image
                completion(displayImage, results.items, selectedBarcodes, results.parsed)
            }
        }

        guard autoCrop else {
            finishAccurateOCR(on: image, ocrCGImage: cgImage)
            return
        }

        let group = DispatchGroup()
        var fastItems = boundsItems
        var detectedGeometry: DetectedCardGeometry?

        if fastItems.isEmpty {
            group.enter()
            ocrProvider.recognizeText(cgImage, .fast) { items in
                fastItems = items
                group.leave()
            }
        }

        group.enter()
        ocrProvider.detectCardGeometry(cgImage) { geometry in
            detectedGeometry = geometry
            group.leave()
        }

        group.notify(queue: .main) {
            let sortedBoundsItems = sortedRecognizedItems(
                fastItems.isEmpty ? fallbackItems : fastItems
            )
            guard let bounds = CaptureAutoZoom.mergedCardBounds(
                from: sortedBoundsItems,
                rectangle: detectedGeometry?.boundingBox
            ) else {
                finishAccurateOCR(on: image, ocrCGImage: cgImage)
                return
            }

            if let geometry = detectedGeometry,
               let correctedImage = perspectiveCorrectImageToCard(cgImage: cgImage, geometry: geometry),
               let correctedCGImage = correctedImage.cgImage(forProposedRect: nil, context: nil, hints: nil) {
                finishAccurateOCR(on: correctedImage, ocrCGImage: correctedCGImage)
                return
            }

            guard let croppedImage = cropImageToCardBounds(image, normalizedBounds: bounds),
                  let croppedCGImage = croppedImage.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
                finishAccurateOCR(on: image, ocrCGImage: cgImage)
                return
            }

            finishAccurateOCR(on: croppedImage, ocrCGImage: croppedCGImage)
        }
    }

    private static let minCropPixels: CGFloat = 80

    static func imagePoint(for normalizedPoint: CGPoint, imageSize: CGSize) -> CGPoint {
        CGPoint(
            x: normalizedPoint.x * imageSize.width,
            y: normalizedPoint.y * imageSize.height
        )
    }

    static func perspectiveCorrectImageToCard(
        cgImage: CGImage,
        geometry: DetectedCardGeometry
    ) -> NSImage? {
        let ciImage = CIImage(cgImage: cgImage)
        let imageSize = CGSize(width: cgImage.width, height: cgImage.height)
        let topLeft = imagePoint(for: geometry.topLeft, imageSize: imageSize)
        let topRight = imagePoint(for: geometry.topRight, imageSize: imageSize)
        let bottomLeft = imagePoint(for: geometry.bottomLeft, imageSize: imageSize)
        let bottomRight = imagePoint(for: geometry.bottomRight, imageSize: imageSize)

        guard let filter = CIFilter(name: "CIPerspectiveCorrection") else { return nil }
        filter.setValue(ciImage, forKey: kCIInputImageKey)
        filter.setValue(CIVector(cgPoint: topLeft), forKey: "inputTopLeft")
        filter.setValue(CIVector(cgPoint: topRight), forKey: "inputTopRight")
        filter.setValue(CIVector(cgPoint: bottomLeft), forKey: "inputBottomLeft")
        filter.setValue(CIVector(cgPoint: bottomRight), forKey: "inputBottomRight")

        guard let output = filter.outputImage else { return nil }
        let extent = output.extent.integral
        guard extent.width >= minCropPixels, extent.height >= minCropPixels else { return nil }

        let context = CIContext()
        guard let corrected = context.createCGImage(output, from: extent) else { return nil }
        return NSImage(cgImage: corrected, size: NSSize(width: corrected.width, height: corrected.height))
    }

    static func cropImageToCardBounds(_ image: NSImage, normalizedBounds: CGRect) -> NSImage? {
        guard let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
            return nil
        }

        let pixelWidth = CGFloat(cgImage.width)
        let pixelHeight = CGFloat(cgImage.height)

        var cropX = normalizedBounds.minX * pixelWidth
        var cropY = (1.0 - normalizedBounds.maxY) * pixelHeight
        var cropW = normalizedBounds.width * pixelWidth
        var cropH = normalizedBounds.height * pixelHeight

        cropX = max(0, floor(cropX))
        cropY = max(0, floor(cropY))
        cropW = max(0, min(pixelWidth - cropX, ceil(cropW)))
        cropH = max(0, min(pixelHeight - cropY, ceil(cropH)))

        guard cropW >= minCropPixels,
              cropH >= minCropPixels,
              cropX + cropW <= pixelWidth,
              cropY + cropH <= pixelHeight else {
            return nil
        }

        let cropRect = CGRect(x: cropX, y: cropY, width: cropW, height: cropH)
        guard let cropped = cgImage.cropping(to: cropRect) else { return nil }

        return NSImage(cgImage: cropped, size: NSSize(width: cropRect.width, height: cropRect.height))
    }
}
