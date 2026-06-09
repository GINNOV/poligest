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
