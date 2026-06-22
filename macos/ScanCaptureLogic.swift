import Foundation
import AVFoundation
import AppKit
import CoreGraphics
import CoreImage
import ImageIO

enum ScanCaptureState {
    case idle
    case scanning
    case countdown
    case captured
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
    struct CaptureReadiness {
        let score: Int
        let markerCount: Int
        let itemCount: Int
        let frameQuality: CaptureFrameQuality?
        let canCapture: Bool
        let canGuideLiveScan: Bool
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
           IDParser.parseQualityScore(parsedFromDecodedPayloads) > IDParser.parseQualityScore(parsedFromOCR) {
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
        if decoded.documentType != "UNKNOWN" {
            parsed.documentType = decoded.documentType
        }
        if let value = decoded.codiceFiscale { parsed.codiceFiscale = value }
        if let value = decoded.cardNumber { parsed.cardNumber = value }
        if let value = decoded.documentNumber { parsed.documentNumber = value }
        if parsed.surname == nil { parsed.surname = decoded.surname }
        if parsed.name == nil { parsed.name = decoded.name }
        if parsed.dateOfBirth == nil { parsed.dateOfBirth = decoded.dateOfBirth }
        if parsed.gender == nil { parsed.gender = decoded.gender }
        if parsed.expiryDate == nil { parsed.expiryDate = decoded.expiryDate }
        if parsed.nationality == nil { parsed.nationality = decoded.nationality }
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
        data.codiceFiscale = canon(data.codiceFiscale)
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
        let hasUsableFrameQuality = frameQuality?.isUsableForCapture ?? true
        let hasDocumentLikeLayout = documentLayoutLooksPlausible(in: items)
        let hasDocumentType = parsed.documentType != "UNKNOWN"
        let hasCodiceFiscale = parsed.codiceFiscale != nil
        let hasCardNumber = parsed.cardNumber != nil
        let hasDocumentNumber = parsed.documentNumber != nil
        let identityFieldCount = [parsed.surname, parsed.name, parsed.dateOfBirth, parsed.placeOfBirth, parsed.gender]
            .filter { ($0?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false) }
            .count
        let hasIdentityPair = parsed.surname != nil && parsed.name != nil
        let qualityScore = IDParser.parseQualityScore(parsed)

        var score = qualityScore
        score += min(markerCount, 3)
        if itemCount >= 6 { score += 1 }
        if averageConfidence >= 0.85 { score += 2 }
        if averageConfidence >= 0.70 { score += 1 }
        if itemCount > 0 && averageConfidence < 0.45 { score -= 4 }
        if !hasUsableFrameQuality { score -= 5 }
        if hasDocumentType { score += 1 }
        if hasCodiceFiscale { score += 2 }
        if hasCardNumber { score += 2 }
        if hasDocumentNumber { score += 1 }
        if hasIdentityPair { score += 2 }
        if identityFieldCount >= 3 { score += 2 }

        let strongIdentifier = hasCodiceFiscale || hasCardNumber || hasDocumentNumber
        let hasUsableConfidence = itemCount == 0 || averageConfidence >= 0.45
        let canCapture = hasUsableFrameQuality && hasUsableConfidence && hasDocumentLikeLayout && (
            (hasCodiceFiscale && (hasIdentityPair || identityFieldCount >= 2 || hasDocumentType || markerCount >= 2))
            || (hasCardNumber && (hasCodiceFiscale || hasDocumentType || markerCount >= 1))
            || (hasDocumentNumber && hasIdentityPair && (hasDocumentType || markerCount >= 2))
            || (hasIdentityPair && identityFieldCount >= 3 && (hasDocumentType || markerCount >= 2))
            || (score >= 12 && strongIdentifier && (hasDocumentType || markerCount >= 2))
        )

        let canGuideLiveScan = hasUsableFrameQuality
            && hasUsableConfidence
            && hasDocumentLikeLayout
            && (markerCount >= 2 || hasDocumentType || strongIdentifier)
        return CaptureReadiness(
            score: score,
            markerCount: markerCount,
            itemCount: itemCount,
            frameQuality: frameQuality,
            canCapture: canCapture,
            canGuideLiveScan: canGuideLiveScan
        )
    }

    static func shouldAcceptCapture(
        _ parsed: IDData,
        frameQuality: CaptureFrameQuality? = nil
    ) -> Bool {
        captureReadiness(parsed: parsed, frameQuality: frameQuality).canCapture
    }

    static func shouldAcceptLiveFrame(
        parsed: IDData,
        items: [RecognizedItem],
        frameQuality: CaptureFrameQuality? = nil
    ) -> Bool {
        captureReadiness(parsed: parsed, items: items, frameQuality: frameQuality).canCapture
    }

    static func scanFeedbackKey(for parsed: IDData, itemCount: Int) -> String {
        if itemCount < 3 {
            return "scan_status_move_closer"
        }
        if parsed.documentType == "UNKNOWN" {
            return "scan_status_align_document"
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
        if !readiness.canGuideLiveScan {
            return "scan_status_align_document"
        }
        if !readiness.canCapture {
            return "scan_status_need_identity"
        }
        return "scan_status_reading_fields"
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

    private static func documentLayoutLooksPlausible(in items: [RecognizedItem]) -> Bool {
        guard !items.isEmpty else { return true }

        let cardItems = CaptureAutoZoom.cardBoundsItems(from: items)
        guard cardItems.count >= 4 else { return false }

        var union = CGRect.null
        for item in cardItems {
            union = union.union(item.boundingBox)
        }
        guard !union.isNull, union.width >= 0.18, union.height >= 0.12 else { return false }

        if union.width > 0.82 || union.height > 0.72 {
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


    static func selectCaptureResults(
        freshParsed: IDData,
        freshItems: [RecognizedItem],
        fallbackItems: [RecognizedItem],
        fallbackParsed: IDData
    ) -> (items: [RecognizedItem], parsed: IDData) {
        let freshScore = IDParser.parseQualityScore(freshParsed)
        let fallbackScore = IDParser.parseQualityScore(fallbackParsed)

        if freshScore > fallbackScore {
            return (freshItems, freshParsed)
        }
        if fallbackScore > freshScore {
            return (fallbackItems, fallbackParsed)
        }
        if shouldAcceptCapture(freshParsed) {
            return (freshItems, freshParsed)
        }
        return (fallbackItems, fallbackParsed)
    }

    /// When auto-crop is enabled: detect card edges, crop the image, then run accurate OCR on the crop.
    static func recognizeTextWithOptionalAutoCrop(
        image: NSImage,
        cgImage: CGImage,
        autoCrop: Bool,
        boundsItems: [RecognizedItem],
        fallbackItems: [RecognizedItem],
        fallbackParsed: IDData,
        completion: @escaping (_ displayImage: NSImage, _ items: [RecognizedItem], _ parsed: IDData) -> Void
    ) {
        func finishAccurateOCR(on ocrImage: NSImage, ocrCGImage: CGImage) {
            let group = DispatchGroup()
            var recognizedItems: [RecognizedItem] = []
            var barcodePayloads: [String] = []

            group.enter()
            IDScanner.recognizeText(in: ocrCGImage) { items in
                recognizedItems = items
                group.leave()
            }

            group.enter()
            IDScanner.detectBarcodes(in: ocrCGImage) { barcodes in
                barcodePayloads = barcodes.map(\.payload)
                group.leave()
            }

            group.notify(queue: .main) {
                let sortedItems = sortedRecognizedItems(recognizedItems)
                var parsed = parseRecognizedItems(sortedItems, barcodePayloads: barcodePayloads)
                parsed.calculateCodiceFiscaleIfPossible()

                let results = selectCaptureResults(
                    freshParsed: parsed,
                    freshItems: sortedItems,
                    fallbackItems: fallbackItems,
                    fallbackParsed: fallbackParsed
                )
                completion(ocrImage, results.items, results.parsed)
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
            IDScanner.recognizeText(in: cgImage, level: .fast) { items in
                fastItems = items
                group.leave()
            }
        }

        group.enter()
        IDScanner.detectCardGeometry(in: cgImage) { geometry in
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
