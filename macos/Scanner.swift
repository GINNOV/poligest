import Foundation
import Vision
import CoreGraphics
import CoreVideo
import ImageIO
import QuartzCore

struct RecognizedItem: Identifiable, Codable {
    var id: UUID = UUID()
    var text: String
    var boundingBox: CGRect // Normalized bounds from Vision (y-axis is bottom-up)
    var confidence: Float = 1.0
}

struct DetectedCardGeometry {
    let boundingBox: CGRect
    let topLeft: CGPoint
    let topRight: CGPoint
    let bottomLeft: CGPoint
    let bottomRight: CGPoint
    let confidence: Float
}

struct DetectedBarcode {
    let payload: String
    let boundingBox: CGRect
    let confidence: Float
}

struct CaptureFrameQuality {
    let sharpness: Double
    let glareRatio: Double
    let darkRatio: Double
    let meanLuma: Double

    static let minSharpness = 5.0
    static let maxGlareRatio = 0.16
    static let maxDarkRatio = 0.45
    static let minMeanLuma = 35.0
    static let maxMeanLuma = 235.0

    static let good = CaptureFrameQuality(
        sharpness: 12,
        glareRatio: 0.02,
        darkRatio: 0.02,
        meanLuma: 128
    )

    var isUsableForCapture: Bool {
        failureReasons.isEmpty
    }

    var failureReasons: [String] {
        var reasons: [String] = []
        if sharpness < Self.minSharpness {
            reasons.append("low sharpness")
        }
        if glareRatio > Self.maxGlareRatio {
            reasons.append("glare")
        }
        if darkRatio > Self.maxDarkRatio {
            reasons.append("too dark")
        }
        if meanLuma < Self.minMeanLuma {
            reasons.append("underexposed")
        }
        if meanLuma > Self.maxMeanLuma {
            reasons.append("overexposed")
        }
        return reasons
    }

    var diagnosticSummary: String {
        let status = isUsableForCapture ? "usable" : "rejected: \(failureReasons.joined(separator: ", "))"
        return String(
            format: "%@ (sharpness %.2f, glare %.3f, dark %.3f, mean %.1f)",
            status,
            sharpness,
            glareRatio,
            darkRatio,
            meanLuma
        )
    }
}

extension Array where Element == RecognizedItem {
    /// Groups OCR observations into reading-order lines (top-to-bottom, left-to-right per row).
    func sortedLines(rowThreshold: CGFloat = 0.035) -> [String] {
        guard !isEmpty else { return [] }
        
        var rows: [[RecognizedItem]] = []
        let sortedByY = sorted { $0.boundingBox.midY > $1.boundingBox.midY }
        
        for item in sortedByY {
            if let lastRow = rows.last,
               let anchor = lastRow.first,
               abs(item.boundingBox.midY - anchor.boundingBox.midY) < rowThreshold {
                rows[rows.count - 1].append(item)
            } else {
                rows.append([item])
            }
        }
        
        return rows.flatMap { row in
            row.sorted { $0.boundingBox.minX < $1.boundingBox.minX }.map(\.text)
        }
    }
    
    func filteredExpectedFields(matching parsed: IDData) -> [RecognizedItem] {
        CaptureDetection.filterItems(self, matching: parsed)
    }
}

enum CaptureDetection {
    static func expectedValues(from parsed: IDData) -> [String] {
        [
            parsed.surname,
            parsed.name,
            parsed.codiceFiscale,
            parsed.documentNumber,
            parsed.dateOfBirth,
            parsed.placeOfBirth,
            parsed.gender,
            parsed.expiryDate,
            parsed.nationality,
            parsed.cardNumber
        ]
        .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty }
    }
    
    static func filterItems(_ items: [RecognizedItem], matching parsed: IDData) -> [RecognizedItem] {
        let expected = expectedValues(from: parsed)
        guard !expected.isEmpty else { return [] }
        return items.filter { item in
            expected.contains { textsMatch(item.text, $0) }
        }
    }
    
    static func textsMatch(_ ocr: String, _ field: String) -> Bool {
        let a = normalize(ocr)
        let b = normalize(field)
        guard !a.isEmpty, !b.isEmpty else { return false }
        if a == b { return true }
        if a.count <= 2 || b.count <= 2 {
            return a == b
        }

        let shorter = a.count <= b.count ? a : b
        let longer = a.count <= b.count ? b : a
        guard shorter.count >= 4 else { return false }

        // Avoid false positives such as "ARIO" inside "ESPOSITO".
        let coverage = Double(shorter.count) / Double(longer.count)
        if coverage >= 0.72 && longer.contains(shorter) {
            return true
        }

        return false
    }
    
    private static func normalize(_ text: String) -> String {
        text.uppercased()
            .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "it_IT"))
            .replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: ".", with: "")
            .replacingOccurrences(of: "/", with: "")
            .replacingOccurrences(of: "-", with: "")
            .replacingOccurrences(of: "'", with: "")
    }
}

enum CaptureAutoZoom {
    /// ID-1 / Tessera Sanitaria width-to-height ratio (landscape).
    static let cardAspectRatio: CGFloat = 1.586
    private static let paddingRatio: CGFloat = 0.06
    private static let horizontalTextInset: CGFloat = 0.10
    private static let verticalTextInset: CGFloat = 0.20
    private static let minNormalizedWidth: CGFloat = 0.18
    private static let minNormalizedHeight: CGFloat = 0.12

    /// Keeps OCR items that belong to the physical card, not the table/background.
    static func cardBoundsItems(from items: [RecognizedItem]) -> [RecognizedItem] {
        guard items.count >= 3 else { return items }

        func isCardMarker(_ text: String) -> Bool {
            let normalized = text
                .lowercased()
                .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "it_IT"))
            let markers = [
                "cognom", "nome", "codice", "fiscal", "nascit", "scadenz", "sesso",
                "tessera", "sanitaria", "repubblica", "documento", "carta", "identit",
                "ministero", "assistenza",
            ]
            if markers.contains(where: { normalized.contains($0) }) {
                return true
            }
            let stripped = normalized.replacingOccurrences(of: " ", with: "")
            return stripped.count == 16 && stripped.allSatisfy { $0.isLetter || $0.isNumber }
        }

        let filtered = items.filter { isCardMarker($0.text) }
        return filtered.count >= 3 ? filtered : items
    }

    /// Builds a normalized Vision bounding box (origin bottom-left) around detected card text.
    static func normalizedCardBounds(from items: [RecognizedItem]) -> CGRect? {
        let cardItems = cardBoundsItems(from: items)
        guard !cardItems.isEmpty else { return nil }

        var union = CGRect.null
        for item in cardItems {
            union = union.union(item.boundingBox)
        }
        guard !union.isNull, union.width > 0.02, union.height > 0.02 else { return nil }

        union = expandTextUnionToCardEdges(union)

        let padX = max(union.width * paddingRatio, 0.01)
        let padY = max(union.height * paddingRatio, 0.01)
        union = union.insetBy(dx: -padX, dy: -padY)

        union = expandToCardAspectRatio(union)

        if union.width < minNormalizedWidth {
            let expand = (minNormalizedWidth - union.width) / 2
            union.origin.x -= expand
            union.size.width = minNormalizedWidth
        }
        if union.height < minNormalizedHeight {
            let expand = (minNormalizedHeight - union.height) / 2
            union.origin.y -= expand
            union.size.height = minNormalizedHeight
        }

        return clampNormalizedRect(union)
    }

    /// Merges OCR text bounds with a detected card rectangle from Vision.
    static func mergedCardBounds(from items: [RecognizedItem], rectangle: CGRect?) -> CGRect? {
        let ocrBounds = normalizedCardBounds(from: items)
        guard let rectangle, rectangle.width > 0.12, rectangle.height > 0.08 else {
            return ocrBounds
        }

        let normalizedRectangle = clampNormalizedRect(rectangle)
        guard normalizedRectangle.width > 0.02 else { return ocrBounds }

        guard let ocrBounds else { return normalizedRectangle }

        // OCR spread across the full frame usually means background/table text leaked in.
        if ocrBounds.width > 0.72 || ocrBounds.height > 0.72 {
            return normalizedRectangle
        }

        let merged = clampNormalizedRect(ocrBounds.union(normalizedRectangle))
        if merged.width > 0.88 || merged.height > 0.88 {
            return normalizedRectangle
        }
        return merged
    }

    private static func expandTextUnionToCardEdges(_ union: CGRect) -> CGRect {
        let widthScale = 1.0 / max(1.0 - (2 * horizontalTextInset), 0.5)
        let heightScale = 1.0 / max(1.0 - (2 * verticalTextInset), 0.5)
        let centerX = union.midX
        let centerY = union.midY

        var expanded = union
        expanded.size.width = union.width * widthScale
        expanded.size.height = union.height * heightScale
        expanded.origin.x = centerX - expanded.width / 2
        expanded.origin.y = centerY - expanded.height / 2
        return expanded
    }

    private static func expandToCardAspectRatio(_ rect: CGRect) -> CGRect {
        guard rect.width > 0, rect.height > 0 else { return rect }

        var expanded = rect
        let aspect = rect.width / rect.height

        if aspect < cardAspectRatio {
            let targetWidth = rect.height * cardAspectRatio
            expanded.origin.x -= (targetWidth - rect.width) / 2
            expanded.size.width = targetWidth
        } else if aspect > cardAspectRatio * 1.25 {
            let targetHeight = rect.width / cardAspectRatio
            expanded.origin.y -= (targetHeight - rect.height) / 2
            expanded.size.height = targetHeight
        }

        return expanded
    }

    private static func clampNormalizedRect(_ rect: CGRect) -> CGRect {
        var clamped = rect
        if clamped.minX < 0 {
            clamped.size.width += clamped.minX
            clamped.origin.x = 0
        }
        if clamped.minY < 0 {
            clamped.size.height += clamped.minY
            clamped.origin.y = 0
        }
        if clamped.maxX > 1 {
            clamped.size.width -= clamped.maxX - 1
        }
        if clamped.maxY > 1 {
            clamped.size.height -= clamped.maxY - 1
        }
        guard clamped.width > 0.02, clamped.height > 0.02,
              clamped.width.isFinite, clamped.height.isFinite else {
            return .zero
        }
        return clamped
    }
}

class IDScanner {
    
    private static var isProcessing = false
    private static var lastProcessingTime: TimeInterval = 0
    private static let frameInterval: TimeInterval = 0.4 // Limit to ~2.5 frames per second for camera

    static func assessFrameQuality(_ pixelBuffer: CVImageBuffer) -> CaptureFrameQuality {
        let pixelBuffer = pixelBuffer as CVPixelBuffer
        CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly) }

        let format = CVPixelBufferGetPixelFormatType(pixelBuffer)
        if format == kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange
            || format == kCVPixelFormatType_420YpCbCr8BiPlanarFullRange {
            return assessLumaPlane(
                baseAddress: CVPixelBufferGetBaseAddressOfPlane(pixelBuffer, 0),
                width: CVPixelBufferGetWidthOfPlane(pixelBuffer, 0),
                height: CVPixelBufferGetHeightOfPlane(pixelBuffer, 0),
                bytesPerRow: CVPixelBufferGetBytesPerRowOfPlane(pixelBuffer, 0)
            )
        }

        if format == kCVPixelFormatType_32BGRA {
            return assessBGRAPixels(
                baseAddress: CVPixelBufferGetBaseAddress(pixelBuffer),
                width: CVPixelBufferGetWidth(pixelBuffer),
                height: CVPixelBufferGetHeight(pixelBuffer),
                bytesPerRow: CVPixelBufferGetBytesPerRow(pixelBuffer)
            )
        }

        return .good
    }

    static func assessFrameQuality(_ cgImage: CGImage) -> CaptureFrameQuality {
        let width = cgImage.width
        let height = cgImage.height
        guard width > 1, height > 1 else { return .good }

        let colorSpace = CGColorSpaceCreateDeviceRGB()
        guard let context = CGContext(
            data: nil,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: width * 4,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue
                | CGBitmapInfo.byteOrder32Little.rawValue
        ) else {
            return .good
        }

        context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
        return assessBGRAPixels(
            baseAddress: context.data,
            width: width,
            height: height,
            bytesPerRow: context.bytesPerRow
        )
    }

    private static func assessLumaPlane(
        baseAddress: UnsafeMutableRawPointer?,
        width: Int,
        height: Int,
        bytesPerRow: Int
    ) -> CaptureFrameQuality {
        guard let baseAddress, width > 1, height > 1 else { return .good }
        let bytes = baseAddress.assumingMemoryBound(to: UInt8.self)
        return assessSamples(width: width, height: height) { x, y in
            bytes[(y * bytesPerRow) + x]
        }
    }

    private static func assessBGRAPixels(
        baseAddress: UnsafeMutableRawPointer?,
        width: Int,
        height: Int,
        bytesPerRow: Int
    ) -> CaptureFrameQuality {
        guard let baseAddress, width > 1, height > 1 else { return .good }
        let bytes = baseAddress.assumingMemoryBound(to: UInt8.self)
        return assessSamples(width: width, height: height) { x, y in
            let offset = (y * bytesPerRow) + (x * 4)
            let blue = Double(bytes[offset])
            let green = Double(bytes[offset + 1])
            let red = Double(bytes[offset + 2])
            return UInt8(clamping: Int((0.114 * blue) + (0.587 * green) + (0.299 * red)))
        }
    }

    private static func assessSamples(
        width: Int,
        height: Int,
        sample: (_ x: Int, _ y: Int) -> UInt8
    ) -> CaptureFrameQuality {
        let stepX = max(width / 96, 1)
        let stepY = max(height / 54, 1)
        var count = 0
        var total = 0.0
        var bright = 0
        var dark = 0
        var edgeTotal = 0.0
        var edgeCount = 0

        for y in stride(from: 0, to: height, by: stepY) {
            for x in stride(from: 0, to: width, by: stepX) {
                let value = Int(sample(x, y))
                count += 1
                total += Double(value)
                if value >= 245 { bright += 1 }
                if value <= 12 { dark += 1 }

                if x + stepX < width {
                    edgeTotal += Double(abs(value - Int(sample(x + stepX, y))))
                    edgeCount += 1
                }
                if y + stepY < height {
                    edgeTotal += Double(abs(value - Int(sample(x, y + stepY))))
                    edgeCount += 1
                }
            }
        }

        guard count > 0 else { return .good }
        return CaptureFrameQuality(
            sharpness: edgeCount > 0 ? edgeTotal / Double(edgeCount) : 0,
            glareRatio: Double(bright) / Double(count),
            darkRatio: Double(dark) / Double(count),
            meanLuma: total / Double(count)
        )
    }
    
    /// Recognizes text in a static CGImage and returns the list of recognized text items.
    static func recognizeText(
        in cgImage: CGImage,
        level: VNRequestTextRecognitionLevel = .accurate,
        completion: @escaping ([RecognizedItem]) -> Void
    ) {
        let request = VNRecognizeTextRequest { request, error in
            guard error == nil else {
                print("Vision error: \(String(describing: error))")
                completion([])
                return
            }
            
            guard let observations = request.results as? [VNRecognizedTextObservation] else {
                completion([])
                return
            }
            
            let items = observations.compactMap { observation -> RecognizedItem? in
                guard let candidate = observation.topCandidates(1).first else { return nil }
                return RecognizedItem(
                    text: candidate.string,
                    boundingBox: observation.boundingBox,
                    confidence: candidate.confidence
                )
            }
            
            DispatchQueue.main.async {
                completion(items)
            }
        }
        
        request.recognitionLevel = level
        request.recognitionLanguages = ["it-IT", "en-US"]
        request.usesLanguageCorrection = level == .accurate
        
        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                try handler.perform([request])
            } catch {
                print("Failed to perform text recognition: \(error)")
                DispatchQueue.main.async {
                    completion([])
                }
            }
        }
    }

    /// Detects a credit-card-sized rectangle in the image (used to crop to physical card edges).
    static func detectCardRectangle(in cgImage: CGImage, completion: @escaping (CGRect?) -> Void) {
        detectCardGeometry(in: cgImage) { geometry in
            completion(geometry?.boundingBox)
        }
    }

    static func detectCardGeometry(in cgImage: CGImage, completion: @escaping (DetectedCardGeometry?) -> Void) {
        let request = VNDetectRectanglesRequest { request, error in
            guard error == nil,
                  let observations = request.results as? [VNRectangleObservation] else {
                DispatchQueue.main.async { completion(nil) }
                return
            }

            let candidates = observations.filter { observation in
                let box = observation.boundingBox
                guard box.width >= 0.22, box.height >= 0.12 else { return false }
                let aspect = box.width / box.height
                return aspect >= 1.25 && aspect <= 2.1
            }

            let best = candidates.max {
                ($0.boundingBox.width * $0.boundingBox.height) < ($1.boundingBox.width * $1.boundingBox.height)
            }

            DispatchQueue.main.async {
                guard let best else {
                    completion(nil)
                    return
                }
                completion(DetectedCardGeometry(
                    boundingBox: best.boundingBox,
                    topLeft: best.topLeft,
                    topRight: best.topRight,
                    bottomLeft: best.bottomLeft,
                    bottomRight: best.bottomRight,
                    confidence: best.confidence
                ))
            }
        }

        request.minimumAspectRatio = 1.25
        request.maximumAspectRatio = 2.1
        request.minimumSize = 0.15
        request.maximumObservations = 12
        request.minimumConfidence = 0.25

        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                try handler.perform([request])
            } catch {
                DispatchQueue.main.async { completion(nil) }
            }
        }
    }

    static func detectBarcodes(in cgImage: CGImage, completion: @escaping ([DetectedBarcode]) -> Void) {
        let request = VNDetectBarcodesRequest { request, error in
            guard error == nil,
                  let observations = request.results as? [VNBarcodeObservation] else {
                DispatchQueue.main.async { completion([]) }
                return
            }

            let barcodes = observations.compactMap { observation -> DetectedBarcode? in
                guard let payload = observation.payloadStringValue?
                    .trimmingCharacters(in: .whitespacesAndNewlines),
                      !payload.isEmpty else {
                    return nil
                }
                return DetectedBarcode(
                    payload: payload,
                    boundingBox: observation.boundingBox,
                    confidence: observation.confidence
                )
            }

            DispatchQueue.main.async {
                completion(barcodes)
            }
        }

        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                try handler.perform([request])
            } catch {
                DispatchQueue.main.async { completion([]) }
            }
        }
    }
    
    /// Recognizes text in a live CVImageBuffer with rate limiting for camera processing
    static func recognizeTextInLiveBuffer(
        _ pixelBuffer: CVImageBuffer,
        orientation: CGImagePropertyOrientation = .up,
        completion: @escaping ([RecognizedItem]) -> Void
    ) {
        let currentTime = CACurrentMediaTime()
        
        // Skip if already processing a frame or if it's too soon since the last one
        guard !isProcessing else { return }
        guard currentTime - lastProcessingTime >= frameInterval else { return }
        
        isProcessing = true
        lastProcessingTime = currentTime
        
        let request = VNRecognizeTextRequest { request, error in
            defer { isProcessing = false }
            
            guard error == nil else {
                return
            }
            
            guard let observations = request.results as? [VNRecognizedTextObservation] else {
                return
            }
            
            let items = observations.compactMap { observation -> RecognizedItem? in
                guard let candidate = observation.topCandidates(1).first else { return nil }
                return RecognizedItem(
                    text: candidate.string,
                    boundingBox: observation.boundingBox,
                    confidence: candidate.confidence
                )
            }
            
            DispatchQueue.main.async {
                completion(items)
            }
        }
        
        request.recognitionLevel = .fast
        request.recognitionLanguages = ["it-IT", "en-US"]
        request.usesLanguageCorrection = false
        
        let handler = VNImageRequestHandler(
            cvPixelBuffer: pixelBuffer,
            orientation: orientation,
            options: [:]
        )
        
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                try handler.perform([request])
            } catch {
                print("Failed to perform text recognition on live buffer: \(error)")
                isProcessing = false
            }
        }
    }
}
