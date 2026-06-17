import Foundation
import CoreGraphics

struct OCRTextItem {
    let text: String
    let midX: CGFloat
    let midY: CGFloat
}

struct IDData: Codable {
    var documentType: String // CIE_FRONT, CIE_BACK, TESSERA_SANITARIA_FRONT, TESSERA_SANITARIA_BACK, UNKNOWN
    var surname: String?
    var name: String?
    var codiceFiscale: String?
    var documentNumber: String?
    var dateOfBirth: String?
    var placeOfBirth: String?
    var gender: String?
    var expiryDate: String?
    var nationality: String?
    var cardNumber: String? // TS Card number (20 digits on back)
    var rawText: [String]
    
    mutating func calculateCodiceFiscaleIfPossible() {
        guard codiceFiscale == nil else { return }
        guard let surname = surname,
              let name = name,
              let dob = dateOfBirth,
              let gender = gender,
              let pob = placeOfBirth else {
            return
        }
        
        if let calculated = IDParser.calculateCodiceFiscale(
            surname: surname,
            name: name,
            dateOfBirth: dob,
            gender: gender,
            placeOfBirth: pob
        ) {
            self.codiceFiscale = calculated
        }
    }
}

class IDParser {
    
    // Regular expressions
    private static let codiceFiscaleRegex = try! NSRegularExpression(
        pattern: "^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-EHLMPR-T][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$",
        options: .caseInsensitive
    )
    
    private static let cieNumberRegex = try! NSRegularExpression(
        pattern: "[A-Z]{2}[0-9]{5}[A-Z]{2}",
        options: .caseInsensitive
    )
    
    private static let tsNumberRegex = try! NSRegularExpression(
        pattern: "80380\\d{15}",
        options: []
    )
    
    private static let dateRegex = try! NSRegularExpression(
        pattern: "\\b(0[1-9]|[12]\\d|3[01])[-./](0[1-9]|1[0-2])[-./]((?:19|20)?\\d{2})\\b",
        options: []
    )
    
    // Set of common label words to identify and skip misread lines
    private static let labelWords: Set<String> = [
        "cognome", "surname", "cogaome", "suraame", "surnam", "cognomesurname",
        "nome", "name", "names", "given", "givennames", "givenname", "nami", "noma", "nomename",
        "sesso", "sex", "sessosex", "seso",
        "cittadinanza", "nationality", "nationalite", "vationality", "nationalty", "cittadinanz", "citadinanza",
        "luogo", "data", "nascita", "birth", "place", "date", "birthplace", "birthdate",
        "documento", "document", "card", "tessera", "sanitaria", "health", "insurance", "regional", "regione",
        "scadenza", "expiry", "valido", "altezza", "statura", "stature", "height", "emissione", "comune",
        "codice", "fiscale", "cod", "fisc", "fiscal", "tax", "code",
        "provincia", "prov", "firma", "signature", "ministero", "interno", "salute", "unione", "europea", "nazionale", "servizi"
    ]
    
    private static func isLabelLine(_ line: String) -> Bool {
        let lower = line.lowercased()
        
        // Check if any word in the line is a label word
        let words = lower.components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty }
        
        for word in words {
            if labelWords.contains(word) {
                return true
            }
        }
        return false
    }
    
    /// Parses OCR observations (with layout) and returns structured data.
    static func parse(ocrItems: [OCRTextItem], fallbackLines: [String]? = nil) -> IDData {
        let spatialItems = filterOCRNoise(ocrItems)
        let groupedLines = linesFromOCRItems(ocrItems)
        let lines = groupedLines.isEmpty ? (fallbackLines ?? ocrItems.map(\.text)) : groupedLines
        
        var data = parse(lines: lines)
        data.rawText = lines
        
        if let regionNames = resolveNamesFromLabelRegions(
            from: spatialItems.isEmpty ? ocrItems : spatialItems,
            codiceFiscale: data.codiceFiscale,
            placeOfBirth: data.placeOfBirth
        ) {
            data.surname = regionNames.surname
            data.name = regionNames.name
        }
        
        return data
    }
    
    /// Parses an array of lines detected by OCR and returns structured data
    static func parse(lines: [String]) -> IDData {
        let cleanedLines = lines.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        
        // 1. Check if MRZ exists (CIE Back)
        if let mrzData = parseMRZ(cleanedLines) {
            var data = mrzData
            data.documentType = "CIE_BACK"
            data.codiceFiscale = findCodiceFiscale(in: cleanedLines)
            return data
        }
        
        // 2. Perform heuristic extraction
        var data = IDData(
            documentType: "UNKNOWN",
            surname: nil,
            name: nil,
            codiceFiscale: nil,
            documentNumber: nil,
            dateOfBirth: nil,
            placeOfBirth: nil,
            gender: nil,
            expiryDate: nil,
            nationality: nil,
            cardNumber: nil,
            rawText: cleanedLines
        )
        
        // Find Codice Fiscale
        data.codiceFiscale = findCodiceFiscale(in: cleanedLines)
        
        // Find CIE Document Number
        data.documentNumber = findCIENumber(in: cleanedLines)
        
        // Find TS Card Number
        data.cardNumber = findTSCardNumber(in: cleanedLines)
        
        // Determine document type based on features
        data.documentType = determineDocumentType(lines: cleanedLines, data: data)
        
        // Find Dates (Birth and Expiry)
        let dates = findDates(in: cleanedLines)
        if !dates.isEmpty {
            let dateFormatter = DateFormatter()
            dateFormatter.dateFormat = "dd/MM/yyyy"
            
            let sortedDateStrings = dates.compactMap { dateStr -> (String, Date)? in
                if let date = dateFormatter.date(from: dateStr) {
                    return (dateStr, date)
                }
                return nil
            }.sorted(by: { $0.1 < $1.1 }).map { $0.0 }
            
            if sortedDateStrings.count == 1 {
                let dateStr = sortedDateStrings[0]
                if let year = Int(dateStr.suffix(4)) {
                    if year > 2026 {
                        data.expiryDate = dateStr
                    } else {
                        data.dateOfBirth = dateStr
                    }
                }
            } else if sortedDateStrings.count >= 2 {
                data.dateOfBirth = sortedDateStrings.first
                data.expiryDate = sortedDateStrings.last
            }
        }
        
        // Find Surname and Name (surname first so name extraction can skip it)
        let surnameLabels = ["cognome", "surname"]
        let nameLabels = ["nome", "name", "given name", "given"]
        data.surname = extractField(in: cleanedLines, labels: surnameLabels, validator: isValidNameOrSurname)
        let surnameLabelIndex = findLabelIndex(in: cleanedLines, labels: surnameLabels)
        data.name = extractField(
            in: cleanedLines,
            labels: nameLabels,
            validator: isValidNameOrSurname,
            excludeValues: Set([data.surname].compactMap { $0 }),
            preferLabelAfterIndex: surnameLabelIndex
        )
        
        // Find Place of Birth
        data.placeOfBirth = findPlaceOfBirth(in: cleanedLines, dateOfBirth: data.dateOfBirth)
        
        // Reconcile scrambled Tessera Sanitaria OCR ordering using codice fiscale
        if let codiceFiscale = data.codiceFiscale {
            var excludeValues = Set<String>()
            if let placeOfBirth = data.placeOfBirth {
                excludeValues.insert(placeOfBirth)
            }
            if let corrected = resolveNamesFromCodiceFiscale(
                in: cleanedLines,
                codiceFiscale: codiceFiscale,
                excludeValues: excludeValues
            ) ?? correctMisassignedNamesFromCodiceFiscale(
                surname: data.surname,
                name: data.name,
                codiceFiscale: codiceFiscale,
                placeOfBirth: data.placeOfBirth,
                lines: cleanedLines,
                excludeValues: excludeValues
            ) ?? correctSurnameAndName(
                surname: data.surname,
                name: data.name,
                candidates: collectNameCandidates(in: cleanedLines),
                codiceFiscale: codiceFiscale,
                excludeValues: excludeValues
            ) {
                data.surname = corrected.surname
                data.name = corrected.name
            }
        }
        
        // Find Gender
        data.gender = findGender(in: cleanedLines)
        
        // Find Nationality
        data.nationality = findNationality(in: cleanedLines)
        
        // Calculate Codice Fiscale if missing but all details are present
        if data.codiceFiscale == nil,
           let surname = data.surname,
           let name = data.name,
           let dob = data.dateOfBirth,
           let gender = data.gender,
           let pob = data.placeOfBirth {
            data.codiceFiscale = calculateCodiceFiscale(
                surname: surname,
                name: name,
                dateOfBirth: dob,
                gender: gender,
                placeOfBirth: pob
            )
        }
        
        return data
    }
    
    private static let ocrNoiseSubstrings = [
        "campi estratti",
        "dati rilevati",
        "dati rilevanti",
        "crea una cartella",
        "tessera sanitaria front",
        "sorriso",
    ]
    
    private static func filterOCRNoise(_ items: [OCRTextItem]) -> [OCRTextItem] {
        items.filter { item in
            let lower = item.text.lowercased()
            return !ocrNoiseSubstrings.contains { lower.contains($0) }
        }
    }
    
    private static func linesFromOCRItems(_ items: [OCRTextItem], rowThreshold: CGFloat = 0.035) -> [String] {
        guard !items.isEmpty else { return [] }
        
        var rows: [[OCRTextItem]] = []
        let sortedByY = items.sorted { $0.midY > $1.midY }
        
        for item in sortedByY {
            if let lastRow = rows.last,
               let anchor = lastRow.first,
               abs(item.midY - anchor.midY) < rowThreshold {
                rows[rows.count - 1].append(item)
            } else {
                rows.append([item])
            }
        }
        
        return rows.flatMap { row in
            row.sorted { $0.midX < $1.midX }.map(\.text)
        }
    }
    
    private static func isValidNameOrSurname(_ value: String) -> Bool {
        let allowed = CharacterSet.letters.union(CharacterSet.whitespaces)
            .union(CharacterSet(charactersIn: "-'’"))
        return !value.isEmpty && value.unicodeScalars.allSatisfy { allowed.contains($0) }
    }
    
    private static func isGenderOnlyValue(_ value: String) -> Bool {
        let clean = value.uppercased().trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        return clean == "M" || clean == "F"
    }
    
    private static func lineContainsDate(_ value: String) -> Bool {
        let range = NSRange(location: 0, length: value.utf16.count)
        return dateRegex.firstMatch(in: value, options: [], range: range) != nil
    }
    
    private static func isLikelyCodiceFiscale(_ value: String) -> Bool {
        let stripped = value.replacingOccurrences(of: " ", with: "").uppercased()
        guard stripped.count >= 16 else { return false }
        let range = NSRange(location: 0, length: stripped.utf16.count)
        return codiceFiscaleRegex.firstMatch(in: stripped, options: [], range: range) != nil
    }
    
    private static func namesMatchCodiceFiscale(surname: String, name: String, codiceFiscale: String) -> Bool {
        let cfPrefix = String(codiceFiscale.uppercased().prefix(6))
        guard cfPrefix.count == 6 else { return false }
        let expected = extractSurnameCode(surname) + extractNameCode(name)
        return expected == cfPrefix
    }
    
    private static func collectNameCandidates(in lines: [String]) -> [String] {
        let fieldLabels = ["cognome", "surname", "nome", "name", "given name", "given"]
        guard findLabelIndex(in: lines, labels: fieldLabels) != nil else { return [] }
        
        var candidates: [String] = []
        var seen = Set<String>()
        
        func addCandidate(_ value: String?) {
            guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !value.isEmpty,
                  isValidNameOrSurname(value),
                  !isGenderOnlyValue(value),
                  !lineContainsDate(value),
                  !isLikelyCodiceFiscale(value) else {
                return
            }
            
            let key = value.uppercased()
            guard !seen.contains(key) else { return }
            seen.insert(key)
            candidates.append(value)
        }
        
        for line in lines {
            for label in fieldLabels {
                if let range = findLabelRangeWithWordBoundaries(in: line, label: label),
                   let cleaned = cleanSuffixValue(String(line[range.upperBound...])) {
                    addCandidate(cleaned)
                }
            }
        }
        
        guard let startIndex = findLabelIndex(in: lines, labels: fieldLabels) else { return candidates }
        
        for i in startIndex..<lines.count {
            let line = lines[i].trimmingCharacters(in: .whitespacesAndNewlines)
            if line.isEmpty { continue }
            
            if isNameCandidateRegionEnd(line) { break }
            
            if isLabelLine(line) { continue }
            
            addCandidate(line)
        }
        
        return candidates
    }
    
    private static func isNameCandidateRegionEnd(_ line: String) -> Bool {
        let endLabels = [
            "data di scadenza",
            "scadenza",
            "expiry",
            "dati sanitari",
            "sanitaria regionale",
        ]
        return endLabels.contains { lineMatchesLabel(line, label: $0) }
    }
    
    private static let ignoredNameTokens: Set<String> = [
        "repubblica", "italiana", "tessera", "sanitaria", "carta", "regionale",
        "servizi", "nazionale", "europea", "ministero", "salute", "dati",
        "sanitari", "provincia", "prov", "europeo", "europei", "codice", "fiscale",
        "sesso", "scadenza", "nascita", "luogo", "data", "documento", "cittadinanza",
    ]
    
    private static func shouldIgnoreNameToken(_ value: String) -> Bool {
        let normalized = value.lowercased()
            .replacingOccurrences(of: "[^a-zàèéìòóù']", with: "", options: .regularExpression)
        if normalized.isEmpty || ignoredNameTokens.contains(normalized) {
            return true
        }
        return normalized.count < 2
    }
    
    private static func collectAllNameTokens(in lines: [String]) -> [String] {
        var tokens: [String] = []
        var seen = Set<String>()
        
        func addToken(_ value: String?) {
            guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !value.isEmpty,
                  !shouldIgnoreNameToken(value),
                  isValidNameOrSurname(value),
                  !isGenderOnlyValue(value),
                  !lineContainsDate(value),
                  !isLikelyCodiceFiscale(value) else {
                return
            }
            
            let key = value.uppercased()
            guard !seen.contains(key) else { return }
            seen.insert(key)
            tokens.append(value)
        }
        
        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty { continue }
            
            for label in ["cognome", "surname", "nome", "name", "given name", "given"] {
                if let range = findLabelRangeWithWordBoundaries(in: trimmed, label: label),
                   let cleaned = cleanSuffixValue(String(trimmed[range.upperBound...])) {
                    addToken(cleaned)
                }
            }
            
            if isLabelLine(trimmed) { continue }
            
            addToken(trimmed)
            
            let words = trimmed.components(separatedBy: .whitespaces).filter { !$0.isEmpty }
            if words.count >= 2 {
                for index in 0..<(words.count - 1) {
                    addToken(words[index] + " " + words[index + 1])
                }
            }
            if words.count >= 3 {
                for index in 0..<(words.count - 2) {
                    addToken(words[index] + " " + words[index + 1] + " " + words[index + 2])
                }
            }
            for word in words where word.count >= 2 {
                addToken(word)
            }
        }
        
        return tokens
    }
    
    private static func resolveNamesFromCodiceFiscale(
        in lines: [String],
        codiceFiscale: String,
        excludeValues: Set<String>
    ) -> (surname: String, name: String)? {
        let cfPrefix = String(codiceFiscale.uppercased().prefix(6))
        guard cfPrefix.count == 6 else { return nil }
        
        let expectedSurnameCode = String(cfPrefix.prefix(3))
        let expectedNameCode = String(cfPrefix.suffix(3))
        
        let tokens = collectAllNameTokens(in: lines).filter { token in
            !excludeValues.contains { $0.caseInsensitiveCompare(token) == .orderedSame }
        }
        
        let surnameMatches = tokens.filter { extractSurnameCode($0) == expectedSurnameCode }
        let nameMatches = tokens.filter { extractNameCode($0) == expectedNameCode }
        
        guard !surnameMatches.isEmpty, !nameMatches.isEmpty else { return nil }
        
        for surnameCandidate in surnameMatches {
            for nameCandidate in nameMatches
                where nameCandidate.caseInsensitiveCompare(surnameCandidate) != .orderedSame
                && namesMatchCodiceFiscale(
                    surname: surnameCandidate,
                    name: nameCandidate,
                    codiceFiscale: codiceFiscale
                ) {
                return (surnameCandidate, nameCandidate)
            }
        }
        
        return nil
    }
    
    private static func resolveNamesFromLabelRegions(
        from items: [OCRTextItem],
        codiceFiscale: String?,
        placeOfBirth: String?
    ) -> (surname: String, name: String)? {
        let cognomeLabels = items.filter { item in
            ["cognome", "surname"].contains { lineMatchesLabel(item.text, label: $0) }
        }
        let nomeLabels = items.filter { item in
            ["nome", "name"].contains { lineMatchesLabel(item.text, label: $0) }
        }
        
        guard !cognomeLabels.isEmpty, !nomeLabels.isEmpty else { return nil }
        
        var cfValidated: (surname: String, name: String)?
        var codeValidated: (surname: String, name: String)?
        var firstPair: (surname: String, name: String)?
        
        for cognomeLabel in cognomeLabels {
            guard let surname = findSpatialValue(near: cognomeLabel, in: items, placeOfBirth: placeOfBirth) else {
                continue
            }
            
            for nomeLabel in nomeLabels {
                guard let name = findSpatialValue(near: nomeLabel, in: items, placeOfBirth: placeOfBirth),
                      name.caseInsensitiveCompare(surname) != .orderedSame else {
                    continue
                }
                
                if firstPair == nil {
                    firstPair = (surname, name)
                }
                
                if let codiceFiscale,
                   namesMatchCodiceFiscale(surname: surname, name: name, codiceFiscale: codiceFiscale) {
                    cfValidated = (surname, name)
                } else if let codiceFiscale,
                          extractSurnameCode(surname) == String(codiceFiscale.uppercased().prefix(3)),
                          extractNameCode(name) == String(codiceFiscale.uppercased().dropFirst(3).prefix(3)) {
                    codeValidated = (surname, name)
                }
            }
        }
        
        return cfValidated ?? codeValidated ?? (codiceFiscale == nil ? firstPair : nil)
    }
    
    private static func findSpatialValue(
        near label: OCRTextItem,
        in items: [OCRTextItem],
        placeOfBirth: String?
    ) -> String? {
        let rowTolerance: CGFloat = 0.04
        var candidates: [(String, CGFloat)] = []
        
        for item in items {
            let text = item.text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty,
                  isValidNameOrSurname(text),
                  !isLabelLine(text),
                  !isGenderOnlyValue(text),
                  !lineContainsDate(text),
                  !isLikelyCodiceFiscale(text) else {
                continue
            }
            
            if let placeOfBirth,
               text.caseInsensitiveCompare(placeOfBirth) == .orderedSame {
                continue
            }
            
            let sameRow = abs(item.midY - label.midY) < rowTolerance
            let belowRow = item.midY < label.midY - 0.008 && item.midY > label.midY - 0.14
            let rightOfLabel = item.midX > label.midX + 0.02
            let columnDistance = abs(item.midX - label.midX)
            
            if sameRow && rightOfLabel {
                candidates.append((text, columnDistance))
            } else if belowRow && columnDistance < 0.16 {
                candidates.append((text, columnDistance))
            }
        }
        
        return candidates.min(by: { $0.1 < $1.1 })?.0
    }
    
    private static func correctMisassignedNamesFromCodiceFiscale(
        surname: String?,
        name: String?,
        codiceFiscale: String,
        placeOfBirth: String?,
        lines: [String],
        excludeValues: Set<String>
    ) -> (surname: String, name: String)? {
        let cfPrefix = String(codiceFiscale.uppercased().prefix(6))
        guard cfPrefix.count == 6 else { return nil }
        
        let expectedSurnameCode = String(cfPrefix.prefix(3))
        let expectedNameCode = String(cfPrefix.suffix(3))
        
        if let surname,
           let name,
           namesMatchCodiceFiscale(surname: surname, name: name, codiceFiscale: codiceFiscale) {
            return nil
        }
        
        // Common Tessera layout: cognome field holds the given name, nome field holds birthplace.
        if let misplacedName = surname,
           extractNameCode(misplacedName) == expectedNameCode,
           extractSurnameCode(misplacedName) != expectedSurnameCode {
            let tokens = collectAllNameTokens(in: lines).filter { token in
                !excludeValues.contains { $0.caseInsensitiveCompare(token) == .orderedSame }
            }
            
            if let surnameMatch = tokens.first(where: { extractSurnameCode($0) == expectedSurnameCode }),
               surnameMatch.caseInsensitiveCompare(misplacedName) != .orderedSame,
               namesMatchCodiceFiscale(
                   surname: surnameMatch,
                   name: misplacedName,
                   codiceFiscale: codiceFiscale
               ) {
                return (surnameMatch, misplacedName)
            }
            
            if let placeOfBirth,
               let misplacedBirthplace = name,
               misplacedBirthplace.caseInsensitiveCompare(placeOfBirth) == .orderedSame {
                return nil
            }
        }
        
        return nil
    }
    
    private static func correctSurnameAndName(
        surname: String?,
        name: String?,
        candidates: [String],
        codiceFiscale: String,
        excludeValues: Set<String>
    ) -> (surname: String, name: String)? {
        if let surname,
           let name,
           namesMatchCodiceFiscale(surname: surname, name: name, codiceFiscale: codiceFiscale) {
            return nil
        }
        
        let filteredCandidates = candidates.filter { candidate in
            !excludeValues.contains { $0.caseInsensitiveCompare(candidate) == .orderedSame }
        }
        
        guard filteredCandidates.count >= 2 else { return nil }
        
        for surnameCandidate in filteredCandidates {
            for nameCandidate in filteredCandidates where nameCandidate.caseInsensitiveCompare(surnameCandidate) != .orderedSame {
                if namesMatchCodiceFiscale(
                    surname: surnameCandidate,
                    name: nameCandidate,
                    codiceFiscale: codiceFiscale
                ) {
                    return (surnameCandidate, nameCandidate)
                }
            }
        }
        
        return nil
    }
    
    private static func findCodiceFiscale(in lines: [String]) -> String? {
        for line in lines {
            let stripped = line.replacingOccurrences(of: " ", with: "")
            
            // 1. Direct Regex match on the entire stripped line
            let range = NSRange(location: 0, length: stripped.utf16.count)
            if let match = codiceFiscaleRegex.firstMatch(in: stripped, options: [], range: range) {
                if let matchRange = Range(match.range, in: stripped) {
                    return String(stripped[matchRange]).uppercased()
                }
            }
            
            // 2. Extract contiguous alphanumeric blocks and scan with sliding window of length 16
            let blocks = stripped.components(separatedBy: CharacterSet.alphanumerics.inverted)
                .filter { $0.count >= 16 }
            for block in blocks {
                let blockChars = Array(block)
                for start in 0...(blockChars.count - 16) {
                    let candidate = String(blockChars[start..<(start + 16)])
                    
                    // Direct match candidate
                    let candRange = NSRange(location: 0, length: candidate.utf16.count)
                    if codiceFiscaleRegex.firstMatch(in: candidate, options: [], range: candRange) != nil {
                        return candidate.uppercased()
                    }
                    
                    // Repair candidate
                    if let repaired = repairCodiceFiscale(candidate) {
                        return repaired
                    }
                }
            }
        }
        return nil
    }
    
    /// Auto-repairs common OCR errors in Italian Codice Fiscale strings
    private static func repairCodiceFiscale(_ input: String) -> String? {
        let clean = input.uppercased().replacingOccurrences(of: "[^A-Z0-9]", with: "", options: .regularExpression)
        guard clean.count == 16 else { return nil }
        
        var chars = Array(clean)
        
        let letterPositions = [0, 1, 2, 3, 4, 5, 8, 11, 15]
        let numberPositions = [6, 7, 9, 10, 12, 13, 14]
        
        // Common digit-to-letter OCR misreads
        let digitToLetter: [Character: Character] = [
            "0": "O", "1": "I", "2": "Z", "3": "E", "4": "A", "5": "S", "6": "G", "8": "B", "9": "P"
        ]
        
        // Common letter-to-digit OCR misreads (includes standard omocodia)
        let letterToDigit: [Character: Character] = [
            "O": "0", "I": "1", "Z": "2", "E": "3", "A": "4", "S": "5", "G": "6", "B": "8", "P": "9",
            "L": "0", "M": "1", "N": "2", "Q": "4", "R": "5", "T": "7", "U": "8", "V": "9"
        ]
        
        var replacementsCount = 0
        
        // Fix expected letter positions
        for pos in letterPositions {
            let c = chars[pos]
            if c.isNumber {
                if let replacement = digitToLetter[c] {
                    chars[pos] = replacement
                    replacementsCount += 1
                }
            }
        }
        
        // Fix expected number positions
        for pos in numberPositions {
            let c = chars[pos]
            if !c.isNumber {
                if let replacement = letterToDigit[c] {
                    chars[pos] = replacement
                    replacementsCount += 1
                }
            }
        }
        
        guard replacementsCount <= 3 else { return nil }
        
        let repaired = String(chars)
        let range = NSRange(location: 0, length: repaired.utf16.count)
        if codiceFiscaleRegex.firstMatch(in: repaired, options: [], range: range) != nil {
            return repaired
        }
        
        return nil
    }
    
    private static func findCIENumber(in lines: [String]) -> String? {
        for line in lines {
            let stripped = line.replacingOccurrences(of: " ", with: "")
            let range = NSRange(location: 0, length: stripped.utf16.count)
            if let match = cieNumberRegex.firstMatch(in: stripped, options: [], range: range) {
                if let matchRange = Range(match.range, in: stripped) {
                    return String(stripped[matchRange]).uppercased()
                }
            }
        }
        return nil
    }
    
    private static func findTSCardNumber(in lines: [String]) -> String? {
        for line in lines {
            let stripped = line.replacingOccurrences(of: " ", with: "")
            let range = NSRange(location: 0, length: stripped.utf16.count)
            if let match = tsNumberRegex.firstMatch(in: stripped, options: [], range: range) {
                if let matchRange = Range(match.range, in: stripped) {
                    return String(stripped[matchRange])
                }
            }
        }
        return nil
    }
    
    private static func findDates(in lines: [String]) -> [String] {
        var foundDates: [String] = []
        for line in lines {
            let range = NSRange(location: 0, length: line.utf16.count)
            let matches = dateRegex.matches(in: line, options: [], range: range)
            for match in matches {
                if match.numberOfRanges >= 4,
                   let dayRange = Range(match.range(at: 1), in: line),
                   let monthRange = Range(match.range(at: 2), in: line),
                   let yearRange = Range(match.range(at: 3), in: line) {
                    let day = String(line[dayRange])
                    let month = String(line[monthRange])
                    var year = String(line[yearRange])
                    
                    if year.count == 2 {
                        if let yearVal = Int(year) {
                            year = (yearVal < 30 ? "20" : "19") + year
                        }
                    }
                    foundDates.append("\(day)/\(month)/\(year)")
                }
            }
        }
        return foundDates
    }
    
    private static func isSubsequence(_ sub: [String], in parent: [String]) -> Bool {
        guard sub.count <= parent.count else { return false }
        for i in 0...(parent.count - sub.count) {
            if Array(parent[i..<(i + sub.count)]) == sub {
                return true
            }
        }
        return false
    }

    private static func lineMatchesLabel(_ line: String, label: String) -> Bool {
        let lineLower = line.lowercased()
        let lineParts = lineLower.components(separatedBy: CharacterSet(charactersIn: "/:"))
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        let lineWords = lineLower.components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty }
        let labelLower = label.lowercased()
        
        if lineParts.contains(labelLower) {
            return true
        }
        
        let labelWordsList = labelLower.components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty }
        return !labelWordsList.isEmpty && isSubsequence(labelWordsList, in: lineWords)
    }
    
    private static func findLabelIndex(in lines: [String], labels: [String], preferAfterIndex: Int? = nil) -> Int? {
        var firstMatch: Int? = nil
        var preferredMatch: Int? = nil
        
        for (index, line) in lines.enumerated() {
            for label in labels where lineMatchesLabel(line, label: label) {
                if firstMatch == nil {
                    firstMatch = index
                }
                if let after = preferAfterIndex, index > after, preferredMatch == nil {
                    preferredMatch = index
                }
            }
        }
        
        return preferredMatch ?? firstMatch
    }
    
    private static let skipWords: Set<String> = [
        "cognome", "surname", "cogaome", "suraame", "surnam", "cognomesurname",
        "nome", "name", "names", "given", "givennames", "givenname", "nami", "noma", "nomename",
        "sesso", "sex", "sessosex", "seso", "gender",
        "cittadinanza", "nationality", "nationalite", "vationality", "nationalty", "cittadinanz", "citadinanza",
        "luogo", "data", "nascita", "birth", "place", "date", "birthplace", "birthdate", "placeanddateofbirth", "placedateofbirth",
        "documento", "document", "card", "tessera", "sanitaria", "health", "insurance", "regional", "regione",
        "scadenza", "expiry", "valido", "altezza", "statura", "stature", "height", "emissione", "comune",
        "codice", "fiscale", "cod", "fisc", "fiscal", "tax", "code",
        "provincia", "prov", "firma", "signature", "ministero", "interno", "salute", "unione", "europea", "nazionale", "servizi",
        "e", "di", "and", "of", "da", "de", "d", "l", "la", "le", "del", "della"
    ]

    private static func cleanSuffixValue(_ suffix: String) -> String? {
        let trimmed = suffix.trimmingCharacters(in: CharacterSet(charactersIn: " :/\\_-,.\t"))
        if trimmed.isEmpty { return nil }
        
        let words = trimmed.components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }
        
        var valueWords: [String] = []
        var skipping = true
        
        for word in words {
            let cleanWord = word.lowercased().replacingOccurrences(of: "[^a-z0-9]", with: "", options: .regularExpression)
            if skipping {
                if skipWords.contains(cleanWord) || cleanWord.isEmpty {
                    continue
                } else {
                    skipping = false
                    valueWords.append(word)
                }
            } else {
                valueWords.append(word)
            }
        }
        
        if valueWords.isEmpty { return nil }
        let result = valueWords.joined(separator: " ").trimmingCharacters(in: CharacterSet(charactersIn: " :/\\_-,.\t"))
        return result.isEmpty ? nil : result
    }

    private static func findLabelRangeWithWordBoundaries(in line: String, label: String) -> Range<String.Index>? {
        let lower = line.lowercased()
        var searchStartIndex = lower.startIndex
        
        while let range = lower.range(of: label, range: searchStartIndex..<lower.endIndex) {
            var isBeforeBoundary = true
            if range.lowerBound > lower.startIndex {
                let beforeChar = lower[lower.index(before: range.lowerBound)]
                if beforeChar.isLetter || beforeChar.isNumber {
                    isBeforeBoundary = false
                }
            }
            
            var isAfterBoundary = true
            if range.upperBound < lower.endIndex {
                let afterChar = lower[range.upperBound]
                if afterChar.isLetter || afterChar.isNumber {
                    isAfterBoundary = false
                }
            }
            
            if isBeforeBoundary && isAfterBoundary {
                return range
            }
            
            searchStartIndex = range.upperBound
        }
        
        return nil
    }

    private static func extractField(
        in lines: [String],
        labels: [String],
        validator: (String) -> Bool,
        excludeValues: Set<String> = [],
        preferLabelAfterIndex: Int? = nil
    ) -> String? {
        // 1. Try same line
        for line in lines {
            for label in labels {
                if let range = findLabelRangeWithWordBoundaries(in: line, label: label) {
                    let suffix = String(line[range.upperBound...])
                    if let cleaned = cleanSuffixValue(suffix),
                       validator(cleaned),
                       !excludeValues.contains(cleaned) {
                        return cleaned
                    }
                }
            }
        }
        
        // 2. Try subsequent lines
        if let labelIndex = findLabelIndex(in: lines, labels: labels, preferAfterIndex: preferLabelAfterIndex) {
            for i in (labelIndex + 1)..<lines.count {
                let candidate = lines[i]
                if !isLabelLine(candidate) {
                    let cleaned = candidate.trimmingCharacters(in: CharacterSet(charactersIn: " :/\\_-\t"))
                    if validator(cleaned), !excludeValues.contains(cleaned) {
                        return cleaned
                    }
                }
            }
        }
        return nil
    }
    
    private static func findPlaceOfBirth(in lines: [String], dateOfBirth: String?) -> String? {
        let labels = ["luogo e data di nascita", "luogo di nascita", "place and date of birth", "place of birth", "luogo", "place"]
        
        // 1. Try same line
        for line in lines {
            for label in labels {
                if let range = findLabelRangeWithWordBoundaries(in: line, label: label) {
                    let suffix = String(line[range.upperBound...])
                    if var cleaned = cleanSuffixValue(suffix) {
                        if let dob = dateOfBirth {
                            cleaned = cleaned.replacingOccurrences(of: dob, with: "")
                                .replacingOccurrences(of: dob.replacingOccurrences(of: "/", with: "."), with: "")
                        }
                        cleaned = dateRegex.stringByReplacingMatches(in: cleaned, options: [], range: NSRange(location: 0, length: cleaned.utf16.count), withTemplate: "")
                        
                        let cleanPlace = cleaned.trimmingCharacters(in: CharacterSet(charactersIn: " ,.-/\t"))
                        if !cleanPlace.isEmpty && cleanPlace.count > 2 && !isLabelLine(cleanPlace) {
                            return cleanPlace
                        }
                    }
                }
            }
        }
        
        // 2. Try subsequent lines
        if let index = findLabelIndex(in: lines, labels: labels) {
            for i in (index + 1)..<lines.count {
                let candidate = lines[i]
                if !isLabelLine(candidate) {
                    var place = candidate
                    if let dob = dateOfBirth {
                        place = place.replacingOccurrences(of: dob, with: "")
                            .replacingOccurrences(of: dob.replacingOccurrences(of: "/", with: "."), with: "")
                    }
                    place = dateRegex.stringByReplacingMatches(in: place, options: [], range: NSRange(location: 0, length: place.utf16.count), withTemplate: "")
                    
                    let cleanPlace = place.trimmingCharacters(in: CharacterSet(charactersIn: " ,.-/\t"))
                    if !cleanPlace.isEmpty && cleanPlace.count > 2 {
                        return cleanPlace
                    }
                }
            }
        }
        
        // 3. Fallback: check if any line contains DOB and another text
        if let dob = dateOfBirth {
            for line in lines {
                if line.contains(dob) || line.contains(dob.replacingOccurrences(of: "/", with: ".")) {
                    var place = line.replacingOccurrences(of: dob, with: "")
                        .replacingOccurrences(of: dob.replacingOccurrences(of: "/", with: "."), with: "")
                    
                    // Also clean labels from this line if any
                    let labelStrs = ["luogo e data di nascita", "luogo di nascita", "place and date of birth", "place of birth", "luogo", "data", "nascita", "birth", "place", "date"]
                    for label in labelStrs {
                        place = place.replacingOccurrences(of: label, with: "", options: .caseInsensitive)
                    }
                    
                    let cleanPlace = place.trimmingCharacters(in: CharacterSet(charactersIn: " ,.-/\t"))
                    if !cleanPlace.isEmpty && cleanPlace.count > 2 && !isLabelLine(cleanPlace) {
                        return cleanPlace
                    }
                }
            }
        }
        
        return nil
    }
    
    private static func findGender(in lines: [String]) -> String? {
        let labels = ["sesso", "sex", "gender"]
        
        // 1. Try same line
        for line in lines {
            for label in labels {
                if let range = findLabelRangeWithWordBoundaries(in: line, label: label) {
                    let suffix = String(line[range.upperBound...])
                    if let cleaned = cleanSuffixValue(suffix) {
                        let upper = cleaned.uppercased()
                        if upper.contains("M") { return "M" }
                        if upper.contains("F") { return "F" }
                    }
                }
            }
        }
        
        // 2. Try subsequent lines
        if let index = findLabelIndex(in: lines, labels: labels) {
            for i in (index + 1)..<min(index + 4, lines.count) {
                let val = lines[i].trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
                let words = val.components(separatedBy: CharacterSet.alphanumerics.inverted)
                if words.contains("M") { return "M" }
                if words.contains("F") { return "F" }
            }
        }
        
        // 3. Fallback scan: look for any line that is exactly M or F (ignoring non-alphanumeric chars)
        for line in lines {
            let clean = line.uppercased().trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
            if clean == "M" || clean == "F" {
                return clean
            }
        }
        
        // 4. Standalone M or F word search in all lines, except label lines
        for line in lines {
            if !isLabelLine(line) {
                let words = line.uppercased().components(separatedBy: CharacterSet.alphanumerics.inverted)
                    .filter { !$0.isEmpty }
                if words.count == 1 {
                    if words[0] == "M" || words[0] == "F" {
                        return words[0]
                    }
                }
            }
        }
        
        return nil
    }
    
    private static func findNationality(in lines: [String]) -> String? {
        let labels = ["cittadinanza", "nationality"]
        let allowedChars = CharacterSet.letters.union(CharacterSet.whitespaces)
        let isValidNationality = { (val: String) -> Bool in
            return val.count > 1 && val.count < 15 && val.unicodeScalars.allSatisfy({ allowedChars.contains($0) })
        }
        
        if let extracted = extractField(in: lines, labels: labels, validator: isValidNationality) {
            return extracted.uppercased()
        }
        
        for line in lines {
            let val = line.uppercased().trimmingCharacters(in: .whitespacesAndNewlines)
            if val == "ITA" || val == "ITALIANA" || val == "ITALIA" || val == "ITALIAN" {
                return "ITA"
            }
        }
        
        return nil
    }
    
    private static func determineDocumentType(lines: [String], data: IDData) -> String {
        let fullText = lines.joined(separator: " ").lowercased()
        
        // 1. Tessera Sanitaria check
        if fullText.contains("tessera sanitaria") || 
           fullText.contains("servizio sanitario nazionale") || 
           fullText.contains("health insurance card") || 
           fullText.contains("tessera europea") ||
           data.cardNumber != nil {
            if data.codiceFiscale != nil && (fullText.contains("cognome") || fullText.contains("nome")) {
                return "TESSERA_SANITARIA_FRONT"
            } else {
                return "TESSERA_SANITARIA_BACK"
            }
        }
        
        // 2. Carta di Identità (CIE) check
        let isCIE = fullText.contains("carta d'identita") || 
                    fullText.contains("carta di identita") || 
                    fullText.contains("carta d'identità") || 
                    fullText.contains("carta di identità") || 
                    fullText.contains("repubblica italiana") || 
                    fullText.contains("repubblica ltaliana") || // OCR 'I' as 'l'
                    data.documentNumber != nil
                    
        if isCIE {
            if fullText.contains("indirizzo") || 
               fullText.contains("residenza") || 
               fullText.contains("mrz") || 
               lines.contains(where: { $0.count == 30 && ($0.hasPrefix("I") || $0.hasPrefix("C") || $0.hasPrefix("A")) }) {
                return "CIE_BACK"
            }
            return "CIE_FRONT"
        }
        
        if data.cardNumber != nil {
            return "TESSERA_SANITARIA_BACK"
        }
        
        return "UNKNOWN"
    }
    
    // MARK: - MRZ Parser for TD1 Format
    
    private static func parseMRZ(_ lines: [String]) -> IDData? {
        let mrzLines = lines.map { 
            $0.replacingOccurrences(of: " ", with: "")
              .replacingOccurrences(of: "\t", with: "")
              .uppercased() 
        }.filter { $0.count == 30 }
        
        guard mrzLines.count >= 3 else { return nil }
        
        for i in 0...(mrzLines.count - 3) {
            let l1 = mrzLines[i]
            let l2 = mrzLines[i+1]
            let l3 = mrzLines[i+2]
            
            let isITA = l1.contains("ITA")
            let hasDocType = l1.hasPrefix("I") || l1.hasPrefix("C") || l1.hasPrefix("A")
            
            if hasDocType && (isITA || l1.hasPrefix("I<") || l1.hasPrefix("C<") || l1.hasPrefix("A<")) {
                var data = IDData(
                    documentType: "CIE_BACK",
                    surname: nil,
                    name: nil,
                    codiceFiscale: nil,
                    documentNumber: nil,
                    dateOfBirth: nil,
                    placeOfBirth: nil,
                    gender: nil,
                    expiryDate: nil,
                    nationality: nil,
                    cardNumber: nil,
                    rawText: lines
                )
                
                if l1.count >= 14 {
                    let startIndex = l1.index(l1.startIndex, offsetBy: 5)
                    let endIndex = l1.index(l1.startIndex, offsetBy: 14)
                    data.documentNumber = String(l1[startIndex..<endIndex]).replacingOccurrences(of: "<", with: "")
                }
                
                if l2.count >= 18 {
                    let dobStr = String(l2[l2.startIndex..<l2.index(l2.startIndex, offsetBy: 6)])
                    let genderStr = String(l2[l2.index(l2.startIndex, offsetBy: 7)])
                    let expStr = String(l2[l2.index(l2.startIndex, offsetBy: 8)..<l2.index(l2.startIndex, offsetBy: 14)])
                    let natStr = String(l2[l2.index(l2.startIndex, offsetBy: 15)..<l2.index(l2.startIndex, offsetBy: 18)])
                    
                    data.dateOfBirth = formatDate(yyMMdd: dobStr)
                    data.gender = genderStr == "<" ? nil : genderStr
                    data.expiryDate = formatDate(yyMMdd: expStr, future: true)
                    data.nationality = natStr.replacingOccurrences(of: "<", with: "")
                }
                
                let parts = l3.components(separatedBy: "<<")
                if parts.count >= 1 {
                    data.surname = parts[0].replacingOccurrences(of: "<", with: " ").trimmingCharacters(in: .whitespacesAndNewlines)
                }
                if parts.count >= 2 {
                    data.name = parts[1].replacingOccurrences(of: "<", with: " ").trimmingCharacters(in: .whitespacesAndNewlines)
                }
                
                return data
            }
        }
        
        return nil
    }
    
    private static func formatDate(yyMMdd: String, future: Bool = false) -> String? {
        guard yyMMdd.count == 6, CharacterSet.decimalDigits.isSuperset(of: CharacterSet(charactersIn: yyMMdd)) else { return nil }
        let yy = String(yyMMdd[yyMMdd.startIndex..<yyMMdd.index(yyMMdd.startIndex, offsetBy: 2)])
        let mm = String(yyMMdd[yyMMdd.index(yyMMdd.startIndex, offsetBy: 2)..<yyMMdd.index(yyMMdd.startIndex, offsetBy: 4)])
        let dd = String(yyMMdd[yyMMdd.index(yyMMdd.startIndex, offsetBy: 4)..<yyMMdd.index(yyMMdd.startIndex, offsetBy: 6)])
        
        guard let yearVal = Int(yy) else { return nil }
        let prefix = future ? (yearVal < 50 ? "20" : "19") : (yearVal < 30 ? "20" : "19")
        return "\(dd)/\(mm)/\(prefix)\(yy)"
    }
    
    // MARK: - Codice Fiscale Calculation Logic
    
    static func calculateCodiceFiscale(surname: String, name: String, dateOfBirth: String, gender: String, placeOfBirth: String) -> String? {
        // 1. Surname code (3 chars)
        let surnameCode = extractSurnameCode(surname)
        
        // 2. Name code (3 chars)
        let nameCode = extractNameCode(name)
        
        // 3. Birth Date code (5 chars)
        guard let dateCode = extractBirthDateCode(dateOfBirth: dateOfBirth, gender: gender) else {
            return nil
        }
        
        // 4. Belfiore code (4 chars) - Clean place of birth including trailing province codes
        let cleanPob = placeOfBirth
            .replacingOccurrences(of: "\\s*\\([^)]*\\)\\s*$", with: "", options: .regularExpression)
            .replacingOccurrences(of: "[-/\\s]+[A-Z]{2}\\s*$", with: "", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
            
        guard let belfioreCode = Belfiore.resolve(cleanPob) else {
            print("Failed to resolve Belfiore code for place: \(cleanPob)")
            return nil
        }
        
        let base15 = surnameCode + nameCode + dateCode + belfioreCode
        
        // 5. Check character (1 char)
        guard let checkChar = calculateCheckDigit(base15) else {
            return nil
        }
        
        return base15 + String(checkChar)
    }
    
    private static func extractSurnameCode(_ surname: String) -> String {
        let clean = surname.uppercased().replacingOccurrences(of: "[^A-Z]", with: "", options: .regularExpression)
        let consonants = clean.filter { !"AEIOU".contains($0) }
        let vowels = clean.filter { "AEIOU".contains($0) }
        
        var code = ""
        for c in consonants {
            if code.count < 3 { code.append(c) }
        }
        for v in vowels {
            if code.count < 3 { code.append(v) }
        }
        while code.count < 3 {
            code.append("X")
        }
        return code
    }
    
    private static func extractNameCode(_ name: String) -> String {
        let clean = name.uppercased().replacingOccurrences(of: "[^A-Z]", with: "", options: .regularExpression)
        let consonants = clean.filter { !"AEIOU".contains($0) }
        let vowels = clean.filter { "AEIOU".contains($0) }
        
        var code = ""
        if consonants.count >= 4 {
            // Take 1st, 3rd, 4th consonants (indices 0, 2, 3)
            code.append(consonants[consonants.index(consonants.startIndex, offsetBy: 0)])
            code.append(consonants[consonants.index(consonants.startIndex, offsetBy: 2)])
            code.append(consonants[consonants.index(consonants.startIndex, offsetBy: 3)])
        } else {
            for c in consonants {
                if code.count < 3 { code.append(c) }
            }
            for v in vowels {
                if code.count < 3 { code.append(v) }
            }
            while code.count < 3 {
                code.append("X")
            }
        }
        return code
    }
    
    private static func extractBirthDateCode(dateOfBirth: String, gender: String) -> String? {
        let parts = dateOfBirth.components(separatedBy: "/")
        guard parts.count == 3,
              let day = Int(parts[0]),
              let month = Int(parts[1]),
              let year = Int(parts[2]) else {
            return nil
        }
        
        let yearCode = String(format: "%02d", year % 100)
        
        let monthMap: [Int: String] = [
            1: "A", 2: "B", 3: "C", 4: "D", 5: "E", 6: "H",
            7: "L", 8: "M", 9: "P", 10: "R", 11: "S", 12: "T"
        ]
        guard let monthCode = monthMap[month] else { return nil }
        
        let isFemale = gender.uppercased() == "F"
        let dayVal = isFemale ? (day + 40) : day
        let dayCode = String(format: "%02d", dayVal)
        
        return yearCode + monthCode + dayCode
    }
    
    private static func calculateCheckDigit(_ base15: String) -> Character? {
        guard base15.count == 15 else { return nil }
        
        let oddMap: [Character: Int] = [
            "0": 1, "1": 0, "2": 5, "3": 7, "4": 9, "5": 13, "6": 15, "7": 17, "8": 19, "9": 21,
            "A": 1, "B": 0, "C": 5, "D": 7, "E": 9, "F": 13, "G": 15, "H": 17, "I": 19, "J": 21,
            "K": 2, "L": 4, "M": 18, "N": 20, "O": 11, "P": 3, "Q": 6, "R": 8, "S": 12, "T": 14,
            "U": 16, "V": 10, "W": 22, "X": 25, "Y": 24, "Z": 23
        ]
        
        let evenMap: [Character: Int] = [
            "0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
            "A": 0, "B": 1, "C": 2, "D": 3, "E": 4, "F": 5, "G": 6, "H": 7, "I": 8, "J": 9,
            "K": 10, "L": 11, "M": 12, "N": 13, "O": 14, "P": 15, "Q": 16, "R": 17, "S": 18, "T": 19,
            "U": 20, "V": 21, "W": 22, "X": 23, "Y": 24, "Z": 25
        ]
        
        var sum = 0
        let chars = Array(base15.uppercased())
        for idx in 0..<15 {
            let c = chars[idx]
            let isOddPos = (idx % 2 == 0)
            
            if isOddPos {
                guard let val = oddMap[c] else { return nil }
                sum += val
            } else {
                guard let val = evenMap[c] else { return nil }
                sum += val
            }
        }
        
        let remainder = sum % 26
        let checkChars = Array("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
        return checkChars[remainder]
    }
}
