import SwiftUI
import AVFoundation
import AppKit
import CoreImage
import ImageIO

enum CameraPreferences {
    static let rememberLastCameraKey = "rememberLastCamera"
    static let lastCameraDeviceIDKey = "lastCameraDeviceID"
    
    static var rememberLastCamera: Bool {
        UserDefaults.standard.bool(forKey: rememberLastCameraKey)
    }
    
    static func saveLastCamera(_ device: AVCaptureDevice) {
        guard rememberLastCamera else { return }
        UserDefaults.standard.set(device.uniqueID, forKey: lastCameraDeviceIDKey)
    }
    
    static func preferredDevice(from devices: [AVCaptureDevice]) -> AVCaptureDevice? {
        guard rememberLastCamera else { return nil }
        guard let savedID = UserDefaults.standard.string(forKey: lastCameraDeviceIDKey),
              !savedID.isEmpty else {
            return nil
        }
        return devices.first(where: { $0.uniqueID == savedID })
    }
}

enum CameraDeviceUI {
    static func index(for device: AVCaptureDevice, in devices: [AVCaptureDevice]) -> Int {
        (devices.firstIndex(where: { $0.uniqueID == device.uniqueID }) ?? 0) + 1
    }
    
    static func iconSymbol(for device: AVCaptureDevice, in devices: [AVCaptureDevice]) -> String {
        "\(min(index(for: device, in: devices), 50)).circle"
    }
}

struct CameraDevicePicker: View {
    @ObservedObject var cameraManager: CameraManager
    let lang: String
    
    private var selectedDeviceID: Binding<String> {
        Binding(
            get: {
                cameraManager.selectedDevice?.uniqueID
                    ?? cameraManager.devices.first?.uniqueID
                    ?? ""
            },
            set: { id in
                guard let device = cameraManager.devices.first(where: { $0.uniqueID == id }) else { return }
                cameraManager.changeCamera(to: device)
            }
        )
    }
    
    var body: some View {
        HStack(spacing: 8) {
            Text(Localization.string(key: "selected_camera", lang: lang))
                .font(.subheadline)
                .foregroundStyle(.secondary)
            
            Picker("", selection: selectedDeviceID) {
                ForEach(cameraManager.devices, id: \.uniqueID) { device in
                    cameraMenuRow(for: device)
                        .tag(device.uniqueID)
                }
            }
            .labelsHidden()
            .pickerStyle(.menu)
            .frame(minWidth: 220, idealWidth: 280, maxWidth: 340)
        }
    }
    
    private func cameraMenuRow(for device: AVCaptureDevice) -> some View {
        HStack(spacing: 8) {
            Image(systemName: CameraDeviceUI.iconSymbol(for: device, in: cameraManager.devices))
                .foregroundStyle(.secondary)
            Text(device.localizedName)
                .lineLimit(1)
        }
    }
}

class CameraManager: NSObject, ObservableObject, AVCaptureVideoDataOutputSampleBufferDelegate {
    @Published var session = AVCaptureSession()
    @Published var isPermissionDenied = false
    @Published var isRunning = false
    @Published var devices: [AVCaptureDevice] = []
    @Published var selectedDevice: AVCaptureDevice?
    
    private(set) var ocrVisionOrientation: CGImagePropertyOrientation = .up
    
    var onFrameCaptured: ((CVImageBuffer) -> Void)?
    
    private let videoOutput = AVCaptureVideoDataOutput()
    private let queue = DispatchQueue(label: "camera.frame.queue", qos: .userInteractive)
    private var activeInput: AVCaptureDeviceInput?
    private let bufferLock = NSLock()
    private var latestPixelBuffer: CVImageBuffer?
    private let snapshotContext = CIContext()
    
    private weak var previewLayer: AVCaptureVideoPreviewLayer?
    private var rotationCoordinator: AVCaptureDevice.RotationCoordinator?
    private var previewRotationObservation: NSKeyValueObservation?
    private var captureRotationObservation: NSKeyValueObservation?
    private var lastAppliedPreviewAngle: CGFloat?
    private var lastAppliedCaptureAngle: CGFloat?
    private var snapshotDisplayOrientation: CGImagePropertyOrientation = .up
    private var latestSnapshotDisplayOrientation: CGImagePropertyOrientation = .up
    
    override init() {
        super.init()
        discoverDevices()
    }
    
    deinit {
        previewRotationObservation?.invalidate()
        captureRotationObservation?.invalidate()
    }
    
    private func discoverDevices() {
        var deviceTypes: [AVCaptureDevice.DeviceType] = [.builtInWideAngleCamera, .external]
        if #available(macOS 14.0, *) {
            deviceTypes.append(.continuityCamera)
        }
        
        let discoverySession = AVCaptureDevice.DiscoverySession(
            deviceTypes: deviceTypes,
            mediaType: .video,
            position: .unspecified
        )
        self.devices = discoverySession.devices
        if let preferred = CameraPreferences.preferredDevice(from: devices) {
            self.selectedDevice = preferred
        } else {
            self.selectedDevice = AVCaptureDevice.default(for: .video)
        }
    }
    
    func checkPermissionAndStart() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            setupSession()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                if granted {
                    DispatchQueue.main.async {
                        self?.setupSession()
                    }
                } else {
                    DispatchQueue.main.async {
                        self?.isPermissionDenied = true
                    }
                }
            }
        case .denied, .restricted:
            isPermissionDenied = true
        @unknown default:
            break
        }
    }
    
    private func setupSession() {
        guard !session.isRunning else { return }
        
        session.beginConfiguration()
        
        let deviceToUse = selectedDevice ?? AVCaptureDevice.default(for: .video)
        guard let videoDevice = deviceToUse else {
            print("No video device found")
            session.commitConfiguration()
            return
        }
        
        do {
            if let activeInput = activeInput {
                session.removeInput(activeInput)
            }
            
            let videoInput = try AVCaptureDeviceInput(device: videoDevice)
            if session.canAddInput(videoInput) {
                session.addInput(videoInput)
                activeInput = videoInput
            }
            
            if session.canAddOutput(videoOutput) {
                if !session.outputs.contains(videoOutput) {
                    videoOutput.setSampleBufferDelegate(self, queue: queue)
                    videoOutput.alwaysDiscardsLateVideoFrames = true
                    session.addOutput(videoOutput)
                }
            }
            
            applyStableRotation(force: true)
            
            if session.canSetSessionPreset(.hd1920x1080) {
                session.sessionPreset = .hd1920x1080
            } else if session.canSetSessionPreset(.hd1280x720) {
                session.sessionPreset = .hd1280x720
            } else if session.canSetSessionPreset(.medium) {
                session.sessionPreset = .medium
            }
            
            session.commitConfiguration()
            
            DispatchQueue.global(qos: .userInitiated).async { [weak self] in
                self?.session.startRunning()
                DispatchQueue.main.async {
                    self?.isRunning = self?.session.isRunning ?? false
                }
            }
        } catch {
            print("Error setting up camera session: \(error)")
            session.commitConfiguration()
        }
    }
    
    func changeCamera(to device: AVCaptureDevice) {
        selectedDevice = device
        CameraPreferences.saveLastCamera(device)
        resetRotationState()
        if previewLayer != nil {
            configureRotationCoordinator()
        }
        
        if session.isRunning {
            DispatchQueue.global(qos: .userInitiated).async { [weak self] in
                self?.session.stopRunning()
                DispatchQueue.main.async {
                    self?.setupSession()
                }
            }
        } else {
            setupSession()
        }
    }
    
    func startSession() {
        if !session.isRunning {
            checkPermissionAndStart()
        }
    }
    
    func stopSession() {
        guard session.isRunning else { return }
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            self?.session.stopRunning()
            DispatchQueue.main.async {
                self?.isRunning = false
            }
        }
    }
    
    func snapshotImage() -> NSImage? {
        bufferLock.lock()
        let pixelBuffer = latestPixelBuffer
        let displayOrientation = latestSnapshotDisplayOrientation
        bufferLock.unlock()
        
        guard let pixelBuffer else { return nil }
        
        let ciImage = CameraOrientation.orientedCIImage(
            CIImage(cvPixelBuffer: pixelBuffer),
            orientation: displayOrientation
        )
        let extent = ciImage.extent.integral
        guard let cgImage = snapshotContext.createCGImage(ciImage, from: extent) else {
            return nil
        }
        
        return NSImage(
            cgImage: cgImage,
            size: NSSize(width: cgImage.width, height: cgImage.height)
        )
    }
    
    func clearSnapshotBuffer() {
        bufferLock.lock()
        latestPixelBuffer = nil
        bufferLock.unlock()
    }
    
    func attachPreviewLayer(_ layer: AVCaptureVideoPreviewLayer) {
        previewLayer = layer
        configureRotationCoordinator()
        applyStableRotation(force: true)
    }
    
    func previewRect(forNormalizedBoundingBox box: CGRect) -> CGRect? {
        guard let previewLayer else { return nil }
        return previewLayer.layerRectConverted(fromMetadataOutputRect: box)
    }
    
    private func resetRotationState() {
        previewRotationObservation?.invalidate()
        captureRotationObservation?.invalidate()
        rotationCoordinator = nil
        lastAppliedPreviewAngle = nil
        lastAppliedCaptureAngle = nil
    }
    
    private func configureRotationCoordinator() {
        previewRotationObservation?.invalidate()
        captureRotationObservation?.invalidate()
        rotationCoordinator = nil
        
        guard let device = selectedDevice ?? AVCaptureDevice.default(for: .video),
              let previewLayer else {
            return
        }
        
        let coordinator = AVCaptureDevice.RotationCoordinator(
            device: device,
            previewLayer: previewLayer
        )
        rotationCoordinator = coordinator
        
        previewRotationObservation = coordinator.observe(
            \.videoRotationAngleForHorizonLevelPreview,
            options: [.initial, .new]
        ) { [weak self] _, _ in
            self?.applyStableRotation()
        }
        
        captureRotationObservation = coordinator.observe(
            \.videoRotationAngleForHorizonLevelCapture,
            options: [.initial, .new]
        ) { [weak self] _, _ in
            self?.applyStableRotation()
        }
    }
    
    private func applyStableRotation(force: Bool = false) {
        let device = selectedDevice ?? AVCaptureDevice.default(for: .video)
        let fallbackAngle = CameraOrientation.fallbackRotationAngle(for: device)
        
        let basePreviewAngle = rotationCoordinator?.videoRotationAngleForHorizonLevelPreview ?? fallbackAngle
        let baseCaptureAngle = rotationCoordinator?.videoRotationAngleForHorizonLevelCapture ?? fallbackAngle
        let previewAngle = CameraOrientation.resolveScanRotationAngle(baseAngle: basePreviewAngle, device: device)
        let captureAngle = CameraOrientation.resolveScanRotationAngle(baseAngle: baseCaptureAngle, device: device)
        
        if force || previewAngle != lastAppliedPreviewAngle {
            CameraOrientation.apply(to: previewLayer?.connection, angle: previewAngle)
            lastAppliedPreviewAngle = previewAngle
        }
        
        if force || captureAngle != lastAppliedCaptureAngle {
            CameraOrientation.apply(to: videoOutput.connection(with: .video), angle: captureAngle)
            lastAppliedCaptureAngle = captureAngle
            ocrVisionOrientation = CameraOrientation.visionOrientationForOCR(baseCaptureAngle: baseCaptureAngle)
            snapshotDisplayOrientation = CameraOrientation.visionOrientation(for: captureAngle)
        }
    }
    
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        let displayOrientation = snapshotDisplayOrientation
        bufferLock.lock()
        latestPixelBuffer = pixelBuffer
        latestSnapshotDisplayOrientation = displayOrientation
        bufferLock.unlock()
        onFrameCaptured?(pixelBuffer)
    }
}

class PreviewNSView: NSView {
    weak var cameraManager: CameraManager?
    
    var previewLayer: AVCaptureVideoPreviewLayer? {
        didSet {
            oldValue?.removeFromSuperlayer()
            if let layer = previewLayer {
                layer.frame = bounds
                self.layer?.addSublayer(layer)
                cameraManager?.attachPreviewLayer(layer)
            }
        }
    }
    
    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        wantsLayer = true
        layer?.backgroundColor = NSColor.black.cgColor
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        wantsLayer = true
        layer?.backgroundColor = NSColor.black.cgColor
    }
    
    override func layout() {
        super.layout()
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        previewLayer?.frame = bounds
        CATransaction.commit()
    }
}

struct CameraPreviewView: NSViewRepresentable {
    let cameraManager: CameraManager
    
    func makeNSView(context: Context) -> PreviewNSView {
        let view = PreviewNSView()
        view.cameraManager = cameraManager
        
        let previewLayer = AVCaptureVideoPreviewLayer(session: cameraManager.session)
        previewLayer.videoGravity = .resizeAspectFill
        view.previewLayer = previewLayer
        
        return view
    }
    
    func updateNSView(_ nsView: PreviewNSView, context: Context) {
        nsView.cameraManager = cameraManager
    }
}
