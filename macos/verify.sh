#!/bin/bash
# CI: GitHub Actions runs this via .github/workflows/macos-verify.yml (and scanid-release.yml).
set -e

# Create a temporary test runner source file
cat << 'EOF' > main.swift
import Foundation

func assertEqual(_ actual: String?, _ expected: String?, _ message: String) {
    if actual == expected {
        print("✅ PASS: \(message)")
    } else {
        print("❌ FAIL: \(message) - Expected: \(String(describing: expected)), Got: \(String(describing: actual))")
    }
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

print("\n=== Verification Complete ===")
EOF

# Compile
swiftc Parser.swift BelfioreCodes.swift main.swift -o test_runner

# Run
./test_runner

# Clean up
rm -f test_runner main.swift
