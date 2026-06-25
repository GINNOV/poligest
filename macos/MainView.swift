import SwiftUI
import AVFoundation
import UniformTypeIdentifiers
import AppKit

final class FixtureConditionAccessoryPanel: NSView {
    let picker: NSPopUpButton
    private let targetPrefix: String
    private let targetValue: NSTextField

    init(targetTitle: String, conditionTitle: String, targetPrefix: String, picker: NSPopUpButton) {
        self.picker = picker
        self.targetPrefix = targetPrefix
        self.targetValue = NSTextField(labelWithString: "")
        super.init(frame: .zero)

        let targetLabel = NSTextField(labelWithString: targetTitle)
        targetLabel.alignment = .right
        targetValue.font = .monospacedSystemFont(ofSize: NSFont.systemFontSize, weight: .regular)

        let conditionLabel = NSTextField(labelWithString: conditionTitle)
        conditionLabel.alignment = .right

        let grid = NSGridView(views: [
            [targetLabel, targetValue],
            [conditionLabel, picker],
        ])
        grid.translatesAutoresizingMaskIntoConstraints = false
        grid.column(at: 0).xPlacement = .trailing
        grid.column(at: 1).xPlacement = .leading
        grid.rowSpacing = 8
        grid.columnSpacing = 8
        addSubview(grid)

        NSLayoutConstraint.activate([
            grid.leadingAnchor.constraint(equalTo: leadingAnchor),
            grid.trailingAnchor.constraint(equalTo: trailingAnchor),
            grid.topAnchor.constraint(equalTo: topAnchor),
            grid.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        picker.target = self
        picker.action = #selector(conditionChanged(_:))
        updateTargetValue()
    }

    required init?(coder: NSCoder) {
        nil
    }

    @objc private func conditionChanged(_ sender: NSPopUpButton) {
        updateTargetValue()
    }

    private func updateTargetValue() {
        let condition = picker.selectedItem?.title ?? ""
        targetValue.stringValue = [targetPrefix, condition]
            .filter { !$0.isEmpty }
            .joined(separator: " ")
    }
}

struct MainView: View {
    @StateObject private var cameraManager = CameraManager()
    @StateObject private var liveScan = LiveScanController()
    @StateObject private var statusBar = StatusBarController()
    @State private var scanMode: ScanMode = {
        guard !ScanIDLaunchConfiguration.isLaunchSmokeTest() else { return .image }
        let stored = UserDefaults.standard.string(forKey: "defaultScanMode") ?? "image"
        return stored == "camera" ? .camera : .image
    }()
    @State private var selectedImage: NSImage?
    @State private var capturedCameraImage: NSImage?
    @State private var capturedCameraOrientation: CameraSnapshotOrientationMetadata?
    @State private var cgImageForOCR: CGImage?
    @State private var recognizedItems: [RecognizedItem] = []
    @State private var recognizedBarcodes: [DetectedBarcode] = []
    @State private var parsedData: IDData = IDData(documentType: "UNKNOWN", rawText: [])
    @State private var isDragging = false
    @State private var copied = false
    @State private var animatingScanLine = false
    @State private var captureState: ScanCaptureState = .idle
    @State private var lastSoundTime: TimeInterval = 0
    
    // Web App Integration Settings
    @AppStorage("showJsonOptions") private var showJsonOptions = false
    @AppStorage("autoCreatePatient") private var autoCreatePatient = false
    @AppStorage("askConfirmation") private var askConfirmation = true
    @AppStorage("openInBrowser") private var openInBrowser = false
    @AppStorage("appLanguage") private var appLanguage = "en"
    @AppStorage("serverUrl") private var serverUrl = "https://sorrisosplendente.com"
    @AppStorage("apiToken") private var apiToken = "poligest_macos_secret"
    
    // Update checking
    @AppStorage("checkForUpdatesAutomatically") private var checkForUpdatesAutomatically = true
    @AppStorage("autoDownloadAndInstallUpdates") private var autoDownloadAndInstallUpdates = false
    @AppStorage("hasCompletedWelcomePrompt") private var hasCompletedWelcomePrompt = false
    @AppStorage("lastUpdateCheck") private var lastUpdateCheck: Double = 0
    @AppStorage("dismissedUpdateVersion") private var dismissedUpdateVersion = ""
    @AppStorage("autoCaptureCountdown") private var autoCaptureCountdown = false
    @AppStorage("requireCaptureApproval") private var requireCaptureApproval = false
    @AppStorage("detectOnlyExpectedFields") private var detectOnlyExpectedFields = true
    @AppStorage("autoZoomOnCapture") private var autoZoomOnCapture = ScanIDDefaults.autoZoomOnCapture
    @AppStorage("lastOCRFixtureExportDirectory") private var lastOCRFixtureExportDirectory = ""
    
    // Interactive UI State
    @State private var captureApproved = false
    @State private var showWelcomePrompt = false
    @State private var isShowingSettings = false
    @State private var showingConfirmationAlert = false
    @State private var pendingPatientToCreate: PendingPatient? = nil
    @State private var existingPatientId: String? = nil
    @State private var patientLookupGeneration = 0
    @State private var syncStatus: SyncStatus = .idle
    @State private var pendingUpdate: PendingUpdate? = nil
    @State private var isCheckingForUpdates = false
    @State private var didPerformStartupUpdateCheck = false
    
    // Update downloading state
    @State private var downloadProgress: Double = 0.0
    @State private var isDownloading = false
    @State private var downloadError: String? = nil
    @State private var downloadedFileUrl: URL? = nil
    @State private var downloader: UpdateDownloader? = nil
    @State private var installError: String? = nil
    
    @State private var captureZoomScale: CGFloat = 1.0
    @State private var captureZoomOffset: CGSize = .zero
    @State private var patientEmail = ""
    @State private var patientPhone = ""
    struct PendingPatient: Identifiable {
        let id = UUID()
        let firstName: String
        let lastName: String
        let birthDate: String?
        let gender: String?
        let codiceFiscale: String?
        let email: String?
        let phone: String?
        let existingPatientId: String?
        
        var isUpdate: Bool {
            existingPatientId != nil
        }
    }
    
    struct PendingUpdate: Identifiable {
        let id = UUID()
        let version: String
        let downloadUrl: String
        let notes: String?
    }
    
    enum SyncStatus: Equatable {
        case idle
        case syncing
        case success(patientId: String, isUpdate: Bool)
        case failure(error: String)
    }
    
    private var isUpdatingExistingPatient: Bool {
        existingPatientId != nil
    }
    
    private var showParsedResults: Bool {
        captureState == .captured
    }
    
    private var activeCameraPhase: ScanCaptureState {
        scanMode == .camera ? liveScan.captureState : .idle
    }
    
    private var isCameraFrozen: Bool {
        scanMode == .camera && captureState == .captured && capturedCameraImage != nil
    }

    private var canFreezeCameraFrame: Bool {
        scanMode == .camera && !isCameraFrozen && cameraManager.isRunning
    }
    
    private var showsZoomableCapture: Bool {
        isCameraFrozen || (scanMode == .image && selectedImage != nil)
    }

    private var currentFixtureImage: NSImage? {
        scanMode == .camera ? capturedCameraImage : selectedImage
    }
    
    private var isAwaitingCaptureApproval: Bool {
        requireCaptureApproval && !captureApproved && captureState != .captured
    }
    
    private var isCaptureDetectionActive: Bool {
        !requireCaptureApproval || captureApproved
    }

    private var installErrorPresentation: Binding<Bool> {
        Binding(
            get: { installError != nil },
            set: { isPresented in
                if !isPresented {
                    installError = nil
                }
            }
        )
    }
    
    private var liveDisplayedRecognizedItems: [RecognizedItem] {
        displayedRecognizedItems(from: liveScan.recognizedItems, parsed: ScanCaptureLogic.parseRecognizedItems(liveScan.recognizedItems))
    }
    
    private var capturedDisplayedRecognizedItems: [RecognizedItem] {
        displayedRecognizedItems(from: recognizedItems, parsed: parsedData)
    }
    
    var body: some View {
        mainWorkspace
            .toolbar { mainToolbar }
            .onAppear(perform: handleAppear)
            .onDisappear(perform: handleDisappear)
            .onChange(of: scanMode) { oldMode, newMode in
                handleScanModeChange(oldMode, newMode)
                syncMenuActions()
            }
            .onChange(of: appLanguage) { _, _ in syncMenuActions() }
            .onChange(of: captureZoomScale) { _, _ in syncMenuActions() }
            .onChange(of: captureZoomOffset) { _, _ in syncMenuActions() }
            .onChange(of: captureState) { _, _ in syncMenuActions() }
            .onChange(of: selectedImage) { _, _ in syncMenuActions() }
            .onChange(of: capturedCameraImage) { _, _ in syncMenuActions() }
            .onReceive(cameraManager.objectWillChange) { _ in syncMenuActionsSoon() }
            .onChange(of: autoCaptureCountdown) { _, _ in setupCameraFrameCallback() }
            .onChange(of: requireCaptureApproval) { _, _ in
                captureApproved = false
                liveScan.reset()
            }
            .onChange(of: syncStatus) { _, newValue in
                reflectSyncStatusInStatusBar(newValue)
            }
            .onChange(of: liveScan.feedbackKey) { _, newValue in
                reflectLiveScanInStatusBar(newValue)
            }
            .sheet(isPresented: $showWelcomePrompt) {
                WelcomePromptView(isPresented: $showWelcomePrompt, lang: appLanguage) {
                    startCameraSessionIfNeeded()
                    performStartupUpdateCheckIfNeeded()
                }
                .interactiveDismissDisabled()
            }
            .sheet(isPresented: $isShowingSettings) {
                SettingsView(isPresented: $isShowingSettings, pendingUpdate: $pendingUpdate)
            }
            .sheet(item: $pendingUpdate) { update in
                updateAvailableSheet(for: update)
            }
            .alert(
                Localization.string(key: "update_install_failed", lang: appLanguage),
                isPresented: installErrorPresentation
            ) {
                Button(Localization.string(key: "close", lang: appLanguage), role: .cancel) {
                    installError = nil
                }
            } message: {
                Text(installError ?? "")
            }
            .alert(
                Localization.string(
                    key: pendingPatientToCreate?.isUpdate == true ? "confirm_update_title" : "confirm_dialog_title",
                    lang: appLanguage
                ),
                isPresented: $showingConfirmationAlert,
                presenting: pendingPatientToCreate
            ) { details in
                confirmationAlertActions(for: details)
            } message: { details in
                confirmationAlertMessage(for: details)
            }
            .onExitCommand(perform: cancelActiveCapture)
    }
    
    private var mainWorkspace: some View {
        VStack(spacing: 0) {
        HSplitView {
            // Left Panel - Scanning Area
            VStack(spacing: 0) {
                ZStack {
                    Color(nsColor: .windowBackgroundColor)
                    
                    if scanMode == .camera {
                        if cameraManager.isPermissionDenied {
                            VStack(spacing: 12) {
                                Image(systemName: "camera.badge.ellipsis")
                                    .font(.system(size: 48))
                                    .foregroundColor(.red)
                                Text(Localization.string(key: "camera_denied", lang: appLanguage))
                                    .font(.headline)
                                Text(Localization.string(key: "camera_denied_desc", lang: appLanguage))
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                                    .multilineTextAlignment(.center)
                                    .padding(.horizontal, 40)
                            }
                        } else if isCameraFrozen, let frozenImage = capturedCameraImage {
                            frozenCameraCaptureView(frozenImage)
                        } else {
                            liveCameraScanView
                        }
                    } else {
                        // Image upload mode
                        ZStack {
                            if let selectedImage = selectedImage {
                                capturedImageWithOverlays(selectedImage)
                            } else {
                                VStack(spacing: 16) {
                                    Image(systemName: "doc.viewfinder")
                                        .font(.system(size: 64))
                                        .foregroundColor(isDragging ? .cyan : .secondary)
                                    Text(appLanguage == "it" ? "Trascina Qui l'Immagine del Documento" : "Drag and Drop Italian ID Card Image Here")
                                        .font(.headline)
                                    Text(appLanguage == "it" ? "Supporta PNG, JPEG, HEIC (Fronte o Retro)" : "Supports PNG, JPEG, HEIC (Front or Back)")
                                        .font(.subheadline)
                                        .foregroundColor(.secondary)
                                    
                                    Button(appLanguage == "it" ? "Sfoglia file..." : "Browse files...") {
                                        importImage()
                                    }
                                    .buttonStyle(.borderedProminent)
                                    .controlSize(.large)
                                }
                                .frame(maxWidth: .infinity, maxHeight: .infinity)
                                .background(RoundedRectangle(cornerRadius: 12)
                                    .strokeBorder(isDragging ? Color.cyan : Color.secondary.opacity(0.5), style: StrokeStyle(lineWidth: 2, lineCap: .round, dash: [8, 6])))
                                .padding(24)
                            }
                        }
                        .contentShape(Rectangle())
                        .onDrop(of: [.fileURL], isTargeted: $isDragging) { providers in
                            handleDrop(providers: providers)
                        }
                    }
                }
            }
            .frame(minWidth: 400, maxWidth: .infinity, minHeight: 400)
            
            // Right Panel - Parsed Data & JSON
            Group {
                if showParsedResults {
                    parsedResultsPanel
                } else {
                    emptyResultsPanel
                }
            }
            .frame(minWidth: 400, maxWidth: .infinity)
        }
        .frame(minWidth: 900, minHeight: 600)
        
        AppStatusBar(
            controller: statusBar,
            syncStatus: syncStatus,
            lang: appLanguage,
            serverUrl: serverUrl
        )
        }
    }
    
    @ToolbarContentBuilder
    private var mainToolbar: some ToolbarContent {
        ToolbarItem(placement: .navigation) {
            Picker(Localization.string(key: "scan_mode", lang: appLanguage), selection: $scanMode) {
                Label(Localization.string(key: "live_camera", lang: appLanguage), systemImage: "camera.fill").tag(ScanMode.camera)
                Label(Localization.string(key: "upload_image", lang: appLanguage), systemImage: "photo.on.rectangle.angled").tag(ScanMode.image)
            }
            .pickerStyle(.segmented)
            .frame(width: 250)
        }
        
        if showsZoomableCapture {
            ToolbarItemGroup(placement: .principal) {
                Button(action: zoomOutCapture) {
                    Image(systemName: "minus.magnifyingglass")
                }
                .help(Localization.string(key: "zoom_out", lang: appLanguage))
                .disabled(captureZoomScale <= 1.0)
                
                Text("\(Int(round(captureZoomScale * 100)))%")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
                    .frame(width: 44)
                
                Button(action: zoomInCapture) {
                    Image(systemName: "plus.magnifyingglass")
                }
                .help(Localization.string(key: "zoom_in", lang: appLanguage))
                .disabled(captureZoomScale >= 6.0)
                
                Button(action: resetCaptureZoom) {
                    Image(systemName: "arrow.up.left.and.arrow.down.right")
                }
                .help(Localization.string(key: "zoom_reset", lang: appLanguage))
                .disabled(captureZoomScale <= 1.0 && captureZoomOffset == .zero)
            }
        }
        
        if scanMode == .camera && !isCameraFrozen {
            if !cameraManager.devices.isEmpty {
                ToolbarItem(placement: .navigation) {
                    CameraDevicePicker(cameraManager: cameraManager, lang: appLanguage)
                }
            }
            
        }
        
        ToolbarItemGroup(placement: .primaryAction) {
            if scanMode == .image {
                Button(action: pasteFromClipboard) {
                    Label(Localization.string(key: "paste_image", lang: appLanguage), systemImage: "doc.on.clipboard")
                }
                .help(Localization.string(key: "paste_image", lang: appLanguage))
            }
            
            if scanMode == .camera {
                Button(action: freezeCurrentCameraFrameForFixture) {
                    Label(Localization.string(key: "freeze_camera_frame", lang: appLanguage), systemImage: "camera.aperture")
                }
                .help(Localization.string(key: "freeze_camera_frame_help", lang: appLanguage))
                .disabled(!canFreezeCameraFrame)

                Button(action: startNewCameraScan) {
                    Label(Localization.string(key: "new_scan", lang: appLanguage), systemImage: "doc.text.viewfinder")
                }
                .help(Localization.string(key: "new_scan_help", lang: appLanguage))
            } else {
                Button(action: startNewImageImport) {
                    Label(Localization.string(key: "new_image", lang: appLanguage), systemImage: "photo.badge.plus")
                }
                .help(Localization.string(key: "new_image_help", lang: appLanguage))
            }
            
            Button(action: { isShowingSettings = true }) {
                Label(Localization.string(key: "settings", lang: appLanguage), systemImage: "gearshape")
            }
            .help(Localization.string(key: "settings", lang: appLanguage))
            .keyboardShortcut(",", modifiers: .command)
        }
    }
    
    private func wireMenuActions() {
        let menu = ScanMenuActions.shared
        menu.onScanModeSelected = { scanMode = $0 }
        menu.onNewCameraScan = startNewCameraScan
        menu.onNewImageImport = startNewImageImport
        menu.onPasteImage = pasteFromClipboard
        menu.onFreezeCameraFrame = freezeCurrentCameraFrameForFixture
        menu.onExportFixture = exportOCRFixture
        menu.onZoomIn = zoomInCapture
        menu.onZoomOut = zoomOutCapture
        menu.onResetZoom = resetCaptureZoom
        menu.onSelectCamera = { id in
            guard let device = cameraManager.devices.first(where: { $0.uniqueID == id }) else { return }
            cameraManager.changeCamera(to: device)
        }
        menu.onOpenSettings = { isShowingSettings = true }
    }

    private func syncMenuActions() {
        ScanMenuActions.shared.update(
            language: appLanguage,
            scanMode: scanMode,
            showsZoomableCapture: showsZoomableCapture,
            captureZoomScale: captureZoomScale,
            captureZoomOffset: captureZoomOffset,
            canExportFixture: currentFixtureImage != nil,
            canFreezeCameraFrame: canFreezeCameraFrame,
            showsCameraPicker: scanMode == .camera && !isCameraFrozen && !cameraManager.devices.isEmpty,
            devices: cameraManager.devices,
            selectedDevice: cameraManager.selectedDevice
        )
    }

    private func syncMenuActionsSoon() {
        DispatchQueue.main.async {
            self.syncMenuActions()
        }
    }

    private func handleAppear() {
        wireMenuActions()
        syncMenuActions()
        guard !ScanIDLaunchConfiguration.isLaunchSmokeTest() else {
            statusBar.showIdle()
            return
        }
        if serverUrl == "http://localhost:3000" {
            serverUrl = "https://sorrisosplendente.com"
        }
        setupCameraFrameCallback()
        statusBar.showIdle()
        
        if lastUpdateCheck > 0 {
            hasCompletedWelcomePrompt = true
        }
        
        if !hasCompletedWelcomePrompt {
            showWelcomePrompt = true
            return
        }
        
        startCameraSessionIfNeeded()
        performStartupUpdateCheckIfNeeded()
    }
    
    private func startCameraSessionIfNeeded() {
        guard scanMode == .camera else { return }
        cameraManager.startSession()
        if cameraManager.isPermissionDenied {
            statusBar.show(key: "camera_denied", style: .error, autoDismiss: nil)
        }
    }
    
    private func performStartupUpdateCheckIfNeeded() {
        guard !didPerformStartupUpdateCheck else { return }
        didPerformStartupUpdateCheck = true
        guard checkForUpdatesAutomatically else { return }
        checkForUpdates(silent: false)
    }
    
    private func shouldPromptForUpdate(version: String, forcePrompt: Bool) -> Bool {
        if forcePrompt { return true }
        guard !dismissedUpdateVersion.isEmpty else { return true }
        return isNewerVersion(version, than: dismissedUpdateVersion)
    }
    
    private func presentUpdateIfNeeded(_ update: PendingUpdate, silent: Bool, forcePrompt: Bool = false) {
        guard shouldPromptForUpdate(version: update.version, forcePrompt: forcePrompt) else { return }
        guard isNewerVersion(update.version, than: currentVersion) else { return }
        
        pendingUpdate = update
        
        if autoDownloadAndInstallUpdates,
           let downloadURL = URL(string: update.downloadUrl) {
            startUpdateDownload(url: downloadURL)
        }
    }
    
    private func handleDisappear() {
        liveScan.reset()
        cameraManager.stopSession()
    }
    
    private func handleScanModeChange(_ oldMode: ScanMode, _ newMode: ScanMode) {
        resetAllStateOnly()
        if newMode == .camera {
            cameraManager.startSession()
        } else {
            cameraManager.stopSession()
            statusBar.showIdle()
        }
    }
    
    private func reportScanComplete() {
        statusBar.show(key: "status_scan_complete", style: .success, autoDismiss: 6)
    }
    
    @ViewBuilder
    private func updateAvailableSheet(for update: PendingUpdate) -> some View {
        UpdateAvailableSheet(
            update: update,
            appLanguage: appLanguage,
            isDownloading: isDownloading,
            downloadProgress: downloadProgress,
            downloadError: downloadError,
            installError: installError,
            downloadedFileUrl: downloadedFileUrl,
            onDownload: {
                if let url = URL(string: update.downloadUrl) {
                    startUpdateDownload(url: url)
                }
            },
            onInstall: {
                installDownloadedUpdate()
            },
            onLater: {
                if let version = pendingUpdate?.version {
                    dismissedUpdateVersion = version
                }
                downloader?.cancel()
                isDownloading = false
                downloadProgress = 0.0
                downloadError = nil
                installError = nil
                downloadedFileUrl = nil
                downloader = nil
                pendingUpdate = nil
            }
        )
    }
    
    private func installDownloadedUpdate() {
        guard let fileUrl = downloadedFileUrl else {
            installError = Localization.string(key: "update_install_missing_file", lang: appLanguage)
            return
        }
        
        installError = nil
        
        do {
            try UpdateInstaller.launchInstall(downloadedFile: fileUrl)
        } catch {
            installError = error.localizedDescription
            return
        }
        
        pendingUpdate = nil
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
            NSApp.terminate(nil)
        }
    }
    
    @ViewBuilder
    private func confirmationAlertActions(for details: PendingPatient) -> some View {
        Button(Localization.string(
            key: details.isUpdate ? "update" : "create",
            lang: appLanguage
        )) {
            triggerPatientSync(
                firstName: details.firstName,
                lastName: details.lastName,
                birthDate: details.birthDate,
                gender: details.gender,
                codiceFiscale: details.codiceFiscale,
                email: details.email,
                phone: details.phone,
                existingPatientId: details.existingPatientId
            )
        }
        Button(Localization.string(key: "cancel", lang: appLanguage), role: .cancel) {
            pendingPatientToCreate = nil
        }
    }
    
    private func confirmationAlertMessage(for details: PendingPatient) -> Text {
        Text(String(
            format: Localization.string(
                key: details.isUpdate ? "confirm_update_body" : "confirm_dialog_body",
                lang: appLanguage
            ),
            details.firstName,
            details.lastName
        ))
    }
    
    // MARK: - Subviews
    
    @ViewBuilder
    private var liveCameraScanView: some View {
        ZStack {
            CameraPreviewView(cameraManager: cameraManager)
            
            DocumentGuideOverlay(lang: appLanguage)
                .padding(24)
            
            GeometryReader { _ in
                ForEach(liveDisplayedRecognizedItems) { item in
                    if let rect = cameraManager.previewRect(forNormalizedBoundingBox: item.boundingBox) {
                        boundingBoxMenu(for: item, rect: rect)
                            .position(x: rect.midX, y: rect.midY)
                    }
                }
            }
            
            if liveScan.captureState == .countdown, let seconds = liveScan.countdownSeconds {
                CountdownOverlay(seconds: seconds, lang: appLanguage)
            }
            
            if isAwaitingCaptureApproval {
                CaptureApprovalOverlay(lang: appLanguage, onStart: approveCaptureStart)
            }
            
            if isCaptureDetectionActive && (liveScan.captureState == .scanning || liveScan.captureState == .countdown) {
                GeometryReader { geo in
                    let h = geo.size.height
                    Color.cyan.opacity(0.3)
                        .frame(height: 3)
                        .shadow(color: .cyan, radius: 8, x: 0, y: 0)
                        .offset(y: animatingScanLine ? 0 : h)
                        .animation(
                            Animation.easeInOut(duration: 2.5)
                                .repeatForever(autoreverses: true),
                            value: animatingScanLine
                        )
                }
                .onAppear {
                    animatingScanLine = true
                }
                .onDisappear {
                    animatingScanLine = false
                }
            }
        }
        .aspectRatio(16.0 / 9.0, contentMode: .fit)
        .cornerRadius(12)
        .padding(12)
    }
    
    @ViewBuilder
    private func frozenCameraCaptureView(_ image: NSImage) -> some View {
        capturedImageWithOverlays(image)
    }
    
    @ViewBuilder
    private func capturedImageWithOverlays(_ image: NSImage) -> some View {
        ZoomableImageWrapper(scale: $captureZoomScale, offset: $captureZoomOffset) {
            Image(nsImage: image)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .overlay {
                    boundingBoxesOverlay(for: image)
                }
        }
        .cornerRadius(12)
        .padding(12)
    }
    
    @ViewBuilder
    private func boundingBoxesOverlay(for image: NSImage) -> some View {
        GeometryReader { geo in
            let contentRect = fitRect(for: image.size, in: geo.size)
            ForEach(capturedDisplayedRecognizedItems) { item in
                let rect = mapBoundingBox(item.boundingBox, to: contentRect.size)
                boundingBoxMenu(for: item, rect: rect)
                    .position(x: rect.midX + contentRect.origin.x, y: rect.midY + contentRect.origin.y)
            }
        }
    }
    
    private func displayedRecognizedItems(from items: [RecognizedItem], parsed: IDData) -> [RecognizedItem] {
        guard detectOnlyExpectedFields else { return items }
        return CaptureDetection.filterItems(items, matching: parsed)
    }
    
    private func resetCaptureZoom() {
        captureZoomScale = 1.0
        captureZoomOffset = .zero
    }
    
    private func zoomInCapture() {
        captureZoomScale = min(captureZoomScale * 1.25, 6.0)
    }
    
    private func zoomOutCapture() {
        captureZoomScale = max(captureZoomScale / 1.25, 1.0)
        if captureZoomScale <= 1.0 {
            captureZoomOffset = .zero
        }
    }
    
    @ViewBuilder
    private var emptyResultsPanel: some View {
        if scanMode == .camera && captureState != .captured {
            cameraInstructionsPanel
        } else if scanMode == .image {
            imageImportInstructionsPanel
        } else {
            awaitingScanPanel
        }
    }
    
    private var imageImportInstructionsPanel: some View {
        VStack(spacing: 0) {
            ScrollView {
                ImageImportHelpContent(lang: appLanguage, style: .prominent)
                    .padding(24)
            }
            
            Divider()
            
            HStack(spacing: 12) {
                Button(action: pasteFromClipboard) {
                    Label(Localization.string(key: "paste_image", lang: appLanguage), systemImage: "doc.on.clipboard")
                }
                .buttonStyle(.bordered)
                
                Button(action: importImage) {
                    Label(Localization.string(key: "select_file", lang: appLanguage), systemImage: "folder")
                }
                .buttonStyle(.borderedProminent)
            }
            .padding(16)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(nsColor: .windowBackgroundColor))
    }
    
    private var cameraInstructionsPanel: some View {
        VStack(spacing: 0) {
            ScrollView {
                ContinuityCameraHelpContent(lang: appLanguage, style: .prominent)
                    .padding(24)
            }
            
            Divider()
            
            if isAwaitingCaptureApproval {
                liveScanStatusBanner(
                    icon: "hand.tap",
                    iconColor: .cyan,
                    titleKey: "capture_approval_title",
                    messageKey: "capture_approval_body"
                )
            } else {
                liveScanStatusBanner(
                    icon: scanFeedbackIcon(for: liveScan.feedbackKey),
                    iconColor: scanFeedbackColor(for: liveScan.feedbackKey),
                    titleKey: scanStatusTitleKey(for: liveScan.feedbackKey),
                    messageKey: liveScan.feedbackKey,
                    hintKey: autoCaptureCountdown && liveScan.captureState == .scanning
                        ? "scan_status_countdown_hint"
                        : nil
                )
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(nsColor: .windowBackgroundColor))
    }
    
    private var awaitingScanPanel: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "doc.text.magnifyingglass")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text(Localization.string(key: "awaiting_scan_title", lang: appLanguage))
                .font(.headline)
            Text(Localization.string(key: "awaiting_scan_body", lang: appLanguage))
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(nsColor: .windowBackgroundColor))
    }
    
    private func liveScanStatusBanner(
        icon: String,
        iconColor: Color,
        titleKey: String,
        messageKey: String,
        hintKey: String? = nil
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 10) {
                Image(systemName: icon)
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(iconColor)
                    .frame(width: 28)
                
                Text(Localization.string(key: titleKey, lang: appLanguage))
                    .font(.headline)
                    .foregroundStyle(.primary)
            }
            
            Text(Localization.string(key: messageKey, lang: appLanguage))
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            
            if let hintKey {
                Text(Localization.string(key: hintKey, lang: appLanguage))
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
        .background(Color(nsColor: .controlBackgroundColor))
    }
    
    private func scanStatusTitleKey(for feedbackKey: String) -> String {
        switch feedbackKey {
        case "scan_status_ready", "scan_status_countdown":
            return "scan_status_title_ready"
        case "scan_status_waiting":
            return "scan_status_title_waiting"
        default:
            return "scan_status_title_adjust"
        }
    }
    
    private func scanFeedbackIcon(for feedbackKey: String) -> String {
        switch feedbackKey {
        case "scan_status_ready", "scan_status_countdown":
            return "checkmark.circle"
        case "scan_status_waiting":
            return "viewfinder"
        default:
            return "viewfinder.circle"
        }
    }
    
    private func scanFeedbackColor(for feedbackKey: String) -> Color {
        switch feedbackKey {
        case "scan_status_ready", "scan_status_countdown":
            return .green
        case "scan_status_waiting":
            return .secondary
        default:
            return .orange
        }
    }
    
    @ViewBuilder
    private var parsedResultsPanel: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(Localization.string(key: "detected_data", lang: appLanguage))
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundColor(.secondary)
                    
                    HStack(spacing: 8) {
                        Text(parsedData.documentType.replacingOccurrences(of: "_", with: " "))
                            .font(.headline)
                            .foregroundColor(.primary)
                        
                        badgeView(for: parsedData.documentType)
                    }
                }
                
                Spacer()
                
                if showJsonOptions {
                    HStack(spacing: 8) {
                        Button(action: copyJSON) {
                            Label(copied ? Localization.string(key: "copied", lang: appLanguage) : Localization.string(key: "copy_json", lang: appLanguage), systemImage: copied ? "checkmark" : "doc.on.doc")
                        }
                        .buttonStyle(.bordered)
                        
                        Button(action: saveJSON) {
                            Label(appLanguage == "it" ? "Salva File..." : "Save File...", systemImage: "square.and.arrow.down")
                        }
                        .buttonStyle(.borderedProminent)
                    }
                }
            }
            .padding()
            .background(VisualEffectView(material: .headerView, blendingMode: .withinWindow))
            
            Divider()
            
            ScrollView {
                VStack(spacing: 20) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(Localization.string(key: "fields", lang: appLanguage))
                            .font(.headline)
                            .padding(.horizontal)
                        
                        VStack(spacing: 0) {
                            EditableFieldRow(
                                label: Localization.string(key: "field_surname", lang: appLanguage),
                                text: optionalStringBinding(\.surname),
                                icon: "person.text.rectangle",
                                onCommit: { handleParsedFieldCommit(recalculateCF: true, refreshLookup: true) }
                            )
                            EditableFieldRow(
                                label: Localization.string(key: "field_name", lang: appLanguage),
                                text: optionalStringBinding(\.name),
                                icon: "person",
                                onCommit: { handleParsedFieldCommit(recalculateCF: true, refreshLookup: true) }
                            )
                            EditableFieldRow(
                                label: Localization.string(key: "field_cf", lang: appLanguage),
                                text: optionalStringBinding(\.codiceFiscale),
                                icon: "number.square",
                                highlight: true,
                                onCommit: { handleParsedFieldCommit(refreshLookup: true) }
                            )
                            EditableFieldRow(
                                label: Localization.string(key: "field_doc_num", lang: appLanguage),
                                text: optionalStringBinding(\.documentNumber),
                                icon: "doc.text.fill",
                                onCommit: { handleParsedFieldCommit() }
                            )
                            EditableFieldRow(
                                label: Localization.string(key: "field_dob", lang: appLanguage),
                                text: optionalStringBinding(\.dateOfBirth),
                                icon: "calendar",
                                onCommit: { handleParsedFieldCommit(recalculateCF: true, refreshLookup: true) }
                            )
                            EditableFieldRow(
                                label: Localization.string(key: "field_pob", lang: appLanguage),
                                text: optionalStringBinding(\.placeOfBirth),
                                icon: "mappin.and.ellipse",
                                onCommit: { handleParsedFieldCommit(recalculateCF: true, refreshLookup: true) }
                            )
                            EditableFieldRow(
                                label: Localization.string(key: "field_sex", lang: appLanguage),
                                text: optionalStringBinding(\.gender),
                                icon: "figure.male.female",
                                onCommit: { handleParsedFieldCommit(recalculateCF: true, refreshLookup: true) }
                            )
                            EditableFieldRow(
                                label: Localization.string(key: "field_expiry", lang: appLanguage),
                                text: optionalStringBinding(\.expiryDate),
                                icon: "calendar.badge.exclamationmark",
                                onCommit: { handleParsedFieldCommit() }
                            )
                            EditableFieldRow(
                                label: Localization.string(key: "field_nationality", lang: appLanguage),
                                text: optionalStringBinding(\.nationality),
                                icon: "globe",
                                onCommit: { handleParsedFieldCommit() }
                            )
                            if parsedData.cardNumber != nil || parsedData.documentType.contains("TESSERA") {
                                EditableFieldRow(
                                    label: Localization.string(key: "field_card_num", lang: appLanguage),
                                    text: optionalStringBinding(\.cardNumber),
                                    icon: "creditcard",
                                    onCommit: { handleParsedFieldCommit() }
                                )
                            }
                        }
                        .background(Color(nsColor: .controlBackgroundColor))
                        .cornerRadius(8)
                        .padding(.horizontal)
                    }
                    .padding(.top)
                    
                    if parsedData.documentType != "UNKNOWN" {
                        VStack(alignment: .leading, spacing: 10) {
                            Text(Localization.string(key: "contact_fields", lang: appLanguage))
                                .font(.headline)
                                .padding(.horizontal)
                            
                            VStack(spacing: 0) {
                                EditableFieldRow(
                                    label: Localization.string(key: "field_email", lang: appLanguage),
                                    text: patientEmailBinding,
                                    icon: "envelope",
                                    onCommit: { handleContactFieldCommit() }
                                )
                                EditableFieldRow(
                                    label: Localization.string(key: "field_phone", lang: appLanguage),
                                    text: patientPhoneBinding,
                                    icon: "phone",
                                    onCommit: { handleContactFieldCommit() }
                                )
                            }
                            .background(Color(nsColor: .controlBackgroundColor))
                            .cornerRadius(8)
                            .padding(.horizontal)
                        }
                    }
                    
                    if parsedData.documentType != "UNKNOWN" {
                        switch syncStatus {
                        case .success(let patientId, let isUpdate):
                            PatientRecordSuccessCard(
                                isUpdate: isUpdate,
                                patientId: patientId,
                                patientName: [parsedData.surname, parsedData.name]
                                    .compactMap { $0 }
                                    .filter { !$0.isEmpty }
                                    .joined(separator: " "),
                                serverUrl: serverUrl,
                                lang: appLanguage,
                                onOpen: { openPatientRecord(patientId: patientId) }
                            )
                            .padding(.horizontal)
                        case .syncing:
                            HStack(spacing: 10) {
                                ProgressView()
                                    .controlSize(.small)
                                Text(Localization.string(
                                    key: isUpdatingExistingPatient ? "sync_progress_update" : "sync_progress_create",
                                    lang: appLanguage
                                ))
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal)
                        default:
                            Button(action: {
                                self.beginPatientSync()
                            }) {
                                Label(
                                    Localization.string(
                                        key: isUpdatingExistingPatient ? "sync_update_button" : "sync_create_button",
                                        lang: appLanguage
                                    ),
                                    systemImage: isUpdatingExistingPatient ? "person.crop.circle.badge.checkmark" : "person.badge.plus"
                                )
                                .padding(.vertical, 4)
                            }
                            .buttonStyle(.borderedProminent)
                            .controlSize(.large)
                            .padding(.horizontal)
                        }
                    }
                    
                    if showJsonOptions {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(Localization.string(key: "json_output", lang: appLanguage))
                                .font(.headline)
                                .padding(.horizontal)
                            
                            ZStack(alignment: .topTrailing) {
                                TextEditor(text: .constant(jsonString))
                                    .font(.system(.body, design: .monospaced))
                                    .foregroundColor(Color(nsColor: .textColor))
                                    .padding(8)
                                    .frame(height: 250)
                                    .background(Color(nsColor: .textBackgroundColor))
                                    .cornerRadius(8)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(Color.secondary.opacity(0.3), lineWidth: 1)
                                    )
                            }
                            .padding(.horizontal)
                        }
                        
                        if !parsedData.rawText.isEmpty {
                            VStack(alignment: .leading, spacing: 8) {
                                DisclosureGroup("\(Localization.string(key: "raw_ocr", lang: appLanguage)) (\(parsedData.rawText.count) lines)") {
                                    VStack(alignment: .leading, spacing: 4) {
                                        ForEach(parsedData.rawText.indices, id: \.self) { idx in
                                            Text("[\(idx)]: \(parsedData.rawText[idx])")
                                                .font(.system(.footnote, design: .monospaced))
                                                .foregroundColor(.secondary)
                                                .frame(maxWidth: .infinity, alignment: .leading)
                                                .padding(.vertical, 2)
                                                .background(idx % 2 == 0 ? Color.secondary.opacity(0.05) : Color.clear)
                                        }
                                    }
                                    .padding(.vertical, 8)
                                }
                                .padding(.horizontal)
                            }
                        }
                    }
                }
                .padding(.bottom, 20)
            }
        }
    }
    
    private func reflectSyncStatusInStatusBar(_ status: SyncStatus) {
        switch status {
        case .idle:
            if scanMode == .camera && captureState != .captured {
                reflectLiveScanInStatusBar(liveScan.feedbackKey)
            } else {
                statusBar.showIdle()
            }
        case .syncing:
            statusBar.show(
                key: isUpdatingExistingPatient ? "sync_progress_update" : "sync_progress_create",
                style: .progress,
                autoDismiss: nil
            )
        case .success(_, let isUpdate):
            statusBar.show(
                key: isUpdate ? "sync_success_update" : "sync_success_create",
                style: .success,
                autoDismiss: 8
            )
        case .failure(let error):
            statusBar.show(
                key: "status_sync_failed",
                style: .error,
                args: [error],
                autoDismiss: nil
            )
        }
    }
    
    private func reflectLiveScanInStatusBar(_ feedbackKey: String) {
        guard scanMode == .camera, captureState != .captured else { return }
        guard case .idle = syncStatus else { return }
        
        let style: StatusBarController.Style
        switch feedbackKey {
        case "scan_status_ready", "scan_status_countdown":
            style = .success
        case "scan_status_waiting":
            style = .idle
        default:
            style = .info
        }
        statusBar.show(key: feedbackKey, style: style, autoDismiss: nil)
    }
    
    // MARK: - Helpers & Data Processing
    
    private var jsonString: String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        if let data = try? encoder.encode(parsedData) {
            return String(data: data, encoding: .utf8) ?? "{}"
        }
        return "{}"
    }
    
    private func approveCaptureStart() {
        captureApproved = true
        liveScan.reset()
        statusBar.show(key: "status_camera_ready", style: .info, autoDismiss: 3)
    }
    
    private func finalizeCameraCapture() {
        capturedCameraOrientation = cameraManager.snapshotOrientationMetadata()
        let fallbackSnapshot = cameraManager.snapshotImage()
        capturedCameraImage = fallbackSnapshot
        resetCaptureZoom()
        statusBar.show(key: "scan_status_capturing", style: .info, autoDismiss: nil)

        let fallbackItems = liveScan.recognizedItems
        let fallbackParsed = ScanCaptureLogic.parseRecognizedItems(fallbackItems)

        cameraManager.captureStillImage { stillImage in
            self.cameraManager.stopSession()

            let image = stillImage ?? fallbackSnapshot
            guard let image,
                  let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
                self.applyCapturedScanResults(items: fallbackItems, parsed: fallbackParsed)
                return
            }
            self.capturedCameraImage = image
            let frameQuality = IDScanner.assessFrameQuality(cgImage)

            let completeCapture = { (displayImage: NSImage, items: [RecognizedItem], barcodes: [DetectedBarcode], parsed: IDData) in
                self.capturedCameraImage = displayImage
                if ScanCaptureLogic.shouldAcceptCapture(parsed, items: items, frameQuality: frameQuality) {
                    self.applyCapturedScanResults(items: items, barcodes: barcodes, parsed: parsed)
                } else {
                    self.recognizedItems = items
                    self.recognizedBarcodes = barcodes
                    self.parsedData = parsed
                    self.captureState = .idle
                    self.statusBar.show(key: "status_scan_unreadable", style: .warning, autoDismiss: 6)
                    self.liveScan.reset()
                }
            }

            ScanCaptureLogic.recognizeTextWithOptionalAutoCrop(
                image: image,
                cgImage: cgImage,
                autoCrop: autoZoomOnCapture,
                boundsItems: [],
                fallbackItems: fallbackItems,
                fallbackParsed: fallbackParsed,
                completion: completeCapture
            )
        }
    }

    private func freezeCurrentCameraFrameForFixture() {
        capturedCameraOrientation = cameraManager.snapshotOrientationMetadata()
        capturedCameraImage = cameraManager.snapshotImage()
        cameraManager.stopSession()
        resetCaptureZoom()

        let fallbackItems = liveScan.recognizedItems
        let fallbackParsed = ScanCaptureLogic.parseRecognizedItems(fallbackItems)

        guard let image = capturedCameraImage,
              let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
            statusBar.show(key: "status_camera_frame_unavailable", style: .warning, autoDismiss: 4)
            return
        }

        let applyFrozenFrame = { (displayImage: NSImage, items: [RecognizedItem], barcodes: [DetectedBarcode], parsed: IDData) in
            self.capturedCameraImage = displayImage
            self.recognizedItems = items
            self.recognizedBarcodes = barcodes
            self.parsedData = parsed
            self.captureState = .captured
            self.liveScan.reset()
            self.syncMenuActionsSoon()
            self.statusBar.show(key: "status_camera_frame_frozen", style: .warning, autoDismiss: 6)
        }

        ScanCaptureLogic.recognizeTextWithOptionalAutoCrop(
            image: image,
            cgImage: cgImage,
            autoCrop: autoZoomOnCapture,
            boundsItems: fallbackItems,
            fallbackItems: fallbackItems,
            fallbackParsed: fallbackParsed,
            completion: applyFrozenFrame
        )
    }
    
    private func applyCapturedScanResults(items: [RecognizedItem], barcodes: [DetectedBarcode] = [], parsed: IDData) {
        recognizedItems = items
        recognizedBarcodes = barcodes
        parsedData = parsed
        captureState = .captured
        syncMenuActionsSoon()
        reportScanComplete()
        playSuccessSound()
        refreshPatientLookup(for: parsed, autoSyncAfterLookup: autoCreatePatient)
    }
    
    private func setupCameraFrameCallback() {
        cameraManager.onFrameCaptured = { pixelBuffer in
            guard self.scanMode == .camera else { return }
            guard self.isCaptureDetectionActive else { return }
            guard self.captureState != .captured, self.liveScan.captureState != .captured else { return }
            let frameQuality = IDScanner.assessFrameQuality(pixelBuffer)
            
            IDScanner.recognizeTextInLiveBuffer(
                pixelBuffer,
                orientation: self.cameraManager.ocrVisionOrientation
            ) { items in
                let sortedItems = ScanCaptureLogic.sortedRecognizedItems(items)
                
                self.liveScan.processFrame(
                    sortedItems: sortedItems,
                    frameQuality: frameQuality,
                    autoCountdown: UserDefaults.standard.bool(forKey: "autoCaptureCountdown"),
                    onScanSound: { self.playSubtleScanSound() },
                    onCountdownBeep: { self.playCountdownBeep() },
                    onFinalize: { _ in
                        self.finalizeCameraCapture()
                    }
                )
            }
        }
    }
    
    private func clearParsedResults() {
        liveScan.reset()
        parsedData = IDData(documentType: "UNKNOWN", rawText: [])
        recognizedItems = []
        captureState = .idle
        syncStatus = .idle
        pendingPatientToCreate = nil
        existingPatientId = nil
        patientEmail = ""
        patientPhone = ""
        patientLookupGeneration += 1
        statusBar.showIdle()
    }
    
    private func processStaticImage(_ nsImage: NSImage) {
        guard let cgImage = nsImage.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
            statusBar.show(key: "status_image_load_failed", style: .error, autoDismiss: 6)
            return
        }
        clearParsedResults()
        resetCaptureZoom()
        let frameQuality = IDScanner.assessFrameQuality(cgImage)
        
        let emptyFallback = IDData(documentType: "UNKNOWN", rawText: [])
        let applyStaticResults = { (displayImage: NSImage, items: [RecognizedItem], barcodes: [DetectedBarcode], parsed: IDData) in
            self.selectedImage = displayImage
            self.cgImageForOCR = displayImage.cgImage(forProposedRect: nil, context: nil, hints: nil)
            self.recognizedItems = items
            self.recognizedBarcodes = barcodes
            
            if ScanCaptureLogic.shouldAcceptCapture(parsed, items: items, frameQuality: frameQuality) {
                self.parsedData = parsed
                self.captureState = .captured
                self.syncMenuActionsSoon()
                self.reportScanComplete()
                self.playSuccessSound()
                self.refreshPatientLookup(for: parsed, autoSyncAfterLookup: self.autoCreatePatient)
            } else {
                self.statusBar.show(key: "status_scan_unreadable", style: .warning, autoDismiss: 6)
            }
        }
        
        ScanCaptureLogic.recognizeTextWithOptionalAutoCrop(
            image: nsImage,
            cgImage: cgImage,
            autoCrop: autoZoomOnCapture,
            boundsItems: [],
            fallbackItems: [],
            fallbackParsed: emptyFallback,
            completion: applyStaticResults
        )
    }
    
    private func resetAllStateOnly() {
        selectedImage = nil
        capturedCameraImage = nil
        capturedCameraOrientation = nil
        cgImageForOCR = nil
        recognizedBarcodes = []
        isDragging = false
        copied = false
        captureApproved = false
        resetCaptureZoom()
        cameraManager.clearSnapshotBuffer()
        clearParsedResults()
        syncMenuActionsSoon()
    }
    
    private func startNewImageImport() {
        resetAllStateOnly()
        guard scanMode == .image else { return }
        statusBar.show(key: "status_import_ready", style: .info, autoDismiss: 3)
    }
    
    private func startNewCameraScan() {
        resetAllStateOnly()
        guard scanMode == .camera else { return }
        
        statusBar.show(key: "status_camera_ready", style: .info, autoDismiss: 3)
        cameraManager.restartSession()
    }
    
    private func cancelActiveCapture() {
        guard scanMode == .camera else { return }
        guard !showWelcomePrompt, !isShowingSettings, pendingUpdate == nil, !showingConfirmationAlert else { return }
        
        if captureState == .captured {
            startNewCameraScan()
            return
        }
        
        guard isCaptureDetectionActive else { return }
        
        switch liveScan.captureState {
        case .scanning, .countdown:
            liveScan.reset()
            statusBar.show(key: "status_capture_cancelled", style: .info, autoDismiss: 3)
        case .idle, .captured:
            if requireCaptureApproval && captureApproved {
                captureApproved = false
                liveScan.reset()
                statusBar.showIdle()
            }
        }
    }
    
    // MARK: - Auditory Feedback Helpers
    
    private func playSubtleScanSound() {
        let now = ProcessInfo.processInfo.systemUptime
        guard now - lastSoundTime >= 0.8 else { return }
        lastSoundTime = now
        
        DispatchQueue.main.async {
            if let sound = NSSound(named: "Tink") {
                sound.volume = 0.12
                sound.play()
            }
        }
    }
    
    private func playSuccessSound() {
        DispatchQueue.main.async {
            if let sound = NSSound(named: "Glass") {
                sound.volume = 0.6
                sound.play()
            }
        }
    }
    
    private func playCountdownBeep() {
        CountdownSound.play()
    }
    
    // MARK: - Parsed Field Editing
    
    private func optionalStringBinding(_ keyPath: WritableKeyPath<IDData, String?>) -> Binding<String> {
        Binding(
            get: { parsedData[keyPath: keyPath] ?? "" },
            set: { newValue in
                parsedData[keyPath: keyPath] = newValue.isEmpty ? nil : newValue
                if case .success = syncStatus {
                    syncStatus = .idle
                }
            }
        )
    }
    
    private func handleParsedFieldCommit(recalculateCF: Bool = false, refreshLookup: Bool = false) {
        if recalculateCF {
            parsedData.calculateCodiceFiscaleIfPossible()
        }
        if refreshLookup {
            refreshPatientLookup(for: parsedData)
        }
    }
    
    private var patientEmailBinding: Binding<String> {
        Binding(
            get: { patientEmail },
            set: { newValue in
                patientEmail = newValue
                if case .success = syncStatus {
                    syncStatus = .idle
                }
            }
        )
    }
    
    private var patientPhoneBinding: Binding<String> {
        Binding(
            get: { patientPhone },
            set: { newValue in
                patientPhone = newValue
                if case .success = syncStatus {
                    syncStatus = .idle
                }
            }
        )
    }
    
    private func handleContactFieldCommit() {
        if case .success = syncStatus {
            syncStatus = .idle
        }
    }
    
    private func optionalContactValue(_ value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
    
    // MARK: - Sync API Calls
    
    private func beginPatientSync() {
        parsedData.calculateCodiceFiscaleIfPossible()
        
        let fName = parsedData.name ?? "Sconosciuto"
        let lName = parsedData.surname ?? "Sconosciuto"
        
        if askConfirmation {
            pendingPatientToCreate = PendingPatient(
                firstName: fName,
                lastName: lName,
                birthDate: parsedData.dateOfBirth,
                gender: parsedData.gender,
                codiceFiscale: parsedData.codiceFiscale,
                email: optionalContactValue(patientEmail),
                phone: optionalContactValue(patientPhone),
                existingPatientId: existingPatientId
            )
            showingConfirmationAlert = true
        } else {
            triggerPatientSync(
                firstName: fName,
                lastName: lName,
                birthDate: parsedData.dateOfBirth,
                gender: parsedData.gender,
                codiceFiscale: parsedData.codiceFiscale,
                email: optionalContactValue(patientEmail),
                phone: optionalContactValue(patientPhone),
                existingPatientId: existingPatientId
            )
        }
    }
    
    private func refreshPatientLookup(for parsed: IDData, autoSyncAfterLookup: Bool = false) {
        guard parsed.documentType != "UNKNOWN" else {
            existingPatientId = nil
            return
        }
        
        let firstName = parsed.name ?? ""
        let lastName = parsed.surname ?? ""
        guard !firstName.isEmpty || !lastName.isEmpty || parsed.codiceFiscale != nil else {
            existingPatientId = nil
            return
        }
        
        patientLookupGeneration += 1
        let generation = patientLookupGeneration
        
        lookupExistingPatient(
            firstName: firstName.isEmpty ? "Sconosciuto" : firstName,
            lastName: lastName.isEmpty ? "Sconosciuto" : lastName,
            birthDate: parsed.dateOfBirth,
            codiceFiscale: parsed.codiceFiscale
        ) { result in
            DispatchQueue.main.async {
                guard generation == self.patientLookupGeneration else { return }
                switch result {
                case .success(let patientId):
                    self.existingPatientId = patientId
                case .failure:
                    self.existingPatientId = nil
                }
                
                if autoSyncAfterLookup && self.autoCreatePatient {
                    self.beginPatientSync()
                }
            }
        }
    }
    
    private func patientRecordURL(patientId: String) -> URL? {
        URL(string: "\(serverUrl)/pazienti/\(patientId)")
    }
    
    private func openPatientRecord(patientId: String) {
        guard let url = patientRecordURL(patientId: patientId) else { return }
        NSWorkspace.shared.open(url)
    }
    
    private func triggerPatientSync(
        firstName: String,
        lastName: String,
        birthDate: String?,
        gender: String?,
        codiceFiscale: String?,
        email: String?,
        phone: String?,
        existingPatientId: String?
    ) {
        self.syncStatus = .syncing
        
        syncPatientInWebApp(
            firstName: firstName,
            lastName: lastName,
            birthDate: birthDate,
            gender: gender,
            codiceFiscale: codiceFiscale,
            email: email,
            phone: phone,
            existingPatientId: existingPatientId
        ) { result in
            DispatchQueue.main.async {
                switch result {
                case .success(let syncResult):
                    self.syncStatus = .success(patientId: syncResult.patientId, isUpdate: syncResult.isUpdate)
                    
                    if self.openInBrowser {
                        self.openPatientRecord(patientId: syncResult.patientId)
                    }
                case .failure(let error):
                    self.syncStatus = .failure(error: error.localizedDescription)
                }
            }
        }
    }
    
    private func lookupExistingPatient(
        firstName: String,
        lastName: String,
        birthDate: String?,
        codiceFiscale: String?,
        completion: @escaping (Result<String?, Error>) -> Void
    ) {
        let urlString = "\(serverUrl)/api/patients/lookup"
        guard let url = URL(string: urlString) else {
            completion(.failure(NSError(domain: "Invalid URL", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid server URL. Check your Preferences."])))
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiToken, forHTTPHeaderField: "x-api-key")
        
        let body: [String: Any?] = [
            "firstName": firstName,
            "lastName": lastName,
            "birthDate": birthDate,
            "codiceFiscale": codiceFiscale
        ]
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body, options: [])
        } catch {
            completion(.failure(error))
            return
        }
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse else {
                completion(.failure(NSError(domain: "Invalid response", code: 500, userInfo: [NSLocalizedDescriptionKey: "Invalid server response"])))
                return
            }
            
            guard (200...299).contains(httpResponse.statusCode) else {
                let errorMsg = data.flatMap { String(data: $0, encoding: .utf8) } ?? "HTTP \(httpResponse.statusCode)"
                completion(.failure(NSError(domain: "HTTP Error", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: "Server returned error: \(errorMsg)"])))
                return
            }
            
            guard let data = data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                completion(.failure(NSError(domain: "Invalid JSON", code: 500, userInfo: [NSLocalizedDescriptionKey: "Invalid lookup response"])))
                return
            }
            
            if json["exists"] as? Bool == true, let patientId = json["patientId"] as? String {
                completion(.success(patientId))
            } else {
                completion(.success(nil))
            }
        }.resume()
    }
    
    private func syncPatientInWebApp(
        firstName: String,
        lastName: String,
        birthDate: String?,
        gender: String?,
        codiceFiscale: String?,
        email: String?,
        phone: String?,
        existingPatientId: String?,
        completion: @escaping (Result<(patientId: String, isUpdate: Bool), Error>) -> Void
    ) {
        if let existingPatientId {
            updatePatientInWebApp(
                patientId: existingPatientId,
                birthDate: birthDate,
                gender: gender,
                codiceFiscale: codiceFiscale,
                completion: completion
            )
        } else {
            createPatientInWebApp(
                firstName: firstName,
                lastName: lastName,
                birthDate: birthDate,
                gender: gender,
                codiceFiscale: codiceFiscale,
                email: email,
                phone: phone
            ) { result in
                switch result {
                case .success(let patientId):
                    completion(.success((patientId: patientId, isUpdate: false)))
                case .failure(let error):
                    completion(.failure(error))
                }
            }
        }
    }
    
    private func updatePatientInWebApp(
        patientId: String,
        birthDate: String?,
        gender: String?,
        codiceFiscale: String?,
        completion: @escaping (Result<(patientId: String, isUpdate: Bool), Error>) -> Void
    ) {
        let urlString = "\(serverUrl)/api/patients/\(patientId)"
        guard let url = URL(string: urlString) else {
            completion(.failure(NSError(domain: "Invalid URL", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid server URL. Check your Preferences."])))
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiToken, forHTTPHeaderField: "x-api-key")
        
        let body: [String: Any?] = [
            "birthDate": birthDate,
            "gender": gender,
            "codiceFiscale": codiceFiscale
        ]
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body, options: [])
        } catch {
            completion(.failure(error))
            return
        }
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse else {
                completion(.failure(NSError(domain: "Invalid response", code: 500, userInfo: [NSLocalizedDescriptionKey: "Invalid server response"])))
                return
            }
            
            guard (200...299).contains(httpResponse.statusCode) else {
                let errorMsg = data.flatMap { String(data: $0, encoding: .utf8) } ?? "HTTP \(httpResponse.statusCode)"
                completion(.failure(NSError(domain: "HTTP Error", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: "Server returned error: \(errorMsg)"])))
                return
            }
            
            guard let data = data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let returnedPatientId = json["patientId"] as? String else {
                completion(.failure(NSError(domain: "Invalid JSON", code: 500, userInfo: [NSLocalizedDescriptionKey: "Invalid JSON response structure"])))
                return
            }
            
            completion(.success((patientId: returnedPatientId, isUpdate: true)))
        }.resume()
    }
    
    private func createPatientInWebApp(
        firstName: String,
        lastName: String,
        birthDate: String?,
        gender: String?,
        codiceFiscale: String?,
        email: String?,
        phone: String?,
        completion: @escaping (Result<String, Error>) -> Void
    ) {
        let urlString = "\(serverUrl)/api/patients"
        guard let url = URL(string: urlString) else {
            completion(.failure(NSError(domain: "Invalid URL", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid server URL. Check your Preferences."])))
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiToken, forHTTPHeaderField: "x-api-key")
        
        var notes = ""
        if let cf = codiceFiscale {
            notes += "Codice Fiscale: \(cf)\n"
        }
        notes += "Acquisito automaticamente da ID Scanner macOS"
        
        let body: [String: Any?] = [
            "firstName": firstName,
            "lastName": lastName,
            "email": email,
            "phone": phone,
            "birthDate": birthDate,
            "gender": gender,
            "notes": notes
        ]
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body, options: [])
        } catch {
            completion(.failure(error))
            return
        }
        
        let task = URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse else {
                completion(.failure(NSError(domain: "Invalid response", code: 500, userInfo: [NSLocalizedDescriptionKey: "Invalid server response"])))
                return
            }
            
            guard (200...299).contains(httpResponse.statusCode) else {
                let errorMsg = data.flatMap { String(data: $0, encoding: .utf8) } ?? "HTTP \(httpResponse.statusCode)"
                completion(.failure(NSError(domain: "HTTP Error", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: "Server returned error: \(errorMsg)"])))
                return
            }
            
            guard let data = data else {
                completion(.failure(NSError(domain: "No data", code: 500, userInfo: [NSLocalizedDescriptionKey: "No data returned from server"])))
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any],
                   let patientId = json["patientId"] as? String {
                    completion(.success(patientId))
                } else {
                    completion(.failure(NSError(domain: "Invalid JSON", code: 500, userInfo: [NSLocalizedDescriptionKey: "Invalid JSON response structure"])))
                }
            } catch {
                completion(.failure(error))
            }
        }
        task.resume()
    }
    
    // MARK: - Version & Updates (reuses serverUrl + apiToken + URLSession pattern from patient creation)
    
    private var currentVersion: String {
        (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String) ?? "1.0"
    }
    
    private func isNewerVersion(_ remote: String, than local: String) -> Bool {
        let r = remote.split(separator: ".").compactMap { Int($0) }
        let l = local.split(separator: ".").compactMap { Int($0) }
        let maxCount = max(r.count, l.count)
        for i in 0..<maxCount {
            let rv = i < r.count ? r[i] : 0
            let lv = i < l.count ? l[i] : 0
            if rv > lv { return true }
            if rv < lv { return false }
        }
        return false
    }
    
    private func checkForUpdates(silent: Bool = false, forcePrompt: Bool = false) {
        guard !isCheckingForUpdates else { return }
        isCheckingForUpdates = true
        
        let base = serverUrl.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let url = URL(string: "\(base)/api/scanid/meta") else {
            isCheckingForUpdates = false
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        // Send token if configured (harmless for public meta endpoint)
        if !apiToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            request.setValue(apiToken, forHTTPHeaderField: "x-api-key")
        }
        
        let task = URLSession.shared.dataTask(with: request) { data, response, error in
            // Always bounce to main to touch @State. MainView is a struct so we capture
            // a copy of self at the moment the task was created (sufficient for this use).
            DispatchQueue.main.async {
                self.isCheckingForUpdates = false
                self.lastUpdateCheck = Date().timeIntervalSince1970
            }
            
            if error != nil {
                if !silent { /* graceful: ignore for background checks */ }
                return
            }
            guard let data = data else { return }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let remoteVersion = json["version"] as? String,
                   let downloadUrl = json["downloadUrl"] as? String {
                    
                    let local = self.currentVersion
                    if self.isNewerVersion(remoteVersion, than: local) {
                        DispatchQueue.main.async {
                            let update = PendingUpdate(
                                version: remoteVersion,
                                downloadUrl: downloadUrl,
                                notes: json["notes"] as? String
                            )
                            self.presentUpdateIfNeeded(update, silent: silent, forcePrompt: forcePrompt)
                        }
                    } else if !silent {
                        // Up to date
                    }
                }
            } catch {
                if !silent { /* ignore parse errors silently for now */ }
            }
        }
        task.resume()
    }
    
    private func startUpdateDownload(url: URL) {
        isDownloading = true
        downloadProgress = 0.0
        downloadError = nil
        installError = nil
        downloadedFileUrl = nil
        
        let dl = UpdateDownloader()
        dl.onProgress = { progress in
            self.downloadProgress = progress
        }
        dl.onCompletion = { localUrl, error in
            self.isDownloading = false
            self.downloader = nil
            if let error = error {
                self.downloadError = error.localizedDescription
            } else if let localUrl = localUrl {
                self.downloadedFileUrl = localUrl
                if self.autoDownloadAndInstallUpdates {
                    self.installDownloadedUpdate()
                }
            }
        }
        self.downloader = dl
        dl.startDownload(url: url)
    }
    
    // MARK: - Import / Actions
    
    private func importImage() {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.canChooseFiles = true
        panel.allowedContentTypes = [.image]
        
        if panel.runModal() == .OK, let url = panel.url {
            if let image = NSImage(contentsOf: url) {
                processStaticImage(image)
            } else {
                statusBar.show(key: "status_image_load_failed", style: .error, autoDismiss: 6)
            }
        }
    }
    
    private func pasteFromClipboard() {
        let pasteboard = NSPasteboard.general
        if let image = imageFromPasteboard(pasteboard) {
            processStaticImage(image)
            statusBar.show(key: "status_image_pasted", style: .success, autoDismiss: 3)
        } else {
            statusBar.show(key: "status_paste_failed", style: .warning, autoDismiss: 8)
        }
    }
    
    private func imageFromPasteboard(_ pasteboard: NSPasteboard) -> NSImage? {
        if let image = NSImage(pasteboard: pasteboard) {
            return image
        }
        
        if let urls = pasteboard.readObjects(forClasses: [NSURL.self], options: [
            .urlReadingFileURLsOnly: true
        ]) as? [URL] {
            for url in urls {
                if let image = NSImage(contentsOf: url) {
                    return image
                }
            }
        }
        
        let imageTypes: [NSPasteboard.PasteboardType] = [.png, .tiff]
        for type in imageTypes {
            if let data = pasteboard.data(forType: type), let image = NSImage(data: data) {
                return image
            }
        }
        
        return nil
    }
    
    private func handleDrop(providers: [NSItemProvider]) -> Bool {
        guard let provider = providers.first else {
            statusBar.show(key: "status_drop_failed", style: .warning, autoDismiss: 5)
            return false
        }
        
        provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { item, error in
            DispatchQueue.main.async {
                guard let data = item as? Data,
                      let url = URL(dataRepresentation: data, relativeTo: nil),
                      let image = NSImage(contentsOf: url) else {
                    self.statusBar.show(key: "status_drop_failed", style: .warning, autoDismiss: 5)
                    return
                }
                self.processStaticImage(image)
                self.statusBar.show(key: "status_image_dropped", style: .success, autoDismiss: 3)
            }
        }
        return true
    }
    
    private func copyJSON() {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(jsonString, forType: .string)
        copied = true
        statusBar.show(key: "status_json_copied", style: .success, autoDismiss: 2)
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            copied = false
        }
    }
    
    private func saveJSON() {
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.json]
        let name = parsedData.codiceFiscale ?? "scanned_id"
        panel.nameFieldStringValue = "\(name).json"
        
        if panel.runModal() == .OK, let url = panel.url {
            try? jsonString.write(to: url, atomically: true, encoding: .utf8)
        }
    }

    private struct FixtureExportManifest: Encodable {
        let fixtures: [FixtureExportEntry]
    }

    private struct FixtureExportEntry: Encodable {
        let name: String
        let image: String
        let expect: String
        let quality: String
        let ocrProvider: String
        let captureSource: String
        let documentSide: String
        let condition: String
        let matrixTarget: String
        let orientation: FixtureExportOrientation?
        let diagnostics: FixtureExportDiagnostics
        let observed: FixtureExportFields
        let observedItems: [FixtureExportRecognizedItem]
        let observedBarcodes: [FixtureExportBarcode]
        let expected: FixtureExportExpected?
    }

    private struct FixtureExportOrientation: Encodable {
        let ocrVisionOrientation: String
        let snapshotDisplayOrientation: String
        let basePreviewRotationAngle: Double
        let scanPreviewRotationAngle: Double
        let baseCaptureRotationAngle: Double
        let scanCaptureRotationAngle: Double
        let rawImageWidth: Int?
        let rawImageHeight: Int?
        let imageWidth: Int
        let imageHeight: Int
    }

    private struct FixtureExportDiagnostics: Encodable {
        let frameQuality: String
        let frameQualityMetrics: FixtureExportFrameQualityMetrics
        let canCapture: Bool
        let canGuideLiveScan: Bool
        let score: Int
        let markerCount: Int
        let itemCount: Int
        let missingFrontNames: Bool
        let reasons: [String]
    }

    private struct FixtureExportFrameQualityMetrics: Encodable {
        let sharpness: Double
        let glareRatio: Double
        let darkRatio: Double
        let meanLuma: Double
        let usable: Bool
        let failureReasons: [String]
    }

    private struct FixtureExportExpected: Encodable {
        let documentType: String
        let surname: String?
        let name: String?
        let codiceFiscale: String?
        let documentNumber: String?
        let dateOfBirth: String?
        let placeOfBirth: String?
        let gender: String?
        let expiryDate: String?
        let nationality: String?
        let cardNumber: String?

        private enum CodingKeys: String, CodingKey {
            case documentType
            case surname
            case name
            case codiceFiscale
            case documentNumber
            case dateOfBirth
            case placeOfBirth
            case gender
            case expiryDate
            case nationality
            case cardNumber
        }

        func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(documentType, forKey: .documentType)
            try Self.encodeNullable(surname, forKey: .surname, into: &container)
            try Self.encodeNullable(name, forKey: .name, into: &container)
            try Self.encodeNullable(codiceFiscale, forKey: .codiceFiscale, into: &container)
            try Self.encodeNullable(documentNumber, forKey: .documentNumber, into: &container)
            try Self.encodeNullable(dateOfBirth, forKey: .dateOfBirth, into: &container)
            try Self.encodeNullable(placeOfBirth, forKey: .placeOfBirth, into: &container)
            try Self.encodeNullable(gender, forKey: .gender, into: &container)
            try Self.encodeNullable(expiryDate, forKey: .expiryDate, into: &container)
            try Self.encodeNullable(nationality, forKey: .nationality, into: &container)
            try Self.encodeNullable(cardNumber, forKey: .cardNumber, into: &container)
        }

        private static func encodeNullable(
            _ value: String?,
            forKey key: CodingKeys,
            into container: inout KeyedEncodingContainer<CodingKeys>
        ) throws {
            if let value {
                try container.encode(value, forKey: key)
            } else {
                try container.encodeNil(forKey: key)
            }
        }
    }

    private struct FixtureExportFields: Encodable {
        let documentType: String
        let surname: String?
        let name: String?
        let codiceFiscale: String?
        let documentNumber: String?
        let dateOfBirth: String?
        let placeOfBirth: String?
        let gender: String?
        let expiryDate: String?
        let nationality: String?
        let cardNumber: String?

        private enum CodingKeys: String, CodingKey {
            case documentType
            case surname
            case name
            case codiceFiscale
            case documentNumber
            case dateOfBirth
            case placeOfBirth
            case gender
            case expiryDate
            case nationality
            case cardNumber
        }

        func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(documentType, forKey: .documentType)
            try Self.encodeNullable(surname, forKey: .surname, into: &container)
            try Self.encodeNullable(name, forKey: .name, into: &container)
            try Self.encodeNullable(codiceFiscale, forKey: .codiceFiscale, into: &container)
            try Self.encodeNullable(documentNumber, forKey: .documentNumber, into: &container)
            try Self.encodeNullable(dateOfBirth, forKey: .dateOfBirth, into: &container)
            try Self.encodeNullable(placeOfBirth, forKey: .placeOfBirth, into: &container)
            try Self.encodeNullable(gender, forKey: .gender, into: &container)
            try Self.encodeNullable(expiryDate, forKey: .expiryDate, into: &container)
            try Self.encodeNullable(nationality, forKey: .nationality, into: &container)
            try Self.encodeNullable(cardNumber, forKey: .cardNumber, into: &container)
        }

        private static func encodeNullable(
            _ value: String?,
            forKey key: CodingKeys,
            into container: inout KeyedEncodingContainer<CodingKeys>
        ) throws {
            if let value {
                try container.encode(value, forKey: key)
            } else {
                try container.encodeNil(forKey: key)
            }
        }
    }

    private struct FixtureExportRecognizedItem: Encodable {
        let text: String
        let confidence: Float
        let boundingBox: FixtureExportBoundingBox
        let imageBounds: FixtureExportImageBounds
    }

    private struct FixtureExportBarcode: Encodable {
        let payload: String
        let confidence: Float
        let boundingBox: FixtureExportBoundingBox
        let imageBounds: FixtureExportImageBounds
    }

    private struct FixtureExportBoundingBox: Encodable {
        let x: Double
        let y: Double
        let width: Double
        let height: Double
    }

    private struct FixtureExportImageBounds: Encodable {
        let x: Double
        let y: Double
        let width: Double
        let height: Double
    }

    private func exportOCRFixture() {
        guard let image = currentFixtureImage,
              let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
            statusBar.show(
                key: "status_fixture_export_failed",
                style: .error,
                args: [Localization.string(key: "status_image_load_failed", lang: appLanguage)],
                autoDismiss: 6
            )
            return
        }

        let quality = IDScanner.assessFrameQuality(cgImage)
        let readiness = ScanCaptureLogic.captureReadiness(parsed: parsedData, items: recognizedItems, frameQuality: quality)
        let accepted = readiness.canCapture
        let defaultCondition = ScanCaptureLogic.fixtureConditionLabel(
            accepted: accepted,
            readiness: readiness,
            frameQuality: quality
        )
        let conditionPicker = fixtureConditionPicker(defaultCondition: defaultCondition, accepted: accepted)

        let panel = NSOpenPanel()
        panel.title = Localization.string(key: "export_ocr_fixture", lang: appLanguage)
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.canCreateDirectories = true
        panel.allowsMultipleSelection = false
        panel.accessoryView = fixtureConditionAccessoryView(picker: conditionPicker, accepted: accepted)
        panel.directoryURL = fixtureExportDirectoryURL()

        guard panel.runModal() == .OK, let rootURL = panel.url else { return }
        lastOCRFixtureExportDirectory = rootURL.path

        let selectedCondition = conditionPicker.selectedItem?.title ?? defaultCondition
        let timestamp = Self.fixtureTimestampFormatter.string(from: Date())
        let baseName = fixtureBaseName(timestamp: timestamp)
        let exportURL = rootURL.appendingPathComponent(baseName, isDirectory: true)
        let imageName = "\(baseName).png"
        let imageURL = exportURL.appendingPathComponent(imageName)
        let manifestURL = exportURL.appendingPathComponent("manifest.json")
        let readmeURL = exportURL.appendingPathComponent("README.md")
        let matrixTarget = fixtureCollectionTarget(accepted: accepted, condition: selectedCondition)

        do {
            try FileManager.default.createDirectory(at: exportURL, withIntermediateDirectories: true)
            guard let pngData = pngData(from: cgImage) else {
                throw CocoaError(.fileWriteUnknown)
            }
            try pngData.write(to: imageURL, options: .atomic)
            let manifest = FixtureExportManifest(fixtures: [
                fixtureExportEntry(
                    name: baseName,
                    imageName: imageName,
                    cgImage: cgImage,
                    condition: selectedCondition,
                    matrixTarget: matrixTarget
                )
            ])
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            let data = try encoder.encode(manifest)
            try data.write(to: manifestURL, options: .atomic)
            try fixtureExportReadme(
                exportURL: exportURL,
                matrixTarget: matrixTarget
            ).write(to: readmeURL, atomically: true, encoding: .utf8)
            statusBar.show(
                key: "status_fixture_exported",
                style: .success,
                args: [matrixTarget],
                autoDismiss: 6
            )
            if scanMode == .camera {
                startNewCameraScan()
            } else {
                syncMenuActionsSoon()
            }
        } catch {
            statusBar.show(key: "status_fixture_export_failed", style: .error, args: [error.localizedDescription], autoDismiss: nil)
            syncMenuActionsSoon()
        }
    }

    private func fixtureExportDirectoryURL() -> URL? {
        let path = lastOCRFixtureExportDirectory.trimmingCharacters(in: .whitespacesAndNewlines)
        if let rememberedURL = fixtureDirectoryURL(path: path, createIfNeeded: false) {
            return rememberedURL
        }
        let defaultPath = ProcessInfo.processInfo.environment["SCANID_OCR_EXPORTS_DIR"]?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return fixtureDirectoryURL(path: defaultPath, createIfNeeded: true)
    }

    private func fixtureDirectoryURL(path: String, createIfNeeded: Bool) -> URL? {
        guard !path.isEmpty else { return nil }
        if createIfNeeded {
            try? FileManager.default.createDirectory(
                at: URL(fileURLWithPath: path, isDirectory: true),
                withIntermediateDirectories: true
            )
        }
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: path, isDirectory: &isDirectory),
              isDirectory.boolValue else {
            return nil
        }
        return URL(fileURLWithPath: path, isDirectory: true)
    }

    private func fixtureConditionPicker(defaultCondition: String, accepted: Bool) -> NSPopUpButton {
        let picker = NSPopUpButton(frame: .zero, pullsDown: false)
        picker.addItems(withTitles: ScanCaptureLogic.fixtureConditionChoices(accepted: accepted))
        picker.selectItem(withTitle: defaultCondition)
        if picker.selectedItem == nil {
            picker.selectItem(withTitle: accepted ? "good" : "non-document")
        }
        return picker
    }

    private func fixtureConditionAccessoryView(picker: NSPopUpButton, accepted: Bool) -> NSView {
        FixtureConditionAccessoryPanel(
            targetTitle: Localization.string(key: "fixture_target", lang: appLanguage),
            conditionTitle: Localization.string(key: "fixture_condition", lang: appLanguage),
            targetPrefix: fixtureCollectionTargetPrefix(accepted: accepted),
            picker: picker
        )
    }

    private static let fixtureTimestampFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyyMMdd-HHmmss"
        return formatter
    }()

    private func fixtureBaseName(timestamp: String) -> String {
        let identifier = parsedData.codiceFiscale
            ?? parsedData.documentNumber
            ?? parsedData.cardNumber
            ?? parsedData.documentType
        let sanitized = identifier
            .lowercased()
            .replacingOccurrences(of: "[^a-z0-9]+", with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
        return ["scanid", timestamp, sanitized.isEmpty ? "fixture" : sanitized]
            .joined(separator: "-")
    }

    private func pngData(from cgImage: CGImage) -> Data? {
        let bitmap = NSBitmapImageRep(cgImage: cgImage)
        return bitmap.representation(using: .png, properties: [:])
    }

    private func fixtureExportEntry(
        name: String,
        imageName: String,
        cgImage: CGImage,
        condition: String,
        matrixTarget: String
    ) -> FixtureExportEntry {
        let quality = IDScanner.assessFrameQuality(cgImage)
        let readiness = ScanCaptureLogic.captureReadiness(parsed: parsedData, items: recognizedItems, frameQuality: quality)
        let accepted = readiness.canCapture
        return FixtureExportEntry(
            name: name,
            image: imageName,
            expect: accepted ? "accept" : "reject",
            quality: quality.isUsableForCapture ? "usable" : "unusable",
            ocrProvider: OCRProvider.vision.name,
            captureSource: fixtureCaptureSource(),
            documentSide: fixtureDocumentSide(accepted: accepted),
            condition: condition,
            matrixTarget: matrixTarget,
            orientation: fixtureOrientation(cgImage: cgImage),
            diagnostics: fixtureDiagnostics(readiness: readiness, frameQuality: quality),
            observed: fixtureObservedFields(),
            observedItems: fixtureObservedItems(imageSize: CGSize(width: cgImage.width, height: cgImage.height)),
            observedBarcodes: fixtureObservedBarcodes(imageSize: CGSize(width: cgImage.width, height: cgImage.height)),
            expected: accepted ? fixtureExpectedFields() : nil
        )
    }

    private func fixtureExportReadme(exportURL: URL, matrixTarget: String) -> String {
        """
        # ScanID OCR Fixture Export

        Matrix target: \(matrixTarget)

        From the repository root, import this fixture into the current strict
        matrix slot:

        ```bash
        ./script/collect_ocr_fixture.sh --export-dir "\(exportURL.path)"
        ```

        To preflight without importing, add `--dry-run`:

        ```bash
        ./script/collect_ocr_fixture.sh --dry-run --export-dir "\(exportURL.path)"
        ```

        If this fixture was exported into the repository `exports/` folder, the
        newest export can be preflighted without copying its timestamped path:

        ```bash
        ./script/collect_ocr_fixture.sh --latest-export --expect-target "\(matrixTarget)" --dry-run
        ```

        To inspect this export before importing it, run:

        ```bash
        ./script/ocr_fixture_matrix.sh --fixtures-dir "\(exportURL.deletingLastPathComponent().path)" --next
        ```

        Then check remaining coverage with:

        ```bash
        ./script/ocr_fixture_matrix.sh
        ```

        Capture the next target printed by `./script/collect_ocr_fixture.sh`.
        Do not hand-edit `matrixTarget`; if this target is wrong, re-export the
        sample from ScanID with the correct source, side, and condition.

        Use only test, generated, or redacted identity data in committed fixtures.
        """
    }

    private func fixtureObservedFields() -> FixtureExportFields {
        FixtureExportFields(
            documentType: parsedData.documentType,
            surname: parsedData.surname,
            name: parsedData.name,
            codiceFiscale: parsedData.codiceFiscale,
            documentNumber: parsedData.documentNumber,
            dateOfBirth: parsedData.dateOfBirth,
            placeOfBirth: parsedData.placeOfBirth,
            gender: parsedData.gender,
            expiryDate: parsedData.expiryDate,
            nationality: parsedData.nationality,
            cardNumber: parsedData.cardNumber
        )
    }

    private func fixtureExpectedFields() -> FixtureExportExpected {
        FixtureExportExpected(
            documentType: parsedData.documentType,
            surname: parsedData.surname,
            name: parsedData.name,
            codiceFiscale: parsedData.codiceFiscale,
            documentNumber: parsedData.documentNumber,
            dateOfBirth: parsedData.dateOfBirth,
            placeOfBirth: parsedData.placeOfBirth,
            gender: parsedData.gender,
            expiryDate: parsedData.expiryDate,
            nationality: parsedData.nationality,
            cardNumber: parsedData.cardNumber
        )
    }

    private func fixtureObservedItems(imageSize: CGSize) -> [FixtureExportRecognizedItem] {
        recognizedItems.map { item in
            let boundingBox = clampedFixtureBoundingBox(item.boundingBox)
            let imageBounds = fixtureImageBounds(for: boundingBox, imageSize: imageSize)
            return FixtureExportRecognizedItem(
                text: item.text,
                confidence: item.confidence,
                boundingBox: FixtureExportBoundingBox(
                    x: Double(boundingBox.origin.x),
                    y: Double(boundingBox.origin.y),
                    width: Double(boundingBox.width),
                    height: Double(boundingBox.height)
                ),
                imageBounds: FixtureExportImageBounds(
                    x: Double(imageBounds.origin.x),
                    y: Double(imageBounds.origin.y),
                    width: Double(imageBounds.width),
                    height: Double(imageBounds.height)
                )
            )
        }
    }

    private func fixtureObservedBarcodes(imageSize: CGSize) -> [FixtureExportBarcode] {
        recognizedBarcodes.map { barcode in
            let boundingBox = clampedFixtureBoundingBox(barcode.boundingBox)
            let imageBounds = fixtureImageBounds(for: boundingBox, imageSize: imageSize)
            return FixtureExportBarcode(
                payload: barcode.payload,
                confidence: barcode.confidence,
                boundingBox: FixtureExportBoundingBox(
                    x: Double(boundingBox.origin.x),
                    y: Double(boundingBox.origin.y),
                    width: Double(boundingBox.width),
                    height: Double(boundingBox.height)
                ),
                imageBounds: FixtureExportImageBounds(
                    x: Double(imageBounds.origin.x),
                    y: Double(imageBounds.origin.y),
                    width: Double(imageBounds.width),
                    height: Double(imageBounds.height)
                )
            )
        }
    }

    private func clampedFixtureBoundingBox(_ boundingBox: CGRect) -> CGRect {
        let minX = min(max(boundingBox.minX, 0), 1)
        let minY = min(max(boundingBox.minY, 0), 1)
        let maxX = min(max(boundingBox.maxX, minX), 1)
        let maxY = min(max(boundingBox.maxY, minY), 1)
        return CGRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY)
    }

    private func fixtureImageBounds(for normalizedBoundingBox: CGRect, imageSize: CGSize) -> CGRect {
        CGRect(
            x: normalizedBoundingBox.minX * imageSize.width,
            y: (1 - normalizedBoundingBox.maxY) * imageSize.height,
            width: normalizedBoundingBox.width * imageSize.width,
            height: normalizedBoundingBox.height * imageSize.height
        )
    }

    private func fixtureDiagnostics(
        readiness: ScanCaptureLogic.CaptureReadiness,
        frameQuality: CaptureFrameQuality
    ) -> FixtureExportDiagnostics {
        FixtureExportDiagnostics(
            frameQuality: frameQuality.diagnosticSummary,
            frameQualityMetrics: FixtureExportFrameQualityMetrics(
                sharpness: frameQuality.sharpness,
                glareRatio: frameQuality.glareRatio,
                darkRatio: frameQuality.darkRatio,
                meanLuma: frameQuality.meanLuma,
                usable: frameQuality.isUsableForCapture,
                failureReasons: frameQuality.failureReasons
            ),
            canCapture: readiness.canCapture,
            canGuideLiveScan: readiness.canGuideLiveScan,
            score: readiness.score,
            markerCount: readiness.markerCount,
            itemCount: readiness.itemCount,
            missingFrontNames: fixtureMissingFrontNames(),
            reasons: readiness.reasons
        )
    }

    private func fixtureMissingFrontNames() -> Bool {
        guard ["CIE_FRONT", "TESSERA_SANITARIA_FRONT"].contains(parsedData.documentType) else {
            return false
        }
        return parsedData.surname == nil || parsedData.name == nil
    }

    private func fixtureOrientation(cgImage: CGImage) -> FixtureExportOrientation? {
        guard scanMode == .camera, let capturedCameraOrientation else { return nil }
        let fullFrameDimensions = fullFrameRawDimensions(
            for: capturedCameraOrientation,
            exportedWidth: cgImage.width,
            exportedHeight: cgImage.height
        )
        return FixtureExportOrientation(
            ocrVisionOrientation: CameraOrientation.orientationName(capturedCameraOrientation.ocrVisionOrientation),
            snapshotDisplayOrientation: CameraOrientation.orientationName(capturedCameraOrientation.snapshotDisplayOrientation),
            basePreviewRotationAngle: Double(CameraOrientation.normalizeRotationAngle(capturedCameraOrientation.basePreviewRotationAngle)),
            scanPreviewRotationAngle: Double(CameraOrientation.normalizeRotationAngle(capturedCameraOrientation.scanPreviewRotationAngle)),
            baseCaptureRotationAngle: Double(CameraOrientation.normalizeRotationAngle(capturedCameraOrientation.baseCaptureRotationAngle)),
            scanCaptureRotationAngle: Double(CameraOrientation.normalizeRotationAngle(capturedCameraOrientation.scanCaptureRotationAngle)),
            rawImageWidth: fullFrameDimensions?.width,
            rawImageHeight: fullFrameDimensions?.height,
            imageWidth: cgImage.width,
            imageHeight: cgImage.height
        )
    }

    private func fullFrameRawDimensions(
        for orientation: CameraSnapshotOrientationMetadata,
        exportedWidth: Int,
        exportedHeight: Int
    ) -> (width: Int, height: Int)? {
        let rawWidth = orientation.rawImageWidth
        let rawHeight = orientation.rawImageHeight
        switch CameraOrientation.orientationName(orientation.snapshotDisplayOrientation) {
        case "left", "leftMirrored", "right", "rightMirrored":
            return exportedWidth == rawHeight && exportedHeight == rawWidth
                ? (rawWidth, rawHeight)
                : nil
        case "up", "upMirrored", "down", "downMirrored":
            return exportedWidth == rawWidth && exportedHeight == rawHeight
                ? (rawWidth, rawHeight)
                : nil
        default:
            return nil
        }
    }

    private func fixtureCaptureSource() -> String {
        switch scanMode {
        case .image:
            return "imported"
        case .camera:
            return CameraOrientation.isContinuityCameraDevice(cameraManager.selectedDevice) ? "continuity" : "webcam"
        }
    }

    private func fixtureCollectionTarget(accepted: Bool, condition: String) -> String {
        [
            fixtureCollectionTargetPrefix(accepted: accepted),
            condition
        ].joined(separator: " ")
    }

    private func fixtureCollectionTargetPrefix(accepted: Bool) -> String {
        [
            accepted ? "accept" : "reject",
            fixtureCaptureSource(),
            fixtureDocumentSide(accepted: accepted)
        ].joined(separator: " ")
    }

    private func fixtureDocumentSide(accepted: Bool) -> String {
        guard accepted else { return "negative" }
        switch parsedData.documentType {
        case "CIE_FRONT":
            return "cie_front"
        case "CIE_BACK":
            return "cie_back"
        case "TESSERA_SANITARIA_FRONT":
            return "tessera_front"
        case "TESSERA_SANITARIA_BACK":
            return "tessera_back"
        default:
            return "unknown"
        }
    }

    // MARK: - Mapping Coordinates
    
    private func mapBoundingBox(_ box: CGRect, to size: CGSize) -> CGRect {
        let width = box.width * size.width
        let height = box.height * size.height
        let x = box.minX * size.width
        let y = (1.0 - box.maxY) * size.height
        
        return CGRect(x: x, y: y, width: width, height: height)
    }
    
    @ViewBuilder
    private func boundingBoxMenu(for item: RecognizedItem, rect: CGRect) -> some View {
        Menu {
            Button(appLanguage == "it" ? "Assegna a Cognome" : "Assign to Cognome / Surname") {
                parsedData.surname = item.text
                parsedData.calculateCodiceFiscaleIfPossible()
            }
            Button(appLanguage == "it" ? "Assegna a Nome" : "Assign to Nome / Name") {
                parsedData.name = item.text
                parsedData.calculateCodiceFiscaleIfPossible()
            }
            Button(appLanguage == "it" ? "Assegna a Codice Fiscale" : "Assign to Codice Fiscale / Tax Code") {
                parsedData.codiceFiscale = item.text
            }
            Button(appLanguage == "it" ? "Assegna a Documento" : "Assign to Document / Document #") {
                parsedData.documentNumber = item.text
            }
            Button(appLanguage == "it" ? "Assegna a Data Nascita" : "Assign to Data Nascita / Birth Date") {
                parsedData.dateOfBirth = item.text
                parsedData.calculateCodiceFiscaleIfPossible()
            }
            Button(appLanguage == "it" ? "Assegna a Luogo Nascita" : "Assign to Luogo Nascita / Birth Place") {
                parsedData.placeOfBirth = item.text
                parsedData.calculateCodiceFiscaleIfPossible()
            }
            Button(appLanguage == "it" ? "Assegna a Sesso" : "Assign to Sesso / Sex") {
                parsedData.gender = item.text
                parsedData.calculateCodiceFiscaleIfPossible()
            }
            Button(appLanguage == "it" ? "Assegna a Scadenza" : "Assign to Scadenza / Expiry Date") {
                parsedData.expiryDate = item.text
            }
            Button(appLanguage == "it" ? "Assegna a Cittadinanza" : "Assign to Cittadinanza / Nationality") {
                parsedData.nationality = item.text
            }
        } label: {
            RoundedRectangle(cornerRadius: 3)
                .stroke(Color.cyan.opacity(0.8), lineWidth: 1.5)
                .background(Color.cyan.opacity(0.12))
        }
        .buttonStyle(.plain)
        .frame(width: rect.width, height: rect.height)
        .help(appLanguage == "it" ? "Clicca per assegnare manualmente: \(item.text)" : "Click to manually assign: \(item.text)")
    }
    
    private func fitRect(for imageSize: CGSize, in containerSize: CGSize) -> CGRect {
        let aspectWidth = containerSize.width / imageSize.width
        let aspectHeight = containerSize.height / imageSize.height
        let aspect = min(aspectWidth, aspectHeight)
        
        let width = imageSize.width * aspect
        let height = imageSize.height * aspect
        let x = (containerSize.width - width) / 2
        let y = (containerSize.height - height) / 2
        
        return CGRect(x: x, y: y, width: width, height: height)
    }
    
    @ViewBuilder
    private func badgeView(for type: String) -> some View {
        switch type {
        case "CIE_FRONT", "CIE_BACK":
            Text("CIE (ID)")
                .font(.caption2)
                .fontWeight(.bold)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.blue.opacity(0.2))
                .foregroundColor(.blue)
                .cornerRadius(4)
        case "TESSERA_SANITARIA_FRONT", "TESSERA_SANITARIA_BACK":
            Text("TESSERA SANITARIA")
                .font(.caption2)
                .fontWeight(.bold)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.green.opacity(0.2))
                .foregroundColor(.green)
                .cornerRadius(4)
        default:
            Text("NOT DETECTED")
                .font(.caption2)
                .fontWeight(.bold)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.gray.opacity(0.2))
                .foregroundColor(.gray)
                .cornerRadius(4)
        }
    }
}

// MARK: - Welcome Prompt

struct WelcomePromptView: View {
    @Binding var isPresented: Bool
    let lang: String
    let onComplete: () -> Void
    
    @AppStorage("checkForUpdatesAutomatically") private var checkForUpdatesAutomatically = true
    @AppStorage("autoDownloadAndInstallUpdates") private var autoDownloadAndInstallUpdates = false
    @AppStorage("hasCompletedWelcomePrompt") private var hasCompletedWelcomePrompt = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 16) {
                Image(nsImage: AppIconLoader.image)
                    .resizable()
                    .interpolation(.high)
                    .frame(width: 64, height: 64)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                
                VStack(alignment: .leading, spacing: 10) {
                    Text(Localization.string(key: "welcome_title", lang: lang))
                        .font(.title3)
                        .fontWeight(.semibold)
                    
                    Text(Localization.string(key: "welcome_body", lang: lang))
                        .font(.body)
                        .foregroundStyle(.primary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(20)
            
            Divider()
            
            Toggle(Localization.string(key: "welcome_auto_download", lang: lang), isOn: $autoDownloadAndInstallUpdates)
                .toggleStyle(.checkbox)
                .padding(.horizontal, 20)
                .padding(.vertical, 14)
            
            Divider()
            
            HStack(spacing: 12) {
                Button(Localization.string(key: "welcome_dont_check", lang: lang)) {
                    finish(enableAutomaticChecks: false)
                }
                .keyboardShortcut(.cancelAction)
                
                Spacer()
                
                Button(Localization.string(key: "welcome_check_automatically", lang: lang)) {
                    finish(enableAutomaticChecks: true)
                }
                .buttonStyle(.borderedProminent)
                .keyboardShortcut(.defaultAction)
            }
            .padding(20)
        }
        .frame(width: 500)
        .background(Color(nsColor: .windowBackgroundColor))
    }
    
    private func finish(enableAutomaticChecks: Bool) {
        checkForUpdatesAutomatically = enableAutomaticChecks
        hasCompletedWelcomePrompt = true
        isPresented = false
        onComplete()
    }
}

// MARK: - Settings View

struct SettingsView: View {
    @Binding var isPresented: Bool
    @Binding var pendingUpdate: MainView.PendingUpdate?
    
    @AppStorage("showJsonOptions") private var showJsonOptions = false
    @AppStorage("autoCreatePatient") private var autoCreatePatient = false
    @AppStorage("askConfirmation") private var askConfirmation = true
    @AppStorage("openInBrowser") private var openInBrowser = false
    @AppStorage("appLanguage") private var appLanguage = "en"
    @AppStorage("serverUrl") private var serverUrl = "https://sorrisosplendente.com"
    @AppStorage("apiToken") private var apiToken = "poligest_macos_secret"
    
    @AppStorage("checkForUpdatesAutomatically") private var checkForUpdatesAutomatically = true
    @AppStorage("autoDownloadAndInstallUpdates") private var autoDownloadAndInstallUpdates = false
    @AppStorage("lastUpdateCheck") private var lastUpdateCheck: Double = 0
    @AppStorage("autoCaptureCountdown") private var autoCaptureCountdown = false
    @AppStorage("requireCaptureApproval") private var requireCaptureApproval = false
    @AppStorage("defaultScanMode") private var defaultScanMode = "image"
    @AppStorage("rememberLastCamera") private var rememberLastCamera = false
    @AppStorage("detectOnlyExpectedFields") private var detectOnlyExpectedFields = true
    @AppStorage("autoZoomOnCapture") private var autoZoomOnCapture = ScanIDDefaults.autoZoomOnCapture
    
    @State private var selectedSection: SettingsSection = .general
    @State private var showToken = false
    @State private var isCheckingForUpdates = false
    
    enum SettingsSection: String, CaseIterable, Identifiable {
        case general
        case camera
        case detection
        case sorriso
        case updates
        case developer
        
        var id: String { rawValue }
        
        func title(lang: String) -> String {
            switch self {
            case .general:
                return Localization.string(key: "settings_sidebar_general", lang: lang)
            case .camera:
                return Localization.string(key: "settings_sidebar_camera", lang: lang)
            case .detection:
                return Localization.string(key: "settings_sidebar_detection", lang: lang)
            case .sorriso:
                return Localization.string(key: "settings_sidebar_sorriso", lang: lang)
            case .updates:
                return Localization.string(key: "settings_sidebar_updates", lang: lang)
            case .developer:
                return Localization.string(key: "settings_sidebar_developer", lang: lang)
            }
        }
        
        var icon: String {
            switch self {
            case .general: return "gearshape"
            case .camera: return "camera"
            case .detection: return "viewfinder.circle"
            case .sorriso: return "person.crop.circle.badge.plus"
            case .updates: return "arrow.triangle.2.circlepath"
            case .developer: return "chevron.left.forwardslash.chevron.right"
            }
        }
    }
    
    var body: some View {
        NavigationSplitView {
            List(selection: $selectedSection) {
                Section {
                    settingsSidebarHeader
                }
                
                Section {
                    ForEach(SettingsSection.allCases) { section in
                        Label(section.title(lang: appLanguage), systemImage: section.icon)
                            .tag(section)
                    }
                }
            }
            .listStyle(.sidebar)
            .navigationSplitViewColumnWidth(min: 200, ideal: 220, max: 260)
        } detail: {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    settingsDetailHeader
                    
                    switch selectedSection {
                    case .general:
                        generalSection
                    case .camera:
                        cameraSection
                    case .detection:
                        detectionSection
                    case .sorriso:
                        sorrisoSection
                    case .updates:
                        updatesSection
                    case .developer:
                        developerSection
                    }
                }
                .padding(24)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Color(nsColor: .windowBackgroundColor))
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(Localization.string(key: "close", lang: appLanguage)) {
                        isPresented = false
                    }
                    .keyboardShortcut(.cancelAction)
                }
            }
        }
        .frame(minWidth: 640, minHeight: 460)
    }
    
    private var settingsSidebarHeader: some View {
        HStack(spacing: 12) {
            Image(nsImage: AppIconLoader.image)
                .resizable()
                .interpolation(.high)
                .frame(width: 40, height: 40)
                .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
            
            VStack(alignment: .leading, spacing: 2) {
                Text("ScanID")
                    .font(.headline)
                Text(currentVersionString())
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
    
    private var settingsDetailHeader: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(selectedSection.title(lang: appLanguage))
                .font(.title2)
                .fontWeight(.semibold)
            Text(settingsSubtitle(for: selectedSection))
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
    
    private func settingsSubtitle(for section: SettingsSection) -> String {
        switch section {
        case .general:
            return Localization.string(key: "settings_general_subtitle", lang: appLanguage)
        case .camera:
            return Localization.string(key: "settings_camera_subtitle", lang: appLanguage)
        case .detection:
            return Localization.string(key: "settings_detection_subtitle", lang: appLanguage)
        case .sorriso:
            return Localization.string(key: "settings_sorriso_subtitle", lang: appLanguage)
        case .updates:
            return Localization.string(key: "settings_updates_subtitle", lang: appLanguage)
        case .developer:
            return Localization.string(key: "settings_developer_subtitle", lang: appLanguage)
        }
    }
    
    private var generalSection: some View {
        VStack(spacing: 16) {
            SettingsCard {
                SettingsToggleRow(
                    title: Localization.string(key: "pref_lang", lang: appLanguage),
                    subtitle: Localization.string(key: "pref_lang_desc", lang: appLanguage),
                    icon: "globe"
                ) {
                    Picker("", selection: $appLanguage) {
                        Text("English").tag("en")
                        Text("Italiano").tag("it")
                    }
                    .labelsHidden()
                    .pickerStyle(.menu)
                    .frame(width: 140)
                }
            }
        }
    }
    
    private var developerSection: some View {
        VStack(spacing: 16) {
            SettingsCard {
                SettingsToggleRow(
                    title: Localization.string(key: "pref_json", lang: appLanguage),
                    subtitle: Localization.string(key: "pref_json_desc", lang: appLanguage),
                    icon: "curlybraces"
                ) {
                    Toggle("", isOn: $showJsonOptions)
                        .labelsHidden()
                        .toggleStyle(.switch)
                }
            }
        }
    }
    
    private var detectionSection: some View {
        VStack(spacing: 16) {
            SettingsCard {
                VStack(spacing: 4) {
                    SettingsToggleRow(
                        title: Localization.string(key: "pref_detect_only_expected", lang: appLanguage),
                        subtitle: Localization.string(key: "pref_detect_only_expected_desc", lang: appLanguage),
                        icon: "rectangle.dashed.badge.record"
                    ) {
                        Toggle("", isOn: $detectOnlyExpectedFields)
                            .labelsHidden()
                            .toggleStyle(.switch)
                    }
                    
                    Divider().padding(.vertical, 4)
                    
                    SettingsToggleRow(
                        title: Localization.string(key: "pref_auto_zoom", lang: appLanguage),
                        subtitle: Localization.string(key: "pref_auto_zoom_desc", lang: appLanguage),
                        icon: "plus.magnifyingglass"
                    ) {
                        Toggle("", isOn: $autoZoomOnCapture)
                            .labelsHidden()
                            .toggleStyle(.switch)
                    }
                }
            }
        }
    }
    
    private var cameraSection: some View {
        VStack(spacing: 16) {
            SettingsCard(title: Localization.string(key: "settings_camera_startup_group", lang: appLanguage)) {
                VStack(spacing: 4) {
                    SettingsToggleRow(
                        title: Localization.string(key: "pref_default_scan_mode", lang: appLanguage),
                        subtitle: Localization.string(key: "pref_default_scan_mode_desc", lang: appLanguage),
                        icon: "viewfinder"
                    ) {
                        Picker("", selection: $defaultScanMode) {
                            Text(Localization.string(key: "live_camera", lang: appLanguage)).tag("camera")
                            Text(Localization.string(key: "upload_image", lang: appLanguage)).tag("image")
                        }
                        .labelsHidden()
                        .pickerStyle(.menu)
                        .frame(width: 160)
                    }
                    
                    Divider().padding(.vertical, 4)
                    
                    SettingsToggleRow(
                        title: Localization.string(key: "pref_remember_last_camera", lang: appLanguage),
                        subtitle: Localization.string(key: "pref_remember_last_camera_desc", lang: appLanguage),
                        icon: "camera.rotate"
                    ) {
                        Toggle("", isOn: $rememberLastCamera)
                            .labelsHidden()
                            .toggleStyle(.switch)
                    }
                }
            }
            
            SettingsCard(title: Localization.string(key: "settings_camera_capture_group", lang: appLanguage)) {
                VStack(spacing: 4) {
                    SettingsToggleRow(
                        title: Localization.string(key: "pref_require_capture_approval", lang: appLanguage),
                        subtitle: Localization.string(key: "pref_require_capture_approval_desc", lang: appLanguage),
                        icon: "hand.tap"
                    ) {
                        Toggle("", isOn: $requireCaptureApproval)
                            .labelsHidden()
                            .toggleStyle(.switch)
                    }
                    
                    Divider().padding(.vertical, 4)
                    
                    SettingsToggleRow(
                        title: Localization.string(key: "pref_auto_countdown", lang: appLanguage),
                        subtitle: Localization.string(key: "pref_auto_countdown_desc", lang: appLanguage),
                        icon: "timer"
                    ) {
                        Toggle("", isOn: $autoCaptureCountdown)
                            .labelsHidden()
                            .toggleStyle(.switch)
                    }
                }
            }
            
            SettingsCard {
                DisclosureGroup {
                    ContinuityCameraHelpContent(lang: appLanguage)
                        .padding(.top, 4)
                } label: {
                    Label(
                        Localization.string(key: "continuity_camera_help_title", lang: appLanguage),
                        systemImage: "iphone.and.arrow.forward"
                    )
                    .font(.subheadline)
                    .foregroundStyle(.primary)
                }
            }
        }
    }
    
    private var sorrisoSection: some View {
        VStack(spacing: 16) {
            SettingsCard(title: Localization.string(key: "settings_connection_group", lang: appLanguage)) {
                VStack(alignment: .leading, spacing: 14) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(Localization.string(key: "pref_server", lang: appLanguage))
                            .font(.subheadline)
                            .fontWeight(.medium)
                        Text(Localization.string(key: "pref_server_desc", lang: appLanguage))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        TextField("https://…", text: $serverUrl)
                            .textFieldStyle(.roundedBorder)
                    }
                    
                    Divider()
                    
                    VStack(alignment: .leading, spacing: 6) {
                        Text(Localization.string(key: "pref_token", lang: appLanguage))
                            .font(.subheadline)
                            .fontWeight(.medium)
                        Text(Localization.string(key: "pref_token_desc", lang: appLanguage))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        HStack(spacing: 8) {
                            Group {
                                if showToken {
                                    TextField("", text: $apiToken)
                                } else {
                                    SecureField("", text: $apiToken)
                                }
                            }
                            .textFieldStyle(.roundedBorder)
                            
                            Button(action: { showToken.toggle() }) {
                                Image(systemName: showToken ? "eye.slash" : "eye")
                            }
                            .buttonStyle(.borderless)
                            .foregroundStyle(.secondary)
                            .help(showToken
                                  ? Localization.string(key: "pref_token_hide", lang: appLanguage)
                                  : Localization.string(key: "pref_token_show", lang: appLanguage))
                        }
                    }
                }
            }
            
            SettingsCard(title: Localization.string(key: "settings_sync_group", lang: appLanguage)) {
                VStack(spacing: 4) {
                    SettingsToggleRow(
                        title: Localization.string(key: "pref_auto_create", lang: appLanguage),
                        subtitle: Localization.string(key: "pref_auto_create_desc", lang: appLanguage),
                        icon: "bolt.fill"
                    ) {
                        Toggle("", isOn: $autoCreatePatient)
                            .labelsHidden()
                            .toggleStyle(.switch)
                    }
                    
                    if autoCreatePatient {
                        Divider().padding(.vertical, 4)
                        
                        SettingsToggleRow(
                            title: Localization.string(key: "pref_confirm", lang: appLanguage),
                            subtitle: Localization.string(key: "pref_confirm_desc", lang: appLanguage),
                            icon: "hand.raised",
                            compact: true
                        ) {
                            Toggle("", isOn: $askConfirmation)
                                .labelsHidden()
                                .toggleStyle(.switch)
                        }
                        
                        SettingsToggleRow(
                            title: Localization.string(key: "pref_open_browser", lang: appLanguage),
                            subtitle: Localization.string(key: "pref_open_browser_desc", lang: appLanguage),
                            icon: "safari",
                            compact: true
                        ) {
                            Toggle("", isOn: $openInBrowser)
                                .labelsHidden()
                                .toggleStyle(.switch)
                        }
                    }
                }
            }
        }
    }
    
    private var updatesSection: some View {
        VStack(spacing: 16) {
            SettingsCard {
                HStack(spacing: 16) {
                    Image(nsImage: AppIconLoader.image)
                        .resizable()
                        .interpolation(.high)
                        .frame(width: 52, height: 52)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    
                    VStack(alignment: .leading, spacing: 4) {
                        Text("ScanID")
                            .font(.headline)
                        Text(Localization.string(key: "version", lang: appLanguage) + " " + currentVersionString())
                            .font(.system(.subheadline, design: .monospaced))
                            .foregroundStyle(.secondary)
                        if lastUpdateCheck > 0 {
                            Text(String(
                                format: Localization.string(key: "settings_last_checked", lang: appLanguage),
                                lastUpdateCheckFormatted
                            ))
                                .font(.caption)
                                .foregroundStyle(.tertiary)
                        }
                    }
                    
                    Spacer()
                }
            }
            
            SettingsCard(title: Localization.string(key: "settings_updates_group", lang: appLanguage)) {
                VStack(spacing: 4) {
                    SettingsToggleRow(
                        title: Localization.string(key: "pref_check_updates", lang: appLanguage),
                        subtitle: Localization.string(key: "pref_check_updates_desc", lang: appLanguage),
                        icon: "clock.arrow.circlepath"
                    ) {
                        Toggle("", isOn: $checkForUpdatesAutomatically)
                            .labelsHidden()
                            .toggleStyle(.switch)
                    }
                    
                    if checkForUpdatesAutomatically {
                        Divider().padding(.vertical, 4)
                        
                        SettingsToggleRow(
                            title: Localization.string(key: "welcome_auto_download", lang: appLanguage),
                            subtitle: Localization.string(key: "pref_auto_download_desc", lang: appLanguage),
                            icon: "arrow.down.circle",
                            compact: true
                        ) {
                            Toggle("", isOn: $autoDownloadAndInstallUpdates)
                                .labelsHidden()
                                .toggleStyle(.switch)
                        }
                    }
                }
            }
            
            Button(action: { performUpdateCheckInSettings() }) {
                HStack(spacing: 8) {
                    if isCheckingForUpdates {
                        ProgressView().controlSize(.small)
                        Text(Localization.string(key: "checking_for_updates", lang: appLanguage))
                    } else {
                        Image(systemName: "arrow.triangle.2.circlepath")
                        Text(Localization.string(key: "check_for_updates", lang: appLanguage))
                    }
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(isCheckingForUpdates)
        }
    }
    
    private var lastUpdateCheckFormatted: String {
        let date = Date(timeIntervalSince1970: lastUpdateCheck)
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
    
    // Local version read (SettingsView has its own @AppStorage copies)
    private func currentVersionString() -> String {
        (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String) ?? "1.0"
    }
    
    private func performUpdateCheckInSettings() {
        guard !isCheckingForUpdates else { return }
        isCheckingForUpdates = true
        
        let base = serverUrl.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let url = URL(string: "\(base)/api/scanid/meta") else {
            isCheckingForUpdates = false
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if !apiToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            request.setValue(apiToken, forHTTPHeaderField: "x-api-key")
        }
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            DispatchQueue.main.async {
                self.isCheckingForUpdates = false
                self.lastUpdateCheck = Date().timeIntervalSince1970
            }
            
            if let error = error {
                DispatchQueue.main.async {
                    let alert = NSAlert()
                    alert.messageText = Localization.string(key: "update_check_failed", lang: self.appLanguage)
                    alert.informativeText = error.localizedDescription
                    alert.addButton(withTitle: Localization.string(key: "close", lang: self.appLanguage))
                    alert.runModal()
                }
                return
            }
            
            guard let data = data else {
                DispatchQueue.main.async {
                    let alert = NSAlert()
                    alert.messageText = Localization.string(key: "update_check_failed", lang: self.appLanguage)
                    alert.informativeText = "No data returned from the update server."
                    alert.addButton(withTitle: Localization.string(key: "close", lang: self.appLanguage))
                    alert.runModal()
                }
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let remote = json["version"] as? String,
                   let download = json["downloadUrl"] as? String {
                    
                    let local = self.currentVersionString()
                    if self.isNewer(remote, than: local) {
                        DispatchQueue.main.async {
                            self.pendingUpdate = MainView.PendingUpdate(
                                version: remote,
                                downloadUrl: download,
                                notes: json["notes"] as? String
                            )
                            self.isPresented = false
                        }
                    } else {
                        DispatchQueue.main.async {
                            let alert = NSAlert()
                            alert.messageText = Localization.string(key: "up_to_date", lang: self.appLanguage)
                            alert.addButton(withTitle: Localization.string(key: "close", lang: self.appLanguage))
                            alert.runModal()
                        }
                    }
                } else {
                    DispatchQueue.main.async {
                        let alert = NSAlert()
                        alert.messageText = Localization.string(key: "update_check_failed", lang: self.appLanguage)
                        alert.informativeText = "Invalid update response structure."
                        alert.addButton(withTitle: Localization.string(key: "close", lang: self.appLanguage))
                        alert.runModal()
                    }
                }
            } catch {
                DispatchQueue.main.async {
                    let alert = NSAlert()
                    alert.messageText = Localization.string(key: "update_check_failed", lang: self.appLanguage)
                    alert.informativeText = error.localizedDescription
                    alert.addButton(withTitle: Localization.string(key: "close", lang: self.appLanguage))
                    alert.runModal()
                }
            }
        }.resume()
    }
    
    private func isNewer(_ remote: String, than local: String) -> Bool {
        let r = remote.split(separator: ".").compactMap { Int($0) }
        let l = local.split(separator: ".").compactMap { Int($0) }
        let maxC = max(r.count, l.count)
        for i in 0..<maxC {
            let rv = i < r.count ? r[i] : 0
            let lv = i < l.count ? l[i] : 0
            if rv > lv { return true }
            if rv < lv { return false }
        }
        return false
    }
}

struct PatientRecordSuccessCard: View {
    let isUpdate: Bool
    let patientId: String
    let patientName: String
    let serverUrl: String
    let lang: String
    let onOpen: () -> Void
    
    private var patientUrl: String {
        "\(serverUrl)/pazienti/\(patientId)"
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 28))
                    .foregroundStyle(.green)
                    .symbolRenderingMode(.hierarchical)
                
                VStack(alignment: .leading, spacing: 4) {
                    Text(Localization.string(
                        key: isUpdate ? "sync_success_update" : "sync_success_create",
                        lang: lang
                    ))
                    .font(.headline)
                    
                    if !patientName.isEmpty {
                        Text(patientName)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            
            Button(action: onOpen) {
                Label(
                    Localization.string(key: "sync_open_record_button", lang: lang),
                    systemImage: "arrow.up.forward.app"
                )
                .frame(maxWidth: .infinity)
                .padding(.vertical, 2)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            
            Text(patientUrl)
                .font(.system(.caption, design: .monospaced))
                .foregroundStyle(.secondary)
                .textSelection(.enabled)
                .lineLimit(1)
                .truncationMode(.middle)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.green.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .strokeBorder(Color.green.opacity(0.25), lineWidth: 1)
        )
    }
}

struct SettingsCard<Content: View>: View {
    var title: String?
    @ViewBuilder var content: Content
    
    init(title: String? = nil, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let title {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
            }
            content
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .strokeBorder(Color.primary.opacity(0.06), lineWidth: 1)
        )
    }
}

struct SettingsToggleRow<Control: View>: View {
    let title: String
    let subtitle: String
    let icon: String
    var compact: Bool = false
    @ViewBuilder var control: Control
    
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: compact ? 13 : 15, weight: .medium))
                .foregroundStyle(.secondary)
                .frame(width: 22, alignment: .center)
                .padding(.top, 2)
            
            VStack(alignment: .leading, spacing: compact ? 2 : 4) {
                Text(title)
                    .font(compact ? .subheadline : .body)
                    .fontWeight(.medium)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            
            Spacer(minLength: 12)
            
            control
                .padding(.top, 2)
        }
        .padding(.vertical, compact ? 4 : 6)
    }
}

// MARK: - Status Bar

@MainActor
final class StatusBarController: ObservableObject {
    enum Style {
        case idle
        case info
        case success
        case warning
        case error
        case progress
    }
    
    @Published private(set) var messageKey: String = "status_ready"
    @Published private(set) var messageArgs: [String] = []
    @Published private(set) var style: Style = .idle
    
    private var dismissTask: Task<Void, Never>?
    
    func show(
        key: String,
        style: Style,
        args: [String] = [],
        autoDismiss: TimeInterval? = 4
    ) {
        dismissTask?.cancel()
        messageKey = key
        messageArgs = args
        self.style = style
        
        guard let autoDismiss else { return }
        dismissTask = Task {
            try? await Task.sleep(nanoseconds: UInt64(autoDismiss * 1_000_000_000))
            guard !Task.isCancelled else { return }
            showIdle()
        }
    }
    
    func showIdle() {
        dismissTask?.cancel()
        messageKey = "status_ready"
        messageArgs = []
        style = .idle
    }
    
    var iconName: String {
        switch style {
        case .idle: return "circle.fill"
        case .info: return "info.circle.fill"
        case .success: return "checkmark.circle.fill"
        case .warning: return "exclamationmark.triangle.fill"
        case .error: return "xmark.circle.fill"
        case .progress: return "arrow.triangle.2.circlepath"
        }
    }
    
    var iconColor: Color {
        switch style {
        case .idle: return .secondary.opacity(0.5)
        case .info: return .blue
        case .success: return .green
        case .warning: return .orange
        case .error: return .red
        case .progress: return .orange
        }
    }
    
    var showsProgress: Bool {
        style == .progress
    }
}

struct AppStatusBar: View {
    @ObservedObject var controller: StatusBarController
    let syncStatus: MainView.SyncStatus
    let lang: String
    let serverUrl: String
    
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: controller.iconName)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(controller.iconColor)
                .frame(width: 14)
            
            Text(formattedMessage)
                .font(.caption)
                .foregroundStyle(controller.style == .idle ? .secondary : .primary)
                .lineLimit(2)
                .truncationMode(.tail)
                .frame(maxWidth: .infinity, alignment: .leading)
            
            if controller.showsProgress {
                ProgressView()
                    .controlSize(.small)
                    .scaleEffect(0.7)
            }
            
            if case .success(let patientId, _) = syncStatus {
                Button(Localization.string(key: "status_open_browser", lang: lang)) {
                    if let url = URL(string: "\(serverUrl)/pazienti/\(patientId)") {
                        NSWorkspace.shared.open(url)
                    }
                }
                .font(.caption)
                .buttonStyle(.link)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .frame(maxWidth: .infinity, minHeight: 26)
        .background(Color(nsColor: .controlBackgroundColor))
        .overlay(alignment: .top) {
            Divider()
        }
        .animation(.easeInOut(duration: 0.2), value: controller.messageKey)
    }
    
    private var formattedMessage: String {
        let template = Localization.string(key: controller.messageKey, lang: lang)
        guard !controller.messageArgs.isEmpty else { return template }
        return String(format: template, arguments: controller.messageArgs.map { $0 as CVarArg })
    }
}

// MARK: - Countdown Sound

enum CountdownSound {
    private static let resourceURL = Bundle.main.url(forResource: "countdown", withExtension: "wav")
    private static var cachedSound: NSSound?
    
    static func play() {
        DispatchQueue.main.async {
            guard let resourceURL else { return }
            
            if cachedSound == nil {
                cachedSound = NSSound(contentsOf: resourceURL, byReference: true)
            }
            
            guard let sound = cachedSound else { return }
            if sound.isPlaying {
                sound.stop()
            }
            sound.currentTime = 0
            sound.volume = 0.5
            sound.play()
        }
    }
}

// MARK: - Supporting Views

struct ImageImportHelpContent: View {
    enum Style {
        case compact
        case prominent
    }
    
    let lang: String
    var style: Style = .compact
    
    var body: some View {
        VStack(alignment: .leading, spacing: style == .prominent ? 20 : 8) {
            if style == .prominent {
                Label(
                    Localization.string(key: "image_import_help_title", lang: lang),
                    systemImage: "photo.on.rectangle.angled"
                )
                .font(.title2)
                .fontWeight(.bold)
                .foregroundStyle(.primary)
                .symbolRenderingMode(.hierarchical)
                .labelStyle(.titleAndIcon)
            }
            
            Text(Localization.string(key: "image_import_help_intro", lang: lang))
                .font(style == .prominent ? .title3 : .caption)
                .fontWeight(style == .prominent ? .semibold : .regular)
                .foregroundStyle(style == .prominent ? .primary : .secondary)
                .fixedSize(horizontal: false, vertical: true)
            
            VStack(alignment: .leading, spacing: style == .prominent ? 14 : 8) {
                ForEach(1...4, id: \.self) { step in
                    imageImportStepRow(step)
                }
            }
            
            Text(Localization.string(key: "image_import_tip", lang: lang))
                .font(style == .prominent ? .body : .caption2)
                .fontWeight(style == .prominent ? .medium : .regular)
                .foregroundStyle(style == .prominent ? .primary : .tertiary)
                .fixedSize(horizontal: false, vertical: true)
                .padding(style == .prominent ? 14 : 0)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background {
                    if style == .prominent {
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .fill(Color.cyan.opacity(0.12))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .strokeBorder(Color.cyan.opacity(0.35), lineWidth: 1)
                            )
                    }
                }
        }
    }
    
    @ViewBuilder
    private func imageImportStepRow(_ step: Int) -> some View {
        HStack(alignment: .top, spacing: style == .prominent ? 14 : 8) {
            if style == .prominent {
                ZStack {
                    Circle()
                        .fill(Color.cyan.opacity(0.18))
                        .frame(width: 36, height: 36)
                    Text("\(step)")
                        .font(.headline)
                        .fontWeight(.bold)
                        .foregroundStyle(.cyan)
                }
            } else {
                Text("\(step).")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(.secondary)
                    .frame(width: 16, alignment: .trailing)
            }
            
            Text(Localization.string(key: "image_import_step_\(step)", lang: lang))
                .font(style == .prominent ? .body : .caption)
                .fontWeight(style == .prominent ? .medium : .regular)
                .foregroundStyle(style == .prominent ? .primary : .secondary)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.vertical, style == .prominent ? 6 : 0)
                .padding(.horizontal, style == .prominent ? 12 : 0)
                .background {
                    if style == .prominent {
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .fill(Color(nsColor: .controlBackgroundColor))
                    }
                }
        }
    }
}

struct ContinuityCameraHelpContent: View {
    enum Style {
        case compact
        case prominent
    }
    
    let lang: String
    var style: Style = .compact
    
    var body: some View {
        VStack(alignment: .leading, spacing: style == .prominent ? 20 : 8) {
            if style == .prominent {
                Label(
                    Localization.string(key: "continuity_camera_help_title", lang: lang),
                    systemImage: "iphone.and.arrow.forward"
                )
                .font(.title2)
                .fontWeight(.bold)
                .foregroundStyle(.primary)
                .symbolRenderingMode(.hierarchical)
                .labelStyle(.titleAndIcon)
            }
            
            Text(Localization.string(key: "continuity_camera_help_intro", lang: lang))
                .font(style == .prominent ? .title3 : .caption)
                .fontWeight(style == .prominent ? .semibold : .regular)
                .foregroundStyle(style == .prominent ? .primary : .secondary)
                .fixedSize(horizontal: false, vertical: true)
            
            VStack(alignment: .leading, spacing: style == .prominent ? 14 : 8) {
                ForEach(1...4, id: \.self) { step in
                    stepRow(step)
                }
            }
            
            Text(Localization.string(key: "continuity_camera_tip", lang: lang))
                .font(style == .prominent ? .body : .caption2)
                .fontWeight(style == .prominent ? .medium : .regular)
                .foregroundStyle(style == .prominent ? .primary : .tertiary)
                .fixedSize(horizontal: false, vertical: true)
                .padding(style == .prominent ? 14 : 0)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background {
                    if style == .prominent {
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .fill(Color.cyan.opacity(0.12))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .strokeBorder(Color.cyan.opacity(0.35), lineWidth: 1)
                            )
                    }
                }
        }
    }
    
    @ViewBuilder
    private func stepRow(_ step: Int) -> some View {
        HStack(alignment: .top, spacing: style == .prominent ? 14 : 8) {
            if style == .prominent {
                ZStack {
                    Circle()
                        .fill(Color.cyan.opacity(0.18))
                        .frame(width: 36, height: 36)
                    Text("\(step)")
                        .font(.headline)
                        .fontWeight(.bold)
                        .foregroundStyle(.cyan)
                }
            } else {
                Text("\(step).")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(.secondary)
                    .frame(width: 16, alignment: .trailing)
            }
            
            Text(Localization.string(key: "continuity_camera_step_\(step)", lang: lang))
                .font(style == .prominent ? .body : .caption)
                .fontWeight(style == .prominent ? .medium : .regular)
                .foregroundStyle(style == .prominent ? .primary : .secondary)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.vertical, style == .prominent ? 6 : 0)
                .padding(.horizontal, style == .prominent ? 12 : 0)
                .background {
                    if style == .prominent {
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .fill(Color(nsColor: .controlBackgroundColor))
                    }
                }
        }
    }
}

struct CaptureApprovalOverlay: View {
    let lang: String
    let onStart: () -> Void
    
    var body: some View {
        ZStack {
            Button(action: onStart) {
                Label(
                    Localization.string(key: "capture_approval_button", lang: lang),
                    systemImage: "play.fill"
                )
                .font(.headline)
            }
            .buttonStyle(.borderedProminent)
            .tint(.cyan)
            .controlSize(.large)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct CountdownOverlay: View {
    let seconds: Int
    let lang: String
    
    var body: some View {
        ZStack {
            Color.black.opacity(0.35)
            
            VStack(spacing: 10) {
                Text("\(seconds)")
                    .font(.system(size: 72, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .contentTransition(.numericText())
                    .animation(.easeInOut(duration: 0.2), value: seconds)
                
                Text(Localization.string(key: "countdown_hold_still", lang: lang))
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundStyle(.white.opacity(0.9))
            }
            .padding(32)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        }
        .allowsHitTesting(false)
    }
}

struct DocumentGuideOverlay: View {
    let lang: String
    
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 16)
                .strokeBorder(Color.cyan.opacity(0.5), style: StrokeStyle(lineWidth: 2, lineCap: .round, dash: [10, 5]))
                .overlay(
                    VStack {
                        Spacer()
                        Text(lang == "it" ? "Allinea la tessera qui" : "Align Italian ID Card here")
                            .font(.system(.body, design: .rounded))
                            .fontWeight(.medium)
                            .foregroundColor(.cyan)
                            .padding(.vertical, 8)
                            .padding(.horizontal, 16)
                            .background(Color.black.opacity(0.6))
                            .cornerRadius(20)
                            .padding(.bottom, 16)
                    }
                )
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .aspectRatio(1.586, contentMode: .fit)
    }
}

struct EditableFieldRow: View {
    let label: String
    @Binding var text: String
    let icon: String
    var highlight: Bool = false
    var onCommit: (() -> Void)? = nil
    
    @State private var isHovering = false
    @State private var copied = false
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundColor(highlight ? .cyan : .secondary)
                .frame(width: 20, alignment: .center)
            
            Text(label)
                .foregroundColor(.secondary)
                .frame(width: 150, alignment: .leading)
            
            Divider()
                .frame(height: 16)
            
            TextField("", text: $text, prompt: Text("—").foregroundColor(.secondary.opacity(0.5)))
                .textFieldStyle(.plain)
                .fontWeight(highlight ? .semibold : .regular)
                .foregroundColor(highlight ? .cyan : .primary)
                .onSubmit { onCommit?() }
            
            if isHovering && !text.isEmpty {
                Button(action: {
                    let pasteboard = NSPasteboard.general
                    pasteboard.clearContents()
                    pasteboard.setString(text, forType: .string)
                    copied = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                        copied = false
                    }
                }) {
                    Image(systemName: copied ? "checkmark" : "doc.on.doc")
                        .font(.system(size: 11))
                        .foregroundColor(copied ? .green : .secondary)
                }
                .buttonStyle(.plain)
                .transition(.opacity)
                .help(copied ? "Copied!" : "Copy value")
            }
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 12)
        .background(isHovering ? Color.secondary.opacity(0.08) : Color(nsColor: .controlBackgroundColor))
        .overlay(
            Divider().padding(.leading, 32),
            alignment: .bottom
        )
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.15)) {
                isHovering = hovering
            }
        }
    }
}

struct VisualEffectView: View {
    let material: NSVisualEffectView.Material
    let blendingMode: NSVisualEffectView.BlendingMode
    
    var body: some View {
        Representable(material: material, blendingMode: blendingMode)
    }
    
    private struct Representable: NSViewRepresentable {
        let material: NSVisualEffectView.Material
        let blendingMode: NSVisualEffectView.BlendingMode
        
        func makeNSView(context: Context) -> NSVisualEffectView {
            let view = NSVisualEffectView()
            view.material = material
            view.blendingMode = blendingMode
            view.state = .active
            return view
        }
        
        func updateNSView(_ nsView: NSVisualEffectView, context: Context) {
            nsView.material = material
            nsView.blendingMode = blendingMode
        }
    }
}

// MARK: - Update Sheet

struct UpdateAvailableSheet: View {
    let update: MainView.PendingUpdate
    let appLanguage: String
    let isDownloading: Bool
    let downloadProgress: Double
    let downloadError: String?
    let installError: String?
    let downloadedFileUrl: URL?
    let onDownload: () -> Void
    let onInstall: () -> Void
    let onLater: () -> Void
    
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "arrow.down.circle.fill")
                .font(.system(size: 48))
                .foregroundColor(.accentColor)
            
            Text(Localization.string(key: "update_available_title", lang: appLanguage))
                .font(.headline)
            
            Text(String(format: Localization.string(key: "update_available_body", lang: appLanguage), update.version))
                .multilineTextAlignment(.center)
                .foregroundColor(.secondary)
            
            if let notes = update.notes, !notes.isEmpty {
                Text(notes)
                    .font(.footnote)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }
            
            if isDownloading {
                VStack(spacing: 8) {
                    ProgressView(value: downloadProgress, total: 1.0)
                        .progressViewStyle(.linear)
                        .frame(width: 280)
                    Text(String(format: "%.0f%%", downloadProgress * 100))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding(.vertical, 8)
            } else if let error = downloadError {
                Text(error)
                    .font(.caption)
                    .foregroundColor(.red)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            } else if downloadedFileUrl != nil {
                Text(appLanguage == "it" ? "Aggiornamento scaricato con successo!" : "Update downloaded successfully!")
                    .font(.subheadline)
                    .foregroundColor(.green)
                    .padding(.vertical, 8)
            }
            
            if let installError, !installError.isEmpty {
                Text(installError)
                    .font(.caption)
                    .foregroundColor(.red)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }
            
            HStack(spacing: 12) {
                if downloadedFileUrl != nil {
                    Button(Localization.string(key: "later", lang: appLanguage), action: onLater)
                        .buttonStyle(.bordered)
                        .disabled(isDownloading)
                    
                    Button(appLanguage == "it" ? "Installa & Riavvia" : "Install & Relaunch", action: onInstall)
                        .buttonStyle(.borderedProminent)
                } else {
                    Button(Localization.string(key: "later", lang: appLanguage), action: onLater)
                        .buttonStyle(.bordered)
                        .disabled(isDownloading)
                    
                    Button(appLanguage == "it" ? "Scarica & Installa" : "Download & Install", action: onDownload)
                        .buttonStyle(.borderedProminent)
                        .disabled(isDownloading)
                }
            }
            .padding(.top, 8)
        }
        .padding(24)
        .frame(width: 380)
    }
}

// MARK: - Localization Utility

struct Localization {
    static func string(key: String, lang: String) -> String {
        let en = [
            "scan_mode": "Scan Mode",
            "live_camera": "Live Camera",
            "selected_camera": "Selected camera",
            "camera_menu": "Camera",
            "camera_menu_unavailable": "No camera available",
            "upload_image": "Upload Image",
            "select_file": "Select File...",
            "paste_image": "Paste Image",
            "export_ocr_fixture": "Export OCR Fixture...",
            "freeze_camera_frame": "Freeze Current Camera Frame",
            "freeze_camera_frame_help": "Freeze the current camera frame so it can be exported as an OCR fixture",
            "fixture_target": "Fixture target",
            "fixture_condition": "Fixture condition",
            "reset": "Reset",
            "camera_denied": "Camera Access Denied",
            "camera_denied_desc": "Please enable Camera permissions for this app in System Settings > Privacy & Security.",
            "detected_data": "DETECTED DATA",
            "awaiting_scan_title": "No scan yet",
            "awaiting_scan_body": "Upload or scan an Italian ID card to see extracted fields here.",
            "fields": "Extracted Fields",
            "json_output": "JSON Output",
            "raw_ocr": "Raw OCR Detected Text",
            "settings": "Settings",
            "save": "Save",
            "close": "Close",
            "pref_title": "Preferences",
            "pref_json": "Show JSON Options",
            "pref_auto_create": "Automatically Create Patient File",
            "pref_confirm": "Confirm Before Creating Patient",
            "pref_open_browser": "Open Created Record in Browser",
            "pref_lang": "App Language",
            "pref_server": "Sorriso Server URL",
            "pref_token": "API Key / Token",
            "confirm_dialog_title": "Create Patient Record?",
            "confirm_dialog_body": "Do you want to add a new patient record for %@ %@ in Sorriso?",
            "confirm_update_title": "Update Patient Record?",
            "confirm_update_body": "Update the existing patient record for %@ %@ in Sorriso with missing scanned details?",
            "update": "Update",
            "sync_create_button": "Create a patient record in Sorriso",
            "sync_update_button": "Update patient record in Sorriso",
            "sync_progress_create": "Creating patient record...",
            "sync_progress_update": "Updating patient record...",
            "sync_success_create": "Patient record created successfully!",
            "sync_success_update": "Patient record updated successfully!",
            "sync_open_record_button": "Open Patient Record in Sorriso",
            "create_success": "Patient record created successfully!",
            "create_fail": "Failed to create patient: %@",
            "create": "Create",
            "cancel": "Cancel",
            "copy_json": "Copy JSON",
            "copied": "Copied!",
            "field_surname": "Surname",
            "field_name": "Name",
            "field_cf": "Tax Code",
            "field_doc_num": "Document #",
            "field_dob": "Birth Date",
            "field_pob": "Birth Place",
            "field_sex": "Sex",
            "field_expiry": "Expiry Date",
            "field_nationality": "Nationality",
            "field_card_num": "Card Number (TS Back)",
            "contact_fields": "Contact (optional)",
            "field_email": "Email",
            "field_phone": "Phone",
            "version": "Version",
            "check_for_updates": "Check for Updates",
            "checking_for_updates": "Checking for updates...",
            "up_to_date": "You are up to date.",
            "update_available_title": "Update Available",
            "update_available_body": "ScanID version %@ is available.",
            "download_update": "Download Update",
            "later": "Later",
            "update_check_failed": "Update check failed.",
            "update_install_failed": "Update installation failed",
            "update_install_missing_file": "The downloaded update file is missing. Please download again.",
            "pref_check_updates": "Automatically check for updates",
            "new_version_available": "New version available",
            "welcome_title": "Check for updates automatically?",
            "welcome_body": "Should ScanID automatically check for updates? You can always check for updates manually from Settings.",
            "welcome_auto_download": "Automatically download and install updates",
            "welcome_dont_check": "Don't Check",
            "welcome_check_automatically": "Check Automatically",
            "settings_sidebar_general": "General",
            "settings_sidebar_camera": "Camera",
            "settings_sidebar_detection": "Detection",
            "settings_sidebar_sorriso": "Sorriso",
            "settings_sidebar_updates": "Updates",
            "settings_sidebar_developer": "Developer",
            "settings_general_subtitle": "Language preferences for the app.",
            "settings_developer_subtitle": "Advanced debugging and export options.",
            "settings_camera_subtitle": "Startup mode, capture behavior, and iPhone camera setup.",
            "settings_detection_subtitle": "Control which OCR text is highlighted and how captures are framed.",
            "pref_detect_only_expected": "Detect only expected fields",
            "pref_detect_only_expected_desc": "Hide bounding boxes for text that is not a recognized ID field.",
            "pref_auto_zoom": "Auto zoom",
            "pref_auto_zoom_desc": "After capture, crop to the card edges and run a high-quality OCR pass on the cropped image.",
            "settings_camera_startup_group": "Startup",
            "settings_camera_capture_group": "Capture",
            "settings_sorriso_subtitle": "Connect ScanID to your Sorriso server and control patient sync.",
            "settings_updates_subtitle": "Keep ScanID up to date with automatic or manual checks.",
            "settings_connection_group": "Connection",
            "settings_sync_group": "Patient sync",
            "settings_updates_group": "Automatic updates",
            "settings_last_checked": "Last checked: %@",
            "pref_lang_desc": "Interface language for labels and messages.",
            "pref_json_desc": "Show copy and save actions for raw JSON and OCR text.",
            "pref_server_desc": "Base URL of your Sorriso deployment.",
            "pref_token_desc": "API key sent as x-api-key when creating or updating patients.",
            "pref_token_show": "Show token",
            "pref_token_hide": "Hide token",
            "pref_auto_create_desc": "Send scanned patients to Sorriso right after a successful scan.",
            "pref_confirm_desc": "Show a confirmation dialog before creating or updating a record.",
            "pref_open_browser_desc": "Open the patient chart in your browser after sync completes.",
            "pref_check_updates_desc": "Check once per day on launch for a newer ScanID release.",
            "pref_auto_download_desc": "Download and offer to install updates without manual steps.",
            "pref_default_scan_mode": "Default scan mode",
            "pref_default_scan_mode_desc": "Which mode to show when ScanID opens.",
            "pref_remember_last_camera": "Remember last camera",
            "pref_remember_last_camera_desc": "Reopen ScanID with the camera you used last time.",
            "pref_require_capture_approval": "Require approval to start scan",
            "pref_require_capture_approval_desc": "Show a Start Scan button before detecting the ID card. When off, detection begins automatically.",
            "capture_approval_title": "Ready to scan",
            "capture_approval_body": "Position the ID card in frame, then start scanning when you are ready.",
            "capture_approval_button": "Start Scan",
            "pref_auto_countdown": "Countdown before capture",
            "pref_auto_countdown_desc": "When an ID is detected in frame, wait 3 seconds before locking the scan.",
            "image_import_help_title": "Import an ID image",
            "image_import_help_intro": "Use a photo of an Italian ID card — no camera needed.",
            "image_import_step_1": "Drag a PNG, JPEG, or HEIC file onto the drop zone on the left.",
            "image_import_step_2": "Or click Browse files... in the drop zone to choose an image from disk.",
            "image_import_step_3": "Or paste from the clipboard using Paste Image in the toolbar (⌘V).",
            "image_import_step_4": "Front or back works — Carta d'Identità (CIE) and Tessera Sanitaria are supported.",
            "image_import_tip": "Use a flat, well-lit photo with the full card visible for best OCR results.",
            "continuity_camera_help_title": "Use iPhone as camera",
            "continuity_camera_help_intro": "Scan with your iPhone camera — no photo transfer needed.",
            "continuity_camera_step_1": "Sign in to the same Apple ID on iPhone and Mac.",
            "continuity_camera_step_2": "Turn on Wi‑Fi and Bluetooth on both devices.",
            "continuity_camera_step_3": "Keep the iPhone unlocked and near the Mac.",
            "continuity_camera_step_4": "In Live Camera mode, choose your iPhone from the camera menu above.",
            "continuity_camera_tip": "If it does not appear, open Control Center on the Mac and pick your iPhone under Camera.",
            "countdown_hold_still": "Hold still…",
            "scan_status_title_waiting": "Ready to scan",
            "scan_status_title_adjust": "Adjust the card",
            "scan_status_title_ready": "Document detected",
            "scan_status_waiting": "Align the ID card inside the frame",
            "scan_status_move_closer": "Move closer — not enough text is visible",
            "scan_status_align_document": "Center the card and reduce glare",
            "scan_status_need_identity": "Show name, surname, or tax code more clearly",
            "scan_status_need_names": "Show name and surname more clearly",
            "scan_status_sharpen_text": "Move closer and sharpen the text",
            "scan_status_reading_fields": "Reading fields — hold steady",
            "scan_status_ready": "Document recognized — countdown starting",
            "scan_status_capturing": "Capturing…",
            "scan_status_countdown": "Hold still for the countdown",
            "scan_status_hold": "Keep the card in frame",
            "scan_status_lost": "Card lost — align it again",
            "scan_status_countdown_hint": "Countdown starts once the document is recognized twice in a row.",
            "new_scan": "New Scan",
            "new_scan_help": "Discard this scan and open the camera for a new capture",
            "new_image": "New Image",
            "new_image_help": "Clear the current scan and return to the import screen",
            "zoom_in": "Zoom in",
            "zoom_out": "Zoom out",
            "zoom_reset": "Reset zoom",
            "status_import_ready": "Import an image — drag, paste, or browse for a file",
            "status_ready": "Ready",
            "status_scan_complete": "Scan complete — review the extracted fields",
            "status_scan_unreadable": "Image loaded but no ID fields could be read",
            "status_image_pasted": "Image pasted from clipboard",
            "status_paste_failed": "Nothing to paste — copy an image first (Upload Image mode)",
            "status_image_dropped": "Image imported",
            "status_drop_failed": "Could not import dropped file — use PNG, JPEG, or HEIC",
            "status_image_load_failed": "Could not open the selected image file",
            "status_json_copied": "JSON copied to clipboard",
            "status_camera_frame_frozen": "Camera frame frozen for OCR fixture export",
            "status_camera_frame_unavailable": "No camera frame is available yet",
            "status_fixture_exported": "OCR fixture exported: %@",
            "status_fixture_export_failed": "Could not export OCR fixture: %@",
            "status_sync_failed": "Sync failed: %@",
            "status_camera_ready": "Camera ready — align the ID card",
            "status_capture_cancelled": "Capture cancelled",
            "status_open_browser": "Open in browser"
        ]
        let it = [
            "scan_mode": "Modalità Scansione",
            "live_camera": "Fotocamera Live",
            "selected_camera": "Fotocamera selezionata",
            "camera_menu": "Fotocamera",
            "camera_menu_unavailable": "Nessuna fotocamera disponibile",
            "upload_image": "Carica Immagine",
            "select_file": "Seleziona File...",
            "paste_image": "Incolla Immagine",
            "export_ocr_fixture": "Esporta fixture OCR...",
            "freeze_camera_frame": "Blocca fotogramma camera",
            "freeze_camera_frame_help": "Blocca il fotogramma camera corrente per esportarlo come fixture OCR",
            "fixture_target": "Target fixture",
            "fixture_condition": "Condizione fixture",
            "reset": "Ripristina",
            "camera_denied": "Accesso Fotocamera Negato",
            "camera_denied_desc": "Abilita i permessi della fotocamera nelle Impostazioni di Sistema > Privacy e Sicurezza.",
            "detected_data": "DATI RILEVATI",
            "awaiting_scan_title": "Nessuna scansione",
            "awaiting_scan_body": "Carica o scansiona una carta d'identità italiana per vedere qui i campi estratti.",
            "fields": "Campi Estratti",
            "json_output": "Output JSON",
            "raw_ocr": "Testo OCR Rilevato",
            "settings": "Impostazioni",
            "save": "Salva",
            "close": "Chiudi",
            "pref_title": "Preferenze",
            "pref_json": "Mostra Opzioni JSON",
            "pref_auto_create": "Crea Automaticamente Cartella Paziente",
            "pref_confirm": "Chiedi Conferma prima di Creare",
            "pref_open_browser": "Apri Cartella nel Browser",
            "pref_lang": "Lingua Applicazione",
            "pref_server": "URL Server Sorriso",
            "pref_token": "Chiave API / Token",
            "confirm_dialog_title": "Creare Cartella Paziente?",
            "confirm_dialog_body": "Vuoi aggiungere una nuova cartella paziente per %@ %@ in Sorriso?",
            "confirm_update_title": "Aggiornare Cartella Paziente?",
            "confirm_update_body": "Vuoi aggiornare la cartella paziente esistente di %@ %@ in Sorriso con i dati mancanti rilevati?",
            "update": "Aggiorna",
            "sync_create_button": "Crea una cartella paziente in Sorriso",
            "sync_update_button": "Aggiorna la cartella paziente in Sorriso",
            "sync_progress_create": "Creazione cartella paziente in corso...",
            "sync_progress_update": "Aggiornamento cartella paziente in corso...",
            "sync_success_create": "Cartella paziente creata con successo!",
            "sync_success_update": "Cartella paziente aggiornata con successo!",
            "sync_open_record_button": "Apri cartella paziente in Sorriso",
            "create_success": "Cartella paziente creata con successo!",
            "create_fail": "Impossibile creare cartella: %@",
            "create": "Crea",
            "cancel": "Annulla",
            "copy_json": "Copia JSON",
            "copied": "Copiato!",
            "field_surname": "Cognome",
            "field_name": "Nome",
            "field_cf": "Codice Fiscale",
            "field_doc_num": "Documento",
            "field_dob": "Data Nascita",
            "field_pob": "Luogo Nascita",
            "field_sex": "Sesso",
            "field_expiry": "Scadenza",
            "field_nationality": "Cittadinanza",
            "field_card_num": "Numero Tessera (Retro TS)",
            "contact_fields": "Contatti (opzionale)",
            "field_email": "Email",
            "field_phone": "Telefono",
            "version": "Versione",
            "check_for_updates": "Controlla aggiornamenti",
            "checking_for_updates": "Controllo aggiornamenti in corso...",
            "up_to_date": "La versione è aggiornata.",
            "update_available_title": "Aggiornamento disponibile",
            "update_available_body": "È disponibile la versione %@ di ScanID.",
            "download_update": "Scarica aggiornamento",
            "later": "Più tardi",
            "update_check_failed": "Controllo aggiornamenti non riuscito.",
            "update_install_failed": "Installazione aggiornamento non riuscita",
            "update_install_missing_file": "Il file dell'aggiornamento non è disponibile. Scaricalo di nuovo.",
            "pref_check_updates": "Controlla automaticamente gli aggiornamenti",
            "new_version_available": "Nuova versione disponibile",
            "welcome_title": "Controllare automaticamente gli aggiornamenti?",
            "welcome_body": "Vuoi che ScanID controlli automaticamente la disponibilità di aggiornamenti? Puoi sempre controllare manualmente dalle Impostazioni.",
            "welcome_auto_download": "Scarica e installa automaticamente gli aggiornamenti",
            "welcome_dont_check": "Non controllare",
            "welcome_check_automatically": "Controlla automaticamente",
            "settings_sidebar_general": "Generali",
            "settings_sidebar_camera": "Fotocamera",
            "settings_sidebar_detection": "Rilevamento",
            "settings_sidebar_sorriso": "Sorriso",
            "settings_sidebar_updates": "Aggiornamenti",
            "settings_sidebar_developer": "Sviluppatore",
            "settings_general_subtitle": "Preferenze di lingua dell'app.",
            "settings_developer_subtitle": "Opzioni avanzate di debug ed esportazione.",
            "settings_camera_subtitle": "Modalità all'avvio, acquisizione e fotocamera iPhone.",
            "settings_detection_subtitle": "Controlla quali testi OCR evidenziare e come inquadrare le acquisizioni.",
            "pref_detect_only_expected": "Rileva solo i campi attesi",
            "pref_detect_only_expected_desc": "Nasconde i riquadri per il testo che non corrisponde a un campo riconosciuto.",
            "pref_auto_zoom": "Zoom automatico",
            "pref_auto_zoom_desc": "Dopo l'acquisizione, ritaglia ai bordi della tessera e riesegue l'OCR in alta qualità sul ritaglio.",
            "settings_camera_startup_group": "Avvio",
            "settings_camera_capture_group": "Acquisizione",
            "settings_sorriso_subtitle": "Collega ScanID al server Sorriso e gestisci la sincronizzazione.",
            "settings_updates_subtitle": "Mantieni ScanID aggiornato con controlli automatici o manuali.",
            "settings_connection_group": "Connessione",
            "settings_sync_group": "Sincronizzazione pazienti",
            "settings_updates_group": "Aggiornamenti automatici",
            "settings_last_checked": "Ultimo controllo: %@",
            "pref_lang_desc": "Lingua dell'interfaccia per etichette e messaggi.",
            "pref_json_desc": "Mostra azioni per copiare e salvare JSON e testo OCR.",
            "pref_server_desc": "URL base della tua installazione Sorriso.",
            "pref_token_desc": "Chiave API inviata come x-api-key per creare o aggiornare pazienti.",
            "pref_token_show": "Mostra token",
            "pref_token_hide": "Nascondi token",
            "pref_auto_create_desc": "Invia i pazienti scansionati a Sorriso subito dopo la scansione.",
            "pref_confirm_desc": "Mostra una conferma prima di creare o aggiornare una cartella.",
            "pref_open_browser_desc": "Apri la cartella paziente nel browser dopo la sincronizzazione.",
            "pref_check_updates_desc": "Controlla una volta al giorno all'avvio se esiste una nuova versione.",
            "pref_auto_download_desc": "Scarica e propone l'installazione degli aggiornamenti automaticamente.",
            "pref_default_scan_mode": "Modalità scansione predefinita",
            "pref_default_scan_mode_desc": "Modalità mostrata all'apertura di ScanID.",
            "pref_remember_last_camera": "Ricorda ultima fotocamera",
            "pref_remember_last_camera_desc": "Riapre ScanID con la fotocamera usata l'ultima volta.",
            "pref_require_capture_approval": "Richiedi conferma per avviare la scansione",
            "pref_require_capture_approval_desc": "Mostra un pulsante Avvia scansione prima di rilevare la carta. Se disattivato, il rilevamento parte automaticamente.",
            "capture_approval_title": "Pronto per la scansione",
            "capture_approval_body": "Posiziona la carta d'identità nell'inquadratura, poi avvia la scansione quando sei pronto.",
            "capture_approval_button": "Avvia scansione",
            "pref_auto_countdown": "Conto alla rovescia prima della cattura",
            "pref_auto_countdown_desc": "Quando un documento è rilevato nell'inquadratura, attendi 3 secondi prima di confermare la scansione.",
            "image_import_help_title": "Importa un'immagine",
            "image_import_help_intro": "Usa una foto di una carta d'identità italiana — senza fotocamera.",
            "image_import_step_1": "Trascina un file PNG, JPEG o HEIC nell'area a sinistra.",
            "image_import_step_2": "Oppure clicca Sfoglia file... nell'area per scegliere un'immagine dal disco.",
            "image_import_step_3": "Oppure incolla dagli appunti con Incolla Immagine nella barra strumenti (⌘V).",
            "image_import_step_4": "Fronte o retro — sono supportate Carta d'Identità (CIE) e Tessera Sanitaria.",
            "image_import_tip": "Per risultati migliori usa una foto piatta, ben illuminata, con tutta la carta visibile.",
            "continuity_camera_help_title": "Usa iPhone come fotocamera",
            "continuity_camera_help_intro": "Scansiona con la fotocamera dell'iPhone — senza trasferire foto.",
            "continuity_camera_step_1": "Posizionare lo scanner di fianco al portatile",
            "continuity_camera_step_2": "Posizionare la carta di identità.",
            "continuity_camera_step_3": "Sblocca il telefono e posizionalo sullo scanner.",
            "continuity_camera_step_4": "Attiva la scansione se non è impostata per partire in automatico",
            "continuity_camera_tip": "Crea/Aggiorna la cartella.",
            "countdown_hold_still": "Resta fermo…",
            "scan_status_title_waiting": "Pronto per la scansione",
            "scan_status_title_adjust": "Regola la carta",
            "scan_status_title_ready": "Documento rilevato",
            "scan_status_waiting": "Allinea la carta d'identità nel riquadro",
            "scan_status_move_closer": "Avvicinati — testo insufficiente",
            "scan_status_align_document": "Centra la carta e riduci i riflessi",
            "scan_status_need_identity": "Mostra più chiaramente nome, cognome o codice fiscale",
            "scan_status_need_names": "Mostra più chiaramente nome e cognome",
            "scan_status_sharpen_text": "Avvicinati e metti a fuoco il testo",
            "scan_status_reading_fields": "Lettura campi — resta fermo",
            "scan_status_ready": "Documento riconosciuto — avvio conto alla rovescia",
            "scan_status_capturing": "Acquisizione in corso…",
            "scan_status_countdown": "Resta fermo per il conto alla rovescia",
            "scan_status_hold": "Tieni la carta nell'inquadratura",
            "scan_status_lost": "Carta persa — allineala di nuovo",
            "scan_status_countdown_hint": "Il conto alla rovescia parte quando il documento è riconosciuto due volte di seguito.",
            "new_scan": "Nuova scansione",
            "new_scan_help": "Scarta questa scansione e riapri la fotocamera per una nuova acquisizione",
            "new_image": "Nuova immagine",
            "new_image_help": "Cancella la scansione corrente e torna alla schermata di importazione",
            "zoom_in": "Ingrandisci",
            "zoom_out": "Riduci",
            "zoom_reset": "Reimposta zoom",
            "status_import_ready": "Importa un'immagine — trascina, incolla o sfoglia un file",
            "status_ready": "Pronto",
            "status_scan_complete": "Scansione completata — controlla i campi estratti",
            "status_scan_unreadable": "Immagine caricata ma nessun campo ID leggibile",
            "status_image_pasted": "Immagine incollata dagli appunti",
            "status_paste_failed": "Niente da incollare — copia prima un'immagine (modalità Carica Immagine)",
            "status_image_dropped": "Immagine importata",
            "status_drop_failed": "Impossibile importare il file — usa PNG, JPEG o HEIC",
            "status_image_load_failed": "Impossibile aprire il file immagine selezionato",
            "status_json_copied": "JSON copiato negli appunti",
            "status_camera_frame_frozen": "Fotogramma camera bloccato per esportazione fixture OCR",
            "status_camera_frame_unavailable": "Nessun fotogramma camera ancora disponibile",
            "status_fixture_exported": "Fixture OCR esportata: %@",
            "status_fixture_export_failed": "Impossibile esportare la fixture OCR: %@",
            "status_sync_failed": "Sincronizzazione non riuscita: %@",
            "status_camera_ready": "Fotocamera pronta — allinea la carta d'identità",
            "status_capture_cancelled": "Acquisizione annullata",
            "status_open_browser": "Apri nel browser"
        ]
        let dict = (lang == "it" ? it : en)
        return dict[key] ?? key
    }
}

// MARK: - Update Downloader

class UpdateDownloader: NSObject, URLSessionDownloadDelegate {
    var onProgress: ((Double) -> Void)?
    var onCompletion: ((URL?, Error?) -> Void)?
    
    private var session: URLSession?
    private var task: URLSessionDownloadTask?
    
    override init() {
        super.init()
        let config = URLSessionConfiguration.default
        self.session = URLSession(configuration: config, delegate: self, delegateQueue: .main)
    }
    
    func startDownload(url: URL) {
        task = session?.downloadTask(with: url)
        task?.resume()
    }
    
    func cancel() {
        task?.cancel()
        task = nil
    }
    
    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64, totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
        if totalBytesExpectedToWrite > 0 {
            let progress = Double(totalBytesWritten) / Double(totalBytesExpectedToWrite)
            onProgress?(progress)
        }
    }
    
    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
        guard let originalUrl = downloadTask.originalRequest?.url else {
            onCompletion?(nil, NSError(domain: "UpdateError", code: -1, userInfo: [NSLocalizedDescriptionKey: "No request URL"]))
            return
        }
        
        let ext = originalUrl.pathExtension.isEmpty ? "dmg" : originalUrl.pathExtension
        let tempDir = FileManager.default.temporaryDirectory
        let destinationUrl = tempDir.appendingPathComponent("ScanID-Update.\(ext)")
        
        try? FileManager.default.removeItem(at: destinationUrl)
        
        do {
            try FileManager.default.moveItem(at: location, to: destinationUrl)
            UpdateInstaller.stripQuarantine(at: destinationUrl)
            onCompletion?(destinationUrl, nil)
        } catch {
            onCompletion?(nil, error)
        }
    }
    
    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let error = error {
            onCompletion?(nil, error)
        }
    }
}
