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
        if a.count >= 3 && b.contains(a) { return true }
        if b.count >= 3 && a.contains(b) { return true }
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
    private static let maxScale: CGFloat = 6
    private static let fillRatio: CGFloat = 0.72
    private static let paddingRatio: CGFloat = 0.12
    
    static func apply(
        to items: [RecognizedItem],
        imageSize: CGSize,
        containerSize: CGSize,
        scale: inout CGFloat,
        offset: inout CGSize
    ) {
        guard !items.isEmpty,
              imageSize.width > 0, imageSize.height > 0,
              containerSize.width > 0, containerSize.height > 0 else {
            return
        }
        
        var union = CGRect.null
        for item in items {
            union = union.union(item.boundingBox)
        }
        guard !union.isNull, union.width > 0.01, union.height > 0.01 else { return }
        
        let padX = union.width * paddingRatio
        let padY = union.height * paddingRatio
        union = union.insetBy(dx: -padX, dy: -padY)
        
        let targetScale = min(fillRatio / union.width, fillRatio / union.height)
        let newScale = min(max(targetScale, 1.0), maxScale)
        
        let aspect = min(containerSize.width / imageSize.width, containerSize.height / imageSize.height)
        let displayW = imageSize.width * aspect
        let displayH = imageSize.height * aspect
        let originX = (containerSize.width - displayW) / 2
        let originY = (containerSize.height - displayH) / 2
        
        let boxCenterX = originX + (union.minX + union.width / 2) * displayW
        let boxCenterY = originY + (1.0 - union.maxY + union.height / 2) * displayH
        
        let viewCenterX = containerSize.width / 2
        let viewCenterY = containerSize.height / 2
        
        scale = newScale
        offset = clampOffset(
            CGSize(
                width: (viewCenterX - boxCenterX) * newScale,
                height: (viewCenterY - boxCenterY) * newScale
            ),
            containerSize: containerSize,
            scale: newScale
        )
    }
    
    private static func clampOffset(_ offset: CGSize, containerSize: CGSize, scale: CGFloat) -> CGSize {
        guard scale > 1 else { return .zero }
        let maxX = (containerSize.width * (scale - 1)) / 2
        let maxY = (containerSize.height * (scale - 1)) / 2
        return CGSize(
            width: min(max(offset.width, -maxX), maxX),
            height: min(max(offset.height, -maxY), maxY)
        )
    }
}

class IDScanner {
    
    private static var isProcessing = false
    private static var lastProcessingTime: TimeInterval = 0
    private static let frameInterval: TimeInterval = 0.4 // Limit to ~2.5 frames per second for camera
    
    /// Recognizes text in a static CGImage and returns the list of recognized text items
    static func recognizeText(in cgImage: CGImage, completion: @escaping ([RecognizedItem]) -> Void) {
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
                return RecognizedItem(text: candidate.string, boundingBox: observation.boundingBox)
            }
            
            DispatchQueue.main.async {
                completion(items)
            }
        }
        
        request.recognitionLevel = .accurate
        request.recognitionLanguages = ["it-IT", "en-US"]
        request.usesLanguageCorrection = true
        
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
                return RecognizedItem(text: candidate.string, boundingBox: observation.boundingBox)
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
