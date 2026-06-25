import SwiftUI
import AVFoundation

enum ScanMode: Equatable {
    case camera
    case image
}

struct CameraMenuDevice: Identifiable, Equatable {
    let id: String
    let name: String
    let symbolName: String
}

@MainActor
final class ScanMenuActions: ObservableObject {
    static let shared = ScanMenuActions()

    @Published private(set) var language = "en"
    @Published private(set) var scanMode: ScanMode = .image
    @Published private(set) var showsZoomControls = false
    @Published private(set) var zoomPercent = 100
    @Published private(set) var canZoomIn = false
    @Published private(set) var canZoomOut = false
    @Published private(set) var canResetZoom = false
    @Published private(set) var showsCameraMenu = false
    @Published private(set) var cameraDevices: [CameraMenuDevice] = []
    @Published private(set) var selectedCameraID = ""
    @Published private(set) var showsPasteImage = false
    @Published private(set) var canExportFixture = false
    @Published private(set) var canFreezeCameraFrame = false

    var onScanModeSelected: (ScanMode) -> Void = { _ in }
    var onNewCameraScan: () -> Void = {}
    var onNewImageImport: () -> Void = {}
    var onPasteImage: () -> Void = {}
    var onFreezeCameraFrame: () -> Void = {}
    var onExportFixture: () -> Void = {}
    var onZoomIn: () -> Void = {}
    var onZoomOut: () -> Void = {}
    var onResetZoom: () -> Void = {}
    var onSelectCamera: (String) -> Void = { _ in }
    var onOpenSettings: () -> Void = {}

    private init() {}

    func update(
        language: String,
        scanMode: ScanMode,
        showsZoomableCapture: Bool,
        captureZoomScale: CGFloat,
        captureZoomOffset: CGSize,
        canExportFixture: Bool,
        canFreezeCameraFrame: Bool,
        showsCameraPicker: Bool,
        devices: [AVCaptureDevice],
        selectedDevice: AVCaptureDevice?
    ) {
        self.language = language
        self.scanMode = scanMode
        showsZoomControls = showsZoomableCapture
        zoomPercent = Int(round(captureZoomScale * 100))
        canZoomIn = showsZoomableCapture && captureZoomScale < 6.0
        canZoomOut = showsZoomableCapture && captureZoomScale > 1.0
        canResetZoom = showsZoomableCapture && (captureZoomScale > 1.0 || captureZoomOffset != .zero)
        showsPasteImage = scanMode == .image
        self.canExportFixture = canExportFixture
        self.canFreezeCameraFrame = canFreezeCameraFrame
        showsCameraMenu = showsCameraPicker
        cameraDevices = devices.map { device in
            CameraMenuDevice(
                id: device.uniqueID,
                name: device.localizedName,
                symbolName: CameraDeviceUI.iconSymbol(for: device, in: devices)
            )
        }
        selectedCameraID = selectedDevice?.uniqueID
            ?? devices.first?.uniqueID
            ?? ""
    }
}

struct ScanCommands: Commands {
    @ObservedObject private var menu = ScanMenuActions.shared

    private var lang: String { menu.language }

    var body: some Commands {
        CommandGroup(replacing: .newItem) {
            Button(Localization.string(key: "new_scan", lang: lang)) {
                menu.onNewCameraScan()
            }
            .disabled(menu.scanMode != .camera)
            .keyboardShortcut("n", modifiers: .command)

            Button(Localization.string(key: "new_image", lang: lang)) {
                menu.onNewImageImport()
            }
            .disabled(menu.scanMode != .image)
            .keyboardShortcut("n", modifiers: [.command, .shift])
        }

        CommandGroup(after: .newItem) {
            Button(Localization.string(key: "paste_image", lang: lang)) {
                menu.onPasteImage()
            }
            .disabled(!menu.showsPasteImage)
            .keyboardShortcut("v", modifiers: [.command, .shift])

            Button(Localization.string(key: "export_ocr_fixture", lang: lang)) {
                menu.onExportFixture()
            }
            .disabled(!menu.canExportFixture)
            .keyboardShortcut("e", modifiers: [.command, .shift])

            Button(Localization.string(key: "freeze_camera_frame", lang: lang)) {
                menu.onFreezeCameraFrame()
            }
            .disabled(!menu.canFreezeCameraFrame)
            .keyboardShortcut("f", modifiers: [.command, .shift])
        }

        CommandMenu(Localization.string(key: "scan_mode", lang: lang)) {
            Picker(
                Localization.string(key: "scan_mode", lang: lang),
                selection: Binding(
                    get: { menu.scanMode },
                    set: { menu.onScanModeSelected($0) }
                )
            ) {
                Text(Localization.string(key: "live_camera", lang: lang)).tag(ScanMode.camera)
                Text(Localization.string(key: "upload_image", lang: lang)).tag(ScanMode.image)
            }
            .pickerStyle(.inline)

            if menu.showsZoomControls {
                Divider()

                Button(Localization.string(key: "zoom_out", lang: lang)) {
                    menu.onZoomOut()
                }
                .disabled(!menu.canZoomOut)
                .keyboardShortcut("-", modifiers: .command)

                Text("\(menu.zoomPercent)%")
                    .disabled(true)

                Button(Localization.string(key: "zoom_in", lang: lang)) {
                    menu.onZoomIn()
                }
                .disabled(!menu.canZoomIn)
                .keyboardShortcut("=", modifiers: .command)

                Button(Localization.string(key: "zoom_reset", lang: lang)) {
                    menu.onResetZoom()
                }
                .disabled(!menu.canResetZoom)
                .keyboardShortcut("0", modifiers: .command)
            }
        }

        CommandMenu(Localization.string(key: "camera_menu", lang: lang)) {
            if menu.showsCameraMenu {
                ForEach(menu.cameraDevices) { device in
                    Button {
                        menu.onSelectCamera(device.id)
                    } label: {
                        if device.id == menu.selectedCameraID {
                            Label(device.name, systemImage: "checkmark")
                        } else {
                            Label(device.name, systemImage: device.symbolName)
                        }
                    }
                }
            } else {
                Text(Localization.string(key: "camera_menu_unavailable", lang: lang))
                    .disabled(true)
            }
        }

        CommandGroup(replacing: .appSettings) {
            Button(Localization.string(key: "settings", lang: lang)) {
                menu.onOpenSettings()
            }
            .keyboardShortcut(",", modifiers: .command)
        }
    }
}
