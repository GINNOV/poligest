import Foundation
import Vision
import CoreGraphics
import CoreVideo
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
    static func recognizeTextInLiveBuffer(_ pixelBuffer: CVImageBuffer, completion: @escaping ([RecognizedItem]) -> Void) {
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
        
        request.recognitionLevel = .accurate
        request.recognitionLanguages = ["it-IT", "en-US"]
        request.usesLanguageCorrection = true
        
        // Use default orientation since the buffer usually matches camera orientation
        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, options: [:])
        
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
