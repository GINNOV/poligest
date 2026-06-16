import Foundation

struct Belfiore {
    private static let codes: [String: String] = loadCodes()

    private static func loadCodes() -> [String: String] {
        if let url = Bundle.main.url(forResource: "BelfioreCodes", withExtension: "json"),
           let data = try? Data(contentsOf: url),
           let dict = try? JSONDecoder().decode([String: String].self, from: data) {
            return dict
        }

        // Fallback for swiftc/verify.sh builds without a full app bundle.
        let candidates = [
            URL(fileURLWithPath: "BelfioreCodes.json"),
            URL(fileURLWithPath: FileManager.default.currentDirectoryPath).appendingPathComponent("BelfioreCodes.json"),
        ]
        for url in candidates {
            if let data = try? Data(contentsOf: url),
               let dict = try? JSONDecoder().decode([String: String].self, from: data) {
                return dict
            }
        }

        return [:]
    }

    private static func levenshteinDistance(_ s1: String, _ s2: String) -> Int {
        let empty = [Int](repeating: 0, count: s2.count + 1)
        var last = [Int](0...s2.count)

        for (i, char1) in s1.enumerated() {
            var cur = [i + 1] + empty.dropFirst()
            for (j, char2) in s2.enumerated() {
                cur[j + 1] = char1 == char2 ? last[j] : min(last[j + 1], cur[j], last[j]) + 1
            }
            last = cur
        }
        return last.last ?? 0
    }

    static func resolve(_ place: String) -> String? {
        let clean = place.uppercased().trimmingCharacters(in: .whitespacesAndNewlines)

        if let code = codes[clean] {
            return code
        }

        let alphaOnly = clean.replacingOccurrences(of: "[^A-Z]", with: "", options: .regularExpression)
        for (name, code) in codes {
            let nameAlpha = name.replacingOccurrences(of: "[^A-Z]", with: "", options: .regularExpression)
            if nameAlpha == alphaOnly {
                return code
            }
        }

        let maxDistance = clean.count > 6 ? 2 : 1
        var bestMatch: String?
        var bestDistance = Int.max

        for (name, code) in codes {
            if abs(clean.count - name.count) > maxDistance {
                continue
            }
            let dist = levenshteinDistance(clean, name)
            if dist <= maxDistance && dist < bestDistance {
                bestDistance = dist
                bestMatch = code
            }
        }

        return bestMatch
    }
}