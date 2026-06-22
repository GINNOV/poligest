#!/bin/bash
# CI: GitHub Actions runs this via .github/workflows/macos-verify.yml (and scanid-release.yml).
set -e

# Create a temporary test runner source file
cat << 'EOF' > main.swift
import Foundation
import CoreGraphics
import ImageIO
import AVFoundation

func assertEqual(_ actual: String?, _ expected: String?, _ message: String) {
    if actual == expected {
        print("✅ PASS: \(message)")
    } else {
        print("❌ FAIL: \(message) - Expected: \(String(describing: expected)), Got: \(String(describing: actual))")
    }
}

func assertTrue(_ condition: Bool, _ message: String) {
    if condition {
        print("✅ PASS: \(message)")
    } else {
        print("❌ FAIL: \(message)")
    }
}

func assertEqual(_ actual: CGFloat, _ expected: CGFloat, _ message: String) {
    if actual == expected {
        print("✅ PASS: \(message)")
    } else {
        print("❌ FAIL: \(message) - Expected: \(expected), Got: \(actual)")
    }
}

func assertEqual(_ actual: ScanCaptureState, _ expected: ScanCaptureState, _ message: String) {
    if actual == expected {
        print("✅ PASS: \(message)")
    } else {
        print("❌ FAIL: \(message) - Expected: \(expected), Got: \(actual)")
    }
}

func assertOrientation(_ actual: CGImagePropertyOrientation, _ expected: CGImagePropertyOrientation, _ message: String) {
    if actual == expected {
        print("✅ PASS: \(message)")
    } else {
        print("❌ FAIL: \(message) - Expected: \(expected.rawValue), Got: \(actual.rawValue)")
    }
}

func makeItem(_ text: String, x: CGFloat, y: CGFloat) -> RecognizedItem {
    RecognizedItem(text: text, boundingBox: CGRect(x: x, y: y, width: 0.2, height: 0.04))
}

print("=== Running IDParser Unit Tests ===")

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

var surnameOnly = IDData(documentType: "UNKNOWN", rawText: [])
surnameOnly.surname = "ROSSI"
assertTrue(ScanCaptureLogic.shouldAcceptCapture(surnameOnly), "Surname alone is accepted")

var typedParsed = IDData(documentType: "CIE_FRONT", rawText: [])
assertTrue(ScanCaptureLogic.shouldAcceptCapture(typedParsed), "Known document type is accepted")

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
    ]
    var finalized = false
    controller.processFrame(
        sortedItems: readyItems,
        autoCountdown: false,
        onScanSound: {},
        onCountdownBeep: {},
        onFinalize: { _ in finalized = true }
    )
    assertEqual(controller.captureState, .captured, "Ready frame finalizes immediately without countdown")
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

print("\n=== Verification Complete ===")
EOF

# Compile
swiftc Parser.swift BelfioreCodes.swift Scanner.swift ScanCaptureLogic.swift LiveScanController.swift main.swift -o test_runner

# Run
./test_runner

# Clean up
rm -f test_runner main.swift
