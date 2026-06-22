import Foundation
import Combine

@MainActor
final class LiveScanController: ObservableObject {
    @Published private(set) var captureState: ScanCaptureState = .idle
    @Published private(set) var recognizedItems: [RecognizedItem] = []
    @Published private(set) var feedbackKey: String = "scan_status_waiting"
    @Published private(set) var countdownSeconds: Int?

    private var countdownTask: Task<Void, Never>?
    private var pendingCaptureData: IDData?
    private var readyStreak = 0
    private var emptyStreak = 0

    private let readyStreakRequired = 2
    private let emptyStreakToReset = 3
    private let emptyStreakToCancelCountdown = 4

    func processFrame(
        sortedItems: [RecognizedItem],
        autoCountdown: Bool,
        onScanSound: () -> Void,
        onCountdownBeep: @escaping () -> Void,
        onFinalize: @escaping (IDData) -> Void
    ) {
        guard captureState != .captured else { return }

        recognizedItems = sortedItems
        let parsed = ScanCaptureLogic.parseRecognizedItems(sortedItems)
        let hasText = !sortedItems.isEmpty
        let isReady = ScanCaptureLogic.shouldAcceptCapture(parsed)

        if captureState == .countdown {
            handleCountdownFrame(
                sortedItems: sortedItems,
                parsed: parsed,
                hasText: hasText,
                isReady: isReady,
                onCountdownBeep: onCountdownBeep,
                onFinalize: onFinalize
            )
            return
        }

        guard hasText else {
            readyStreak = 0
            emptyStreak += 1
            if emptyStreak >= emptyStreakToReset && captureState != .idle {
                captureState = .idle
            }
            feedbackKey = "scan_status_waiting"
            return
        }

        emptyStreak = 0

        if captureState == .idle {
            captureState = .scanning
        }

        if captureState == .scanning {
            onScanSound()
        }

        if isReady {
            readyStreak += 1
            feedbackKey = autoCountdown ? "scan_status_ready" : "scan_status_capturing"

            if autoCountdown {
                if readyStreak >= readyStreakRequired {
                    startCountdown(with: parsed, onCountdownBeep: onCountdownBeep, onFinalize: onFinalize)
                }
            } else {
                finalize(parsed, onFinalize: onFinalize)
            }
        } else {
            readyStreak = 0
            feedbackKey = ScanCaptureLogic.scanFeedbackKey(for: parsed, itemCount: sortedItems.count)
        }
    }

    private func handleCountdownFrame(
        sortedItems: [RecognizedItem],
        parsed: IDData,
        hasText: Bool,
        isReady: Bool,
        onCountdownBeep: () -> Void,
        onFinalize: (IDData) -> Void
    ) {
        guard hasText else {
            emptyStreak += 1
            if emptyStreak >= emptyStreakToCancelCountdown {
                cancelCountdown()
                feedbackKey = "scan_status_lost"
            } else {
                feedbackKey = "scan_status_hold"
            }
            return
        }

        emptyStreak = 0
        feedbackKey = "scan_status_countdown"

        if isReady {
            pendingCaptureData = parsed
        }
    }

    private func startCountdown(
        with parsed: IDData,
        onCountdownBeep: @escaping () -> Void,
        onFinalize: @escaping (IDData) -> Void
    ) {
        guard captureState == .scanning, countdownTask == nil else { return }

        pendingCaptureData = parsed
        captureState = .countdown
        countdownSeconds = 3
        feedbackKey = "scan_status_countdown"
        onCountdownBeep()

        countdownTask = Task {
            for remaining in stride(from: 2, through: 1, by: -1) {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                if Task.isCancelled { return }
                countdownSeconds = remaining
                onCountdownBeep()
            }

            try? await Task.sleep(nanoseconds: 1_000_000_000)
            if Task.isCancelled { return }

            guard captureState == .countdown, let pending = pendingCaptureData else { return }
            countdownTask = nil
            finalize(pending, onFinalize: onFinalize)
        }
    }

    private func finalize(_ parsed: IDData, onFinalize: (IDData) -> Void) {
        countdownTask?.cancel()
        countdownTask = nil
        countdownSeconds = nil
        pendingCaptureData = nil
        captureState = .captured
        feedbackKey = "scan_status_captured"
        onFinalize(parsed)
    }

    private func cancelCountdown() {
        countdownTask?.cancel()
        countdownTask = nil
        countdownSeconds = nil
        pendingCaptureData = nil
        readyStreak = 0
        captureState = .idle
    }

    func reset() {
        cancelCountdown()
        captureState = .idle
        recognizedItems = []
        emptyStreak = 0
        readyStreak = 0
        feedbackKey = "scan_status_waiting"
    }
}