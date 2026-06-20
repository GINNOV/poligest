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

enum CameraOrientation {
    static let continuityCameraRotationAngle: CGFloat = 180
    
    static func isContinuityCameraDevice(_ device: AVCaptureDevice?) -> Bool {
        guard let device else { return false }
        if device.isContinuityCamera {
            return true
        }
        guard device.deviceType == .external else { return false }
        let name = device.localizedName.lowercased()
        return name.contains("iphone") || name.contains("ipad")
    }
    
    static func rotationAngle(for device: AVCaptureDevice?) -> CGFloat {
        isContinuityCameraDevice(device) ? continuityCameraRotationAngle : 0
    }
    
    static func apply(to connection: AVCaptureConnection?, for device: AVCaptureDevice?) {
        guard let connection else { return }
        let angle = rotationAngle(for: device)
        guard connection.isVideoRotationAngleSupported(angle) else { return }
        connection.videoRotationAngle = angle
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
    
    var onFrameCaptured: ((CVImageBuffer) -> Void)?
    
    private let videoOutput = AVCaptureVideoDataOutput()
    private let queue = DispatchQueue(label: "camera.frame.queue", qos: .userInteractive)
    private var activeInput: AVCaptureDeviceInput?
    private let bufferLock = NSLock()
    private var latestPixelBuffer: CVImageBuffer?
    private let snapshotContext = CIContext()
    
    override init() {
        super.init()
        discoverDevices()
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
        
        // Use selected device or default
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
                // Ensure output isn't already added
                if !session.outputs.contains(videoOutput) {
                    videoOutput.setSampleBufferDelegate(self, queue: queue)
                    videoOutput.alwaysDiscardsLateVideoFrames = true
                    session.addOutput(videoOutput)
                }
            }
            
            CameraOrientation.apply(
                to: videoOutput.connection(with: .video),
                for: videoDevice
            )
            
            // Optimize for OCR (Full HD 1080p is preferred for high accuracy OCR)
            if session.canSetSessionPreset(.hd1920x1080) {
                session.sessionPreset = .hd1920x1080
            } else if session.canSetSessionPreset(.hd1280x720) {
                session.sessionPreset = .hd1280x720
            } else if session.canSetSessionPreset(.medium) {
                session.sessionPreset = .medium
            }
            
            session.commitConfiguration()
            
            // Start session in background
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
        if session.isRunning {
            DispatchQueue.global(qos: .userInitiated).async { [weak self] in
                self?.session.stopRunning()
                DispatchQueue.main.async {
                    self?.setupSession()
                }
            }
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
    
    func applyPreviewRotation(to previewLayer: AVCaptureVideoPreviewLayer) {
        CameraOrientation.apply(to: previewLayer.connection, for: selectedDevice)
    }
    
    // AVCaptureVideoDataOutputSampleBufferDelegate
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        bufferLock.lock()
        latestPixelBuffer = pixelBuffer
        bufferLock.unlock()
        onFrameCaptured?(pixelBuffer)
    }
}

class PreviewNSView: NSView {
    var previewLayer: AVCaptureVideoPreviewLayer? {
        didSet {
            oldValue?.removeFromSuperlayer()
            if let layer = previewLayer {
                layer.frame = bounds
                self.layer?.addSublayer(layer)
            }
        }
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
    @ObservedObject var cameraManager: CameraManager
    
    func makeNSView(context: Context) -> PreviewNSView {
        let view = PreviewNSView()
        view.wantsLayer = true
        
        let previewLayer = AVCaptureVideoPreviewLayer(session: cameraManager.session)
        previewLayer.videoGravity = .resizeAspectFill
        cameraManager.applyPreviewRotation(to: previewLayer)
        view.previewLayer = previewLayer
        
        return view
    }
    
    func updateNSView(_ nsView: PreviewNSView, context: Context) {
        if let previewLayer = nsView.previewLayer {
            cameraManager.applyPreviewRotation(to: previewLayer)
        }
    }
}
