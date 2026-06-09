import Foundation

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
        
        // Find Surname and Name using label anchors, skipping intermediate label/metadata lines
        if let surnameIndex = findLabelIndex(in: cleanedLines, labels: ["cognome", "surname"]) {
            for i in (surnameIndex + 1)..<cleanedLines.count {
                let candidate = cleanedLines[i]
                if !isLabelLine(candidate) && candidate.count > 1 && isValidNameOrSurname(candidate) {
                    data.surname = candidate
                    break
                }
            }
        }
        
        if let nameIndex = findLabelIndex(in: cleanedLines, labels: ["nome", "name", "given name"]) {
            for i in (nameIndex + 1)..<cleanedLines.count {
                let candidate = cleanedLines[i]
                if !isLabelLine(candidate) && candidate.count > 1 && isValidNameOrSurname(candidate) {
                    data.name = candidate
                    break
                }
            }
        }
        
        // Fallback for Surname/Name merged prefixes
        if data.surname == nil {
            for line in cleanedLines {
                if let val = getValueAfterPrefix(line: line, prefixes: ["cognome", "surname"]) {
                    if !isLabelLine(val) && isValidNameOrSurname(val) {
                        data.surname = val
                        break
                    }
                }
            }
        }
        if data.name == nil {
            for line in cleanedLines {
                if let val = getValueAfterPrefix(line: line, prefixes: ["nome", "name", "given"]) {
                    if !isLabelLine(val) && isValidNameOrSurname(val) {
                        data.name = val
                        break
                    }
                }
            }
        }
        
        // Find Place of Birth
        // Find Place of Birth
        data.placeOfBirth = findPlaceOfBirth(in: cleanedLines, dateOfBirth: data.dateOfBirth)
        
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
    
    private static func isValidNameOrSurname(_ value: String) -> Bool {
        let allowed = CharacterSet.letters.union(CharacterSet.whitespaces)
            .union(CharacterSet(charactersIn: "-'’"))
        return !value.isEmpty && value.unicodeScalars.allSatisfy { allowed.contains($0) }
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

    private static func findLabelIndex(in lines: [String], labels: [String]) -> Int? {
        for (index, line) in lines.enumerated() {
            let lineLower = line.lowercased()
            let lineParts = lineLower.components(separatedBy: CharacterSet(charactersIn: "/:"))
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            
            let lineWords = lineLower.components(separatedBy: CharacterSet.alphanumerics.inverted)
                .filter { !$0.isEmpty }
                
            for label in labels {
                let labelLower = label.lowercased()
                
                // 1. Check exact slash/colon components
                if lineParts.contains(labelLower) {
                    return index
                }
                
                // 2. Check contiguous word subsequence
                let labelWordsList = labelLower.components(separatedBy: CharacterSet.alphanumerics.inverted)
                    .filter { !$0.isEmpty }
                if !labelWordsList.isEmpty && isSubsequence(labelWordsList, in: lineWords) {
                    return index
                }
            }
        }
        return nil
    }
    
    private static func getValueAfterPrefix(line: String, prefixes: [String]) -> String? {
        let lowercased = line.lowercased()
        for prefix in prefixes {
            let words = lowercased.components(separatedBy: CharacterSet.alphanumerics.inverted)
                .filter { !$0.isEmpty }
            if words.first == prefix {
                if let range = lowercased.range(of: prefix) {
                    let afterPrefix = line[range.upperBound...]
                    let clean = afterPrefix.trimmingCharacters(in: CharacterSet(charactersIn: " :/\\_-\t"))
                    if !clean.isEmpty && clean.count > 2 && !clean.contains("/") {
                        return clean
                    }
                }
            }
        }
        return nil
    }
    
    private static func findPlaceOfBirth(in lines: [String], dateOfBirth: String?) -> String? {
        if let index = findLabelIndex(in: lines, labels: ["luogo di nascita", "luogo e data di nascita", "place of birth", "luogo", "place"]) {
            for i in (index + 1)..<lines.count {
                let candidate = lines[i]
                if !isLabelLine(candidate) {
                    if let dob = dateOfBirth {
                        let clean = candidate.replacingOccurrences(of: dob, with: "")
                            .replacingOccurrences(of: dob.replacingOccurrences(of: "/", with: "."), with: "")
                            .trimmingCharacters(in: CharacterSet(charactersIn: " ,.-/"))
                        if !clean.isEmpty && clean.count > 2 {
                            return clean
                        }
                    } else {
                        return candidate
                    }
                }
            }
        }
        
        // Fallback 1: check if any line starts with/contains the label followed by the value
        for line in lines {
            let lower = line.lowercased()
            for label in ["luogo e data di nascita", "luogo di nascita", "place of birth", "luogo", "place"] {
                if let range = lower.range(of: label) {
                    let after = line[range.upperBound...]
                    var clean = after.trimmingCharacters(in: CharacterSet(charactersIn: " :/\\_-\t"))
                    
                    if let dob = dateOfBirth {
                        clean = clean.replacingOccurrences(of: dob, with: "")
                            .replacingOccurrences(of: dob.replacingOccurrences(of: "/", with: "."), with: "")
                            .trimmingCharacters(in: CharacterSet(charactersIn: " ,.-/"))
                    }
                    
                    if !clean.isEmpty && clean.count > 2 && !isLabelLine(clean) {
                        return clean
                    }
                }
            }
        }
        
        // Fallback 2: search for line containing DOB and extract place from it
        if let dob = dateOfBirth {
            for line in lines {
                if line.contains(dob) || line.contains(dob.replacingOccurrences(of: "/", with: ".")) {
                    let clean = line.replacingOccurrences(of: dob, with: "")
                        .replacingOccurrences(of: dob.replacingOccurrences(of: "/", with: "."), with: "")
                        .trimmingCharacters(in: CharacterSet(charactersIn: " ,.-/"))
                    if !clean.isEmpty && clean.count > 2 && !isLabelLine(clean) {
                        return clean
                    }
                }
            }
        }
        
        return nil
    }
    
    private static func findGender(in lines: [String]) -> String? {
        // 1. Check if the label line itself contains M or F as an isolated word
        for line in lines {
            let lower = line.lowercased()
            if lower.contains("sesso") || lower.contains("sex") {
                let words = line.uppercased().components(separatedBy: CharacterSet.alphanumerics.inverted)
                if words.contains("M") { return "M" }
                if words.contains("F") { return "F" }
            }
        }
        
        // 2. Scan lines immediately following the label index
        if let index = findLabelIndex(in: lines, labels: ["sesso", "sex"]) {
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
        if let index = findLabelIndex(in: lines, labels: ["cittadinanza", "nationality"]) {
            for i in (index + 1)..<lines.count {
                let candidate = lines[i].trimmingCharacters(in: .whitespacesAndNewlines)
                if !isLabelLine(candidate) && candidate.count > 1 && candidate.count < 15 {
                    // Check if it contains only letters and spaces
                    let allowedChars = CharacterSet.letters.union(CharacterSet.whitespaces)
                    if candidate.unicodeScalars.allSatisfy({ allowedChars.contains($0) }) {
                        return candidate.uppercased()
                    }
                }
            }
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
        
        if fullText.contains("tessera sanitaria") || fullText.contains("servizio sanitario nazionale") || fullText.contains("health insurance card") || data.cardNumber != nil {
            if data.codiceFiscale != nil && (fullText.contains("cognome") || fullText.contains("nome")) {
                return "TESSERA_SANITARIA_FRONT"
            } else {
                return "TESSERA_SANITARIA_BACK"
            }
        }
        
        if fullText.contains("carta d'identita") || fullText.contains("repubblica italiana") || data.documentNumber != nil {
            if fullText.contains("cognome") && fullText.contains("nome") {
                return "CIE_FRONT"
            } else if fullText.contains("indirizzo") || fullText.contains("residenza") {
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
    
    private static func calculateCodiceFiscale(surname: String, name: String, dateOfBirth: String, gender: String, placeOfBirth: String) -> String? {
        // 1. Surname code (3 chars)
        let surnameCode = extractSurnameCode(surname)
        
        // 2. Name code (3 chars)
        let nameCode = extractNameCode(name)
        
        // 3. Birth Date code (5 chars)
        guard let dateCode = extractBirthDateCode(dateOfBirth: dateOfBirth, gender: gender) else {
            return nil
        }
        
        // 4. Belfiore code (4 chars)
        let cleanPob = placeOfBirth.replacingOccurrences(of: "\\s*\\([^)]*\\)", with: "", options: .regularExpression)
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
