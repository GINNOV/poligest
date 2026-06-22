import Foundation
import AVFoundation
import CoreGraphics
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
        switch Int(round(rotationAngle).truncatingRemainder(dividingBy: 360)) {
        case 90, -270:
            return .right
        case 180, -180:
            return .down
        case 270, -90:
            return .left
        default:
            return .up
        }
    }
}

enum ScanCaptureLogic {
    static func sortedRecognizedItems(_ items: [RecognizedItem]) -> [RecognizedItem] {
        items.sorted { item1, item2 in
            let yDiff = abs(item1.boundingBox.midY - item2.boundingBox.midY)
            if yDiff < 0.035 {
                return item1.boundingBox.minX < item2.boundingBox.minX
            }
            return item1.boundingBox.midY > item2.boundingBox.midY
        }
    }

    static func parseRecognizedItems(_ items: [RecognizedItem]) -> IDData {
        let textLines = items.sortedLines()
        let ocrItems = items.map {
            OCRTextItem(
                text: $0.text,
                midX: $0.boundingBox.midX,
                midY: $0.boundingBox.midY
            )
        }
        return IDParser.parse(ocrItems: ocrItems, fallbackLines: textLines)
    }

    static func shouldAcceptCapture(_ parsed: IDData) -> Bool {
        parsed.documentType != "UNKNOWN"
            || parsed.codiceFiscale != nil
            || parsed.surname != nil
            || parsed.name != nil
            || parsed.documentNumber != nil
            || parsed.cardNumber != nil
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

    static func selectCaptureResults(
        freshParsed: IDData,
        freshItems: [RecognizedItem],
        fallbackItems: [RecognizedItem],
        fallbackParsed: IDData
    ) -> (items: [RecognizedItem], parsed: IDData) {
        if shouldAcceptCapture(freshParsed) {
            return (freshItems, freshParsed)
        }
        return (fallbackItems, fallbackParsed)
    }
}