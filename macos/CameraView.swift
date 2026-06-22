import SwiftUI
import AVFoundation
import AppKit
import CoreImage

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
    @Published private(set) var previewRotationAngle: CGFloat = 0
    
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
            
            applyRotationFromCoordinator()
            
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
                    self?.refreshPreviewRotation()
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
        configureRotationCoordinator()
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
        bufferLock.unlock()
        
        guard let pixelBuffer else { return nil }
        
        let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
        guard let cgImage = snapshotContext.createCGImage(ciImage, from: ciImage.extent) else {
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
        refreshPreviewRotation()
    }
    
    func refreshPreviewRotation() {
        applyRotationFromCoordinator()
    }
    
    func previewRect(forNormalizedBoundingBox box: CGRect) -> CGRect? {
        guard let previewLayer else { return nil }
        return previewLayer.layerRectConverted(fromMetadataOutputRect: box)
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
            self?.applyRotationFromCoordinator()
        }
        
        captureRotationObservation = coordinator.observe(
            \.videoRotationAngleForHorizonLevelCapture,
            options: [.initial, .new]
        ) { [weak self] _, _ in
            self?.applyRotationFromCoordinator()
        }
    }
    
    private func applyRotationFromCoordinator() {
        guard let coordinator = rotationCoordinator else { return }
        
        let previewAngle = coordinator.videoRotationAngleForHorizonLevelPreview
        let captureAngle = coordinator.videoRotationAngleForHorizonLevelCapture
        
        if let connection = previewLayer?.connection,
           connection.isVideoRotationAngleSupported(previewAngle) {
            connection.videoRotationAngle = previewAngle
        }
        
        let wasRunning = session.isRunning
        if wasRunning {
            session.beginConfiguration()
        }
        if let connection = videoOutput.connection(with: .video),
           connection.isVideoRotationAngleSupported(captureAngle) {
            connection.videoRotationAngle = captureAngle
        }
        if wasRunning {
            session.commitConfiguration()
        }
        
        DispatchQueue.main.async {
            self.previewRotationAngle = previewAngle
        }
    }
    
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        bufferLock.lock()
        latestPixelBuffer = pixelBuffer
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
    
    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        cameraManager?.refreshPreviewRotation()
    }
    
    override func layout() {
        super.layout()
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        previewLayer?.frame = bounds
        CATransaction.commit()
        cameraManager?.refreshPreviewRotation()
    }
}

struct CameraPreviewView: NSViewRepresentable {
    @ObservedObject var cameraManager: CameraManager
    
    func makeNSView(context: Context) -> PreviewNSView {
        let view = PreviewNSView()
        view.wantsLayer = true
        view.cameraManager = cameraManager
        
        let previewLayer = AVCaptureVideoPreviewLayer(session: cameraManager.session)
        previewLayer.videoGravity = .resizeAspectFill
        view.previewLayer = previewLayer
        
        return view
    }
    
    func updateNSView(_ nsView: PreviewNSView, context: Context) {
        nsView.cameraManager = cameraManager
        cameraManager.refreshPreviewRotation()
    }
}