import SwiftUI
import AVFoundation
import UniformTypeIdentifiers
import AppKit

struct MainView: View {
    @StateObject private var cameraManager = CameraManager()
    @State private var scanMode: ScanMode = .camera
    @State private var selectedImage: NSImage?
    @State private var cgImageForOCR: CGImage?
    @State private var recognizedItems: [RecognizedItem] = []
    @State private var parsedData: IDData = IDData(documentType: "UNKNOWN", rawText: [])
    @State private var isDragging = false
    @State private var copied = false
    @State private var animatingScanLine = false
    @State private var captureState: CaptureState = .idle
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
    @AppStorage("lastUpdateCheck") private var lastUpdateCheck: Double = 0
    
    // Interactive UI State
    @State private var isShowingSettings = false
    @State private var showingConfirmationAlert = false
    @State private var pendingPatientToCreate: PendingPatient? = nil
    @State private var syncStatus: SyncStatus = .idle
    @State private var pendingUpdate: PendingUpdate? = nil
    @State private var isCheckingForUpdates = false
    
    // Update downloading state
    @State private var downloadProgress: Double = 0.0
    @State private var isDownloading = false
    @State private var downloadError: String? = nil
    @State private var downloadedFileUrl: URL? = nil
    @State private var downloader: UpdateDownloader? = nil
    
    struct PendingPatient: Identifiable {
        let id = UUID()
        let firstName: String
        let lastName: String
        let birthDate: String?
        let gender: String?
        let codiceFiscale: String?
    }
    
    struct PendingUpdate: Identifiable {
        let id = UUID()
        let version: String
        let downloadUrl: String
        let notes: String?
    }
    
    enum CaptureState {
        case idle
        case scanning
        case captured
    }
    
    enum ScanMode {
        case camera
        case image
    }
    
    enum SyncStatus {
        case idle
        case syncing
        case success(patientId: String)
        case failure(error: String)
    }
    
    var body: some View {
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
                        } else {
                            // 16:9 Aspect Ratio Constrained Container - Resizes and aligns perfectly!
                            ZStack {
                                CameraPreviewView(cameraManager: cameraManager)
                                
                                // Interactive scanning HUD guide box
                                DocumentGuideOverlay(lang: appLanguage)
                                    .padding(24)
                                
                                // Bounding boxes from live OCR
                                GeometryReader { geo in
                                    ForEach(recognizedItems) { item in
                                        let rect = mapBoundingBox(item.boundingBox, to: geo.size)
                                        boundingBoxMenu(for: item, rect: rect)
                                            .position(x: rect.midX, y: rect.midY)
                                    }
                                }
                                
                                // Scanning Beam animation - only works when card is in frame
                                if captureState == .scanning {
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
                    } else {
                        // Image upload mode
                        ZStack {
                            if let selectedImage = selectedImage {
                                Image(nsImage: selectedImage)
                                    .resizable()
                                    .aspectRatio(contentMode: .fit)
                                    .cornerRadius(12)
                                    .padding(12)
                                    .overlay(
                                        GeometryReader { geo in
                                            let contentRect = fitRect(for: selectedImage.size, in: geo.size)
                                            ForEach(recognizedItems) { item in
                                                let rect = mapBoundingBox(item.boundingBox, to: contentRect.size)
                                                boundingBoxMenu(for: item, rect: rect)
                                                    .position(x: rect.midX + contentRect.origin.x, y: rect.midY + contentRect.origin.y)
                                            }
                                        }
                                    )
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
            VStack(spacing: 0) {
                // Header Metadata
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
                            .disabled(parsedData.documentType == "UNKNOWN" && parsedData.rawText.isEmpty)
                            
                            Button(action: saveJSON) {
                                Label(appLanguage == "it" ? "Salva File..." : "Save File...", systemImage: "square.and.arrow.down")
                            }
                            .buttonStyle(.borderedProminent)
                            .disabled(parsedData.documentType == "UNKNOWN" && parsedData.rawText.isEmpty)
                        }
                    }
                }
                .padding()
                .background(VisualEffectView(material: .headerView, blendingMode: .withinWindow))
                
                Divider()
                
                // Sync Status Banner
                syncStatusBanner()
                
                ScrollView {
                    VStack(spacing: 20) {
                        // Table View of Fields
                        VStack(alignment: .leading, spacing: 10) {
                            Text(Localization.string(key: "fields", lang: appLanguage))
                                .font(.headline)
                                .padding(.horizontal)
                            
                            VStack(spacing: 0) {
                                FieldRow(label: Localization.string(key: "field_surname", lang: appLanguage), value: parsedData.surname, icon: "person.text.rectangle")
                                FieldRow(label: Localization.string(key: "field_name", lang: appLanguage), value: parsedData.name, icon: "person")
                                FieldRow(label: Localization.string(key: "field_cf", lang: appLanguage), value: parsedData.codiceFiscale, icon: "number.square", highlight: true)
                                FieldRow(label: Localization.string(key: "field_doc_num", lang: appLanguage), value: parsedData.documentNumber, icon: "doc.text.fill")
                                FieldRow(label: Localization.string(key: "field_dob", lang: appLanguage), value: parsedData.dateOfBirth, icon: "calendar")
                                FieldRow(label: Localization.string(key: "field_pob", lang: appLanguage), value: parsedData.placeOfBirth, icon: "mappin.and.ellipse")
                                FieldRow(label: Localization.string(key: "field_sex", lang: appLanguage), value: parsedData.gender, icon: "figure.male.female")
                                FieldRow(label: Localization.string(key: "field_expiry", lang: appLanguage), value: parsedData.expiryDate, icon: "calendar.badge.exclamationmark")
                                FieldRow(label: Localization.string(key: "field_nationality", lang: appLanguage), value: parsedData.nationality, icon: "globe")
                                if let cardNum = parsedData.cardNumber {
                                    FieldRow(label: Localization.string(key: "field_card_num", lang: appLanguage), value: cardNum, icon: "creditcard")
                                }
                            }
                            .background(Color(nsColor: .controlBackgroundColor))
                            .cornerRadius(8)
                            .padding(.horizontal)
                        }
                        .padding(.top)
                        
                        // Manual Sync Trigger Button
                        if parsedData.documentType != "UNKNOWN" {
                            if case .success = syncStatus {
                                // Synced successfully
                            } else {
                                Button(action: {
                                    let fName = parsedData.name ?? "Sconosciuto"
                                    let lName = parsedData.surname ?? "Sconosciuto"
                                    
                                    if askConfirmation {
                                        self.pendingPatientToCreate = PendingPatient(
                                            firstName: fName,
                                            lastName: lName,
                                            birthDate: parsedData.dateOfBirth,
                                            gender: parsedData.gender,
                                            codiceFiscale: parsedData.codiceFiscale
                                        )
                                        self.showingConfirmationAlert = true
                                    } else {
                                        self.triggerPatientCreation(
                                            firstName: fName,
                                            lastName: lName,
                                            birthDate: parsedData.dateOfBirth,
                                            gender: parsedData.gender,
                                            codiceFiscale: parsedData.codiceFiscale
                                        )
                                    }
                                }) {
                                    Label(
                                        appLanguage == "it" ? "Crea una cartella paziente in Sorriso" : "Create a patient record in Sorriso",
                                        systemImage: "person.badge.plus"
                                    )
                                    .padding(.vertical, 4)
                                }
                                .buttonStyle(.borderedProminent)
                                .controlSize(.large)
                                .padding(.horizontal)
                            }
                        }
                        
                        if showJsonOptions {
                            // JSON Code Panel
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
                            
                            // Raw OCR Lines Panel
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
            .frame(minWidth: 400, maxWidth: .infinity)
        }
        .frame(minWidth: 900, minHeight: 600)
        // Native macOS Toolbar Integration
        .toolbar {
            ToolbarItem(placement: .navigation) {
                Picker(Localization.string(key: "scan_mode", lang: appLanguage), selection: $scanMode) {
                    Label(Localization.string(key: "live_camera", lang: appLanguage), systemImage: "camera.fill").tag(ScanMode.camera)
                    Label(Localization.string(key: "upload_image", lang: appLanguage), systemImage: "photo.on.rectangle.angled").tag(ScanMode.image)
                }
                .pickerStyle(.segmented)
                .frame(width: 250)
            }
            
            if scanMode == .camera {
                ToolbarItem(placement: .navigation) {
                    if !cameraManager.devices.isEmpty {
                        Picker("", selection: Binding(
                            get: { cameraManager.selectedDevice },
                            set: { device in
                                if let device = device {
                                    cameraManager.changeCamera(to: device)
                                }
                            }
                        )) {
                            ForEach(cameraManager.devices, id: \.uniqueID) { device in
                                Text(device.localizedName).tag(Optional(device))
                            }
                        }
                        .frame(width: 150)
                    }
                }
            }
            
            ToolbarItemGroup(placement: .primaryAction) {
                if scanMode == .image {
                    Button(action: importImage) {
                        Label(Localization.string(key: "select_file", lang: appLanguage), systemImage: "folder.badge.plus")
                    }
                    .help(Localization.string(key: "select_file", lang: appLanguage))
                    
                    Button(action: pasteFromClipboard) {
                        Label(Localization.string(key: "paste_image", lang: appLanguage), systemImage: "doc.on.clipboard")
                    }
                    .help(Localization.string(key: "paste_image", lang: appLanguage))
                }
                
                Button(action: resetAll) {
                    Label(Localization.string(key: "reset", lang: appLanguage), systemImage: "arrow.counterclockwise")
                }
                .help(Localization.string(key: "reset", lang: appLanguage))
                
                Button(action: { isShowingSettings = true }) {
                    Label(Localization.string(key: "settings", lang: appLanguage), systemImage: "gearshape")
                }
                .help(Localization.string(key: "settings", lang: appLanguage))
                .keyboardShortcut(",", modifiers: .command) // Native Cmd+, keyboard shortcut!
            }
        }
        .onAppear {
            if serverUrl == "http://localhost:3000" {
                serverUrl = "https://sorrisosplendente.com"
            }
            setupCameraFrameCallback()
            if scanMode == .camera {
                cameraManager.startSession()
            }
            
            // Background update check (throttled to ~once per day)
            if checkForUpdatesAutomatically {
                let now = Date().timeIntervalSince1970
                if now - lastUpdateCheck > 86_400 { // 24 hours
                    checkForUpdates(silent: true)
                }
            }
        }
        .onDisappear {
            cameraManager.stopSession()
        }
        .onChange(of: scanMode) { oldMode, newMode in
            resetAllStateOnly()
            if newMode == .camera {
                cameraManager.startSession()
            } else {
                cameraManager.stopSession()
            }
        }
        .sheet(isPresented: $isShowingSettings) {
            SettingsView(isPresented: $isShowingSettings, pendingUpdate: $pendingUpdate)
        }
        .sheet(item: $pendingUpdate) { update in
            UpdateAvailableSheet(
                update: update,
                appLanguage: appLanguage,
                isDownloading: isDownloading,
                downloadProgress: downloadProgress,
                downloadError: downloadError,
                downloadedFileUrl: downloadedFileUrl,
                onDownload: {
                    if let url = URL(string: update.downloadUrl) {
                        startUpdateDownload(url: url)
                    }
                },
                onInstall: {
                    if let fileUrl = downloadedFileUrl {
                        installAndRelaunch(downloadedFile: fileUrl)
                    }
                },
                onLater: {
                    downloader?.cancel()
                    isDownloading = false
                    downloadProgress = 0.0
                    downloadError = nil
                    downloadedFileUrl = nil
                    downloader = nil
                    pendingUpdate = nil
                }
            )
        }
        .alert(
            Localization.string(key: "confirm_dialog_title", lang: appLanguage),
            isPresented: $showingConfirmationAlert,
            presenting: pendingPatientToCreate
        ) { details in
            Button(Localization.string(key: "create", lang: appLanguage)) {
                self.triggerPatientCreation(
                    firstName: details.firstName,
                    lastName: details.lastName,
                    birthDate: details.birthDate,
                    gender: details.gender,
                    codiceFiscale: details.codiceFiscale
                )
            }
            Button(Localization.string(key: "cancel", lang: appLanguage), role: .cancel) {
                self.pendingPatientToCreate = nil
            }
        } message: { details in
            Text(String(
                format: Localization.string(key: "confirm_dialog_body", lang: appLanguage),
                details.firstName,
                details.lastName
            ))
        }
    }
    
    // MARK: - Subviews
    
    @ViewBuilder
    private func syncStatusBanner() -> some View {
        switch syncStatus {
        case .syncing:
            HStack {
                ProgressView()
                    .controlSize(.small)
                Text(appLanguage == "it" ? "Sincronizzazione in corso..." : "Synchronizing patient file...")
                    .font(.subheadline)
                    .foregroundColor(.primary)
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.orange.opacity(0.15))
            
        case .success(let patientId):
            HStack {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.green)
                Text(appLanguage == "it" ? "Sincronizzato con successo!" : "Patient file created successfully!")
                    .font(.subheadline)
                    .foregroundColor(.green)
                Spacer()
                Button(action: {
                    if let url = URL(string: "\(serverUrl)/pazienti/\(patientId)") {
                        NSWorkspace.shared.open(url)
                    }
                }) {
                    Text(appLanguage == "it" ? "Apri nel Browser" : "Open in Browser")
                        .underline()
                }
                .buttonStyle(.plain)
                .foregroundColor(.blue)
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.green.opacity(0.1))
            
        case .failure(let error):
            HStack {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundColor(.red)
                Text((appLanguage == "it" ? "Impossibile sincronizzare: " : "Sync failed: ") + error)
                    .font(.subheadline)
                    .foregroundColor(.red)
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.red.opacity(0.1))
            
        case .idle:
            EmptyView()
        }
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
    
    private func setupCameraFrameCallback() {
        cameraManager.onFrameCaptured = { pixelBuffer in
            guard scanMode == .camera else { return }
            
            // Skip processing if we already captured
            guard captureState != .captured else { return }
            
            IDScanner.recognizeTextInLiveBuffer(pixelBuffer) { items in
                let sortedItems = items.sorted { item1, item2 in
                    let yDiff = abs(item1.boundingBox.midY - item2.boundingBox.midY)
                    if yDiff < 0.03 {
                        return item1.boundingBox.minX < item2.boundingBox.minX
                    }
                    return item1.boundingBox.midY > item2.boundingBox.midY
                }
                self.recognizedItems = sortedItems
                
                if sortedItems.isEmpty {
                    if self.captureState != .idle {
                        self.captureState = .idle
                    }
                } else {
                    if self.captureState == .idle {
                        self.captureState = .scanning
                    }
                    
                    if self.captureState == .scanning {
                        self.playSubtleScanSound()
                    }
                    
                    let textLines = sortedItems.map { $0.text }
                    let parsed = IDParser.parse(lines: textLines)
                    
                    // Verify if capture succeeded (has correct document type and name/surname or tax code)
                    if parsed.documentType != "UNKNOWN" && (parsed.surname != nil || parsed.codiceFiscale != nil) {
                        self.parsedData = parsed
                        self.captureState = .captured
                        self.playSuccessSound()
                        
                        // Handle auto sync
                        if self.autoCreatePatient {
                            let fName = parsed.name ?? "Sconosciuto"
                            let lName = parsed.surname ?? "Sconosciuto"
                            
                            if self.askConfirmation {
                                self.pendingPatientToCreate = PendingPatient(
                                    firstName: fName,
                                    lastName: lName,
                                    birthDate: parsed.dateOfBirth,
                                    gender: parsed.gender,
                                    codiceFiscale: parsed.codiceFiscale
                                )
                                self.showingConfirmationAlert = true
                            } else {
                                self.triggerPatientCreation(
                                    firstName: fName,
                                    lastName: lName,
                                    birthDate: parsed.dateOfBirth,
                                    gender: parsed.gender,
                                    codiceFiscale: parsed.codiceFiscale
                                )
                            }
                        }
                    }
                }
            }
        }
    }
    
    private func cropToCenter(_ image: NSImage, ratio: CGFloat = 0.5) -> NSImage {
        guard let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
            return image
        }
        
        let width = CGFloat(cgImage.width)
        let height = CGFloat(cgImage.height)
        
        let cropWidth = width * ratio
        let cropHeight = height * ratio
        let cropX = (width - cropWidth) / 2
        let cropY = (height - cropHeight) / 2
        
        let cropRect = CGRect(x: cropX, y: cropY, width: cropWidth, height: cropHeight)
        
        guard let croppedCgImage = cgImage.cropping(to: cropRect) else {
            return image
        }
        
        return NSImage(cgImage: croppedCgImage, size: NSSize(width: cropWidth, height: cropHeight))
    }
    
    private func processStaticImage(_ nsImage: NSImage) {
        guard let cgImage = nsImage.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return }
        self.selectedImage = nsImage
        self.cgImageForOCR = cgImage
        
        IDScanner.recognizeText(in: cgImage) { items in
            let sortedItems = items.sorted { item1, item2 in
                let yDiff = abs(item1.boundingBox.midY - item2.boundingBox.midY)
                if yDiff < 0.03 {
                    return item1.boundingBox.minX < item2.boundingBox.minX
                }
                return item1.boundingBox.midY > item2.boundingBox.midY
            }
            self.recognizedItems = sortedItems
            let textLines = sortedItems.map { $0.text }
            var parsed = IDParser.parse(lines: textLines)
            parsed.calculateCodiceFiscaleIfPossible()
            self.parsedData = parsed
            
            if parsed.documentType != "UNKNOWN" {
                self.captureState = .captured
                self.playSuccessSound()
                
                // Handle auto sync for static images
                if self.autoCreatePatient {
                    let fName = parsed.name ?? "Sconosciuto"
                    let lName = parsed.surname ?? "Sconosciuto"
                    
                    if self.askConfirmation {
                        self.pendingPatientToCreate = PendingPatient(
                            firstName: fName,
                            lastName: lName,
                            birthDate: parsed.dateOfBirth,
                            gender: parsed.gender,
                            codiceFiscale: parsed.codiceFiscale
                        )
                        self.showingConfirmationAlert = true
                    } else {
                        self.triggerPatientCreation(
                            firstName: fName,
                            lastName: lName,
                            birthDate: parsed.dateOfBirth,
                            gender: parsed.gender,
                            codiceFiscale: parsed.codiceFiscale
                        )
                    }
                }
            } else {
                self.captureState = .idle
            }
        }
    }
    
    private func resetAllStateOnly() {
        selectedImage = nil
        cgImageForOCR = nil
        recognizedItems = []
        parsedData = IDData(documentType: "UNKNOWN", rawText: [])
        captureState = .idle
        syncStatus = .idle
        pendingPatientToCreate = nil
    }
    
    private func resetAll() {
        resetAllStateOnly()
        if scanMode == .camera {
            cameraManager.stopSession()
            cameraManager.startSession()
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
    
    // MARK: - Sync API Calls
    
    private func triggerPatientCreation(firstName: String, lastName: String, birthDate: String?, gender: String?, codiceFiscale: String?) {
        self.syncStatus = .syncing
        
        createPatientInWebApp(
            firstName: firstName,
            lastName: lastName,
            birthDate: birthDate,
            gender: gender,
            codiceFiscale: codiceFiscale
        ) { result in
            DispatchQueue.main.async {
                switch result {
                case .success(let patientId):
                    self.syncStatus = .success(patientId: patientId)
                    
                    if self.openInBrowser {
                        if let patientUrl = URL(string: "\(self.serverUrl)/pazienti/\(patientId)") {
                            NSWorkspace.shared.open(patientUrl)
                        }
                    }
                case .failure(let error):
                    self.syncStatus = .failure(error: error.localizedDescription)
                }
            }
        }
    }
    
    private func createPatientInWebApp(firstName: String, lastName: String, birthDate: String?, gender: String?, codiceFiscale: String?, completion: @escaping (Result<String, Error>) -> Void) {
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
            "email": nil,
            "phone": nil,
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
    
    private func checkForUpdates(silent: Bool = false) {
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
                            self.pendingUpdate = PendingUpdate(
                                version: remoteVersion,
                                downloadUrl: downloadUrl,
                                notes: json["notes"] as? String
                            )
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
            }
        }
        self.downloader = dl
        dl.startDownload(url: url)
    }
    
    private func installAndRelaunch(downloadedFile: URL) {
        let currentAppPath = Bundle.main.bundlePath
        let pid = ProcessInfo.processInfo.processIdentifier
        
        let tempDir = FileManager.default.temporaryDirectory
        let scriptUrl = tempDir.appendingPathComponent("install-scanid-update.sh")
        
        let scriptContent = """
        #!/bin/bash
        PID=\(pid)
        CURRENT_APP_PATH="\(currentAppPath)"
        DOWNLOADED_FILE="\(downloadedFile.path)"
        MOUNT_POINT="/Volumes/ScanID"

        # Wait for parent PID to exit
        while kill -0 "$PID" 2>/dev/null; do
            sleep 0.2
        done

        # Check if downloaded file is DMG or ZIP
        if [[ "$DOWNLOADED_FILE" == *.dmg ]]; then
            # Mount DMG and find mount point dynamically
            MOUNT_INFO=$(hdiutil attach -nobrowse -readonly "$DOWNLOADED_FILE")
            MOUNT_POINT=$(echo "$MOUNT_INFO" | grep -o '/Volumes/.*' | head -n 1 | xargs)
            
            if [ -n "$MOUNT_POINT" ] && [ -d "$MOUNT_POINT" ]; then
                NEW_APP=$(find "$MOUNT_POINT" -name "*.app" -maxdepth 2 -type d | head -n 1)
                if [ -d "$NEW_APP" ]; then
                    # Replace app
                    rm -rf "$CURRENT_APP_PATH"
                    cp -R "$NEW_APP" "$CURRENT_APP_PATH"
                fi
                # Detach DMG
                hdiutil detach "$MOUNT_POINT" -force
            fi
        elif [[ "$DOWNLOADED_FILE" == *.zip ]]; then
            # Unzip to a temporary folder
            TMP_UNZIP_DIR=$(mktemp -d)
            unzip -q "$DOWNLOADED_FILE" -d "$TMP_UNZIP_DIR"
            # Find ScanID.app in the unzipped files (ignoring resource forks like __MACOSX)
            NEW_APP=$(find "$TMP_UNZIP_DIR" -name "ScanID.app" -type d -maxdepth 3 | grep -v "__MACOSX" | head -n 1)
            if [ -d "$NEW_APP" ]; then
                # Replace app
                rm -rf "$CURRENT_APP_PATH"
                cp -R "$NEW_APP" "$CURRENT_APP_PATH"
            fi
            rm -rf "$TMP_UNZIP_DIR"
        fi

        # Relaunch the app
        open "$CURRENT_APP_PATH"

        # Delete this script
        rm -- "$0"
        """
        
        do {
            try scriptContent.write(to: scriptUrl, atomically: true, encoding: .utf8)
            
            // Make executable
            let chmodProcess = Process()
            chmodProcess.executableURL = URL(fileURLWithPath: "/bin/chmod")
            chmodProcess.arguments = ["+x", scriptUrl.path]
            try chmodProcess.run()
            chmodProcess.waitUntilExit()
            
            // Run the script in background
            let scriptProcess = Process()
            scriptProcess.executableURL = URL(fileURLWithPath: "/bin/bash")
            scriptProcess.arguments = [scriptUrl.path]
            try scriptProcess.run()
            
            // Terminate the app
            NSApplication.shared.terminate(nil)
        } catch {
            print("Failed to run updater script: \(error)")
        }
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
            }
        }
    }
    
    private func pasteFromClipboard() {
        let pasteboard = NSPasteboard.general
        if let image = NSImage(pasteboard: pasteboard) {
            processStaticImage(image)
        }
    }
    
    private func handleDrop(providers: [NSItemProvider]) -> Bool {
        guard let provider = providers.first else { return false }
        
        provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { item, error in
            guard let data = item as? Data,
                  let url = URL(dataRepresentation: data, relativeTo: nil),
                  let image = NSImage(contentsOf: url) else { return }
            
            DispatchQueue.main.async {
                self.processStaticImage(image)
            }
        }
        return true
    }
    
    private func copyJSON() {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(jsonString, forType: .string)
        copied = true
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
    
    // Update prefs (synced via same keys as MainView)
    @AppStorage("checkForUpdatesAutomatically") private var checkForUpdatesAutomatically = true
    @AppStorage("lastUpdateCheck") private var lastUpdateCheck: Double = 0
    
    @State private var activeTab: Tab = .general
    @State private var showToken = false
    @State private var isCheckingForUpdates = false
    
    enum Tab {
        case general
        case sorriso
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Tab Selection Header
            HStack(spacing: 20) {
                TabButton(
                    title: appLanguage == "it" ? "Generali" : "General",
                    icon: "gearshape",
                    isActive: activeTab == .general
                ) {
                    activeTab = .general
                }
                
                TabButton(
                    title: "Sorriso",
                    icon: "server.rack",
                    isActive: activeTab == .sorriso
                ) {
                    activeTab = .sorriso
                }
                
                Spacer()
            }
            .padding(.horizontal, 24)
            .padding(.top, 16)
            .padding(.bottom, 12)
            .background(VisualEffectView(material: .titlebar, blendingMode: .withinWindow))
            
            Divider()
            
            // Tab Content
            VStack {
                if activeTab == .general {
                    generalTab
                } else {
                    sorrisoTab
                }
            }
            .padding(24)
            .frame(maxHeight: .infinity)
            .background(VisualEffectView(material: .contentBackground, blendingMode: .withinWindow))
            
            Divider()
            
            // Footer
            HStack {
                Spacer()
                Button(Localization.string(key: "close", lang: appLanguage)) {
                    isPresented = false
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.regular)
                .keyboardShortcut(.defaultAction)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .background(VisualEffectView(material: .windowBackground, blendingMode: .withinWindow))
        }
        .frame(width: 480, height: 380)
    }
    
    private var generalTab: some View {
        Form {
            Picker(Localization.string(key: "pref_lang", lang: appLanguage), selection: $appLanguage) {
                Text("English").tag("en")
                Text("Italiano").tag("it")
            }
            .pickerStyle(.menu)
            .frame(width: 280)
            
            Toggle(Localization.string(key: "pref_json", lang: appLanguage), isOn: $showJsonOptions)
                .toggleStyle(.checkbox)
        }
    }
    
    private var sorrisoTab: some View {
        Form {
            Toggle(Localization.string(key: "pref_auto_create", lang: appLanguage), isOn: $autoCreatePatient)
                .toggleStyle(.checkbox)
            
            if autoCreatePatient {
                Toggle(Localization.string(key: "pref_confirm", lang: appLanguage), isOn: $askConfirmation)
                    .toggleStyle(.checkbox)
                    .padding(.leading, 20)
                
                Toggle(Localization.string(key: "pref_open_browser", lang: appLanguage), isOn: $openInBrowser)
                    .toggleStyle(.checkbox)
                    .padding(.leading, 20)
            }
            
            LabeledContent(Localization.string(key: "pref_server", lang: appLanguage)) {
                TextField("", text: $serverUrl)
                    .textFieldStyle(.roundedBorder)
            }
            
            LabeledContent(Localization.string(key: "pref_token", lang: appLanguage)) {
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
                            .foregroundColor(.secondary)
                    }
                    .buttonStyle(.plain)
                    .help(showToken ? "Hide token" : "Show token")
                }
            }
            
            // Update section
            Divider().padding(.vertical, 4)
            
            LabeledContent(Localization.string(key: "version", lang: appLanguage)) {
                Text(currentVersionString())
                    .font(.system(.body, design: .monospaced))
                    .foregroundColor(.secondary)
            }
            
            Toggle(Localization.string(key: "pref_check_updates", lang: appLanguage), isOn: $checkForUpdatesAutomatically)
                .toggleStyle(.checkbox)
            
            Button(action: { performUpdateCheckInSettings() }) {
                if isCheckingForUpdates {
                    HStack {
                        ProgressView().controlSize(.small)
                        Text(Localization.string(key: "checking_for_updates", lang: appLanguage))
                    }
                } else {
                    Label(Localization.string(key: "check_for_updates", lang: appLanguage), systemImage: "arrow.triangle.2.circlepath")
                }
            }
            .disabled(isCheckingForUpdates)
        }
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
                            // Dismiss settings to reveal update sheet in MainView
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

struct TabButton: View {
    let title: String
    let icon: String
    let isActive: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 18))
                    .foregroundColor(isActive ? .accentColor : .secondary)
                Text(title)
                    .font(.system(size: 11, weight: isActive ? .semibold : .regular))
                    .foregroundColor(isActive ? .primary : .secondary)
            }
            .frame(width: 64, height: 48)
            .background(isActive ? Color.secondary.opacity(0.12) : Color.clear)
            .cornerRadius(6)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Supporting Views

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

struct FieldRow: View {
    let label: String
    let value: String?
    let icon: String
    var highlight: Bool = false
    
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
            
            if let val = value, !val.isEmpty {
                Text(val)
                    .fontWeight(highlight ? .semibold : .regular)
                    .foregroundColor(highlight ? .cyan : .primary)
                
                Spacer()
                
                if isHovering {
                    Button(action: {
                        let pasteboard = NSPasteboard.general
                        pasteboard.clearContents()
                        pasteboard.setString(val, forType: .string)
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
            } else {
                Text("—")
                    .foregroundColor(.secondary.opacity(0.5))
                Spacer()
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
            "upload_image": "Upload Image",
            "select_file": "Select File...",
            "paste_image": "Paste Image",
            "reset": "Reset",
            "camera_denied": "Camera Access Denied",
            "camera_denied_desc": "Please enable Camera permissions for this app in System Settings > Privacy & Security.",
            "detected_data": "DETECTED DATA",
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
            "version": "Version",
            "check_for_updates": "Check for Updates",
            "checking_for_updates": "Checking for updates...",
            "up_to_date": "You are up to date.",
            "update_available_title": "Update Available",
            "update_available_body": "ScanID version %@ is available.",
            "download_update": "Download Update",
            "later": "Later",
            "update_check_failed": "Update check failed.",
            "pref_check_updates": "Automatically check for updates",
            "new_version_available": "New version available"
        ]
        let it = [
            "scan_mode": "Modalità Scansione",
            "live_camera": "Fotocamera Live",
            "upload_image": "Carica Immagine",
            "select_file": "Seleziona File...",
            "paste_image": "Incolla Immagine",
            "reset": "Ripristina",
            "camera_denied": "Accesso Fotocamera Negato",
            "camera_denied_desc": "Abilita i permessi della fotocamera nelle Impostazioni di Sistema > Privacy e Sicurezza.",
            "detected_data": "DATI RILEVATI",
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
            "version": "Versione",
            "check_for_updates": "Controlla aggiornamenti",
            "checking_for_updates": "Controllo aggiornamenti in corso...",
            "up_to_date": "La versione è aggiornata.",
            "update_available_title": "Aggiornamento disponibile",
            "update_available_body": "È disponibile la versione %@ di ScanID.",
            "download_update": "Scarica aggiornamento",
            "later": "Più tardi",
            "update_check_failed": "Controllo aggiornamenti non riuscito.",
            "pref_check_updates": "Controlla automaticamente gli aggiornamenti",
            "new_version_available": "Nuova versione disponibile"
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

