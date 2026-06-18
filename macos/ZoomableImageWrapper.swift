import SwiftUI
import AppKit

struct ZoomableImageWrapper<Content: View>: View {
    @Binding var scale: CGFloat
    @Binding var offset: CGSize
    @ViewBuilder let content: () -> Content
    
    @State private var gestureBaseScale: CGFloat = 1
    @State private var gestureBaseOffset: CGSize = .zero
    
    private let minScale: CGFloat = 1
    private let maxScale: CGFloat = 6
    
    var body: some View {
        GeometryReader { geo in
            content()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .scaleEffect(clampedScale)
                .offset(clampedOffset(in: geo.size))
                .frame(width: geo.size.width, height: geo.size.height)
                .contentShape(Rectangle())
                .gesture(magnificationGesture)
                .simultaneousGesture(dragGesture)
                .background {
                    ScrollWheelZoomLayer { delta in
                        applyScrollZoom(delta: delta)
                    }
                }
        }
        .clipped()
        .onAppear {
            gestureBaseScale = scale
            gestureBaseOffset = offset
        }
        .onChange(of: scale) { _, newValue in
            gestureBaseScale = newValue
            if newValue <= minScale {
                offset = .zero
                gestureBaseOffset = .zero
            }
        }
        .onChange(of: offset) { _, newValue in
            gestureBaseOffset = newValue
        }
    }
    
    private var clampedScale: CGFloat {
        min(max(scale, minScale), maxScale)
    }
    
    private func clampedOffset(in size: CGSize) -> CGSize {
        guard clampedScale > minScale else { return .zero }
        let maxX = (size.width * (clampedScale - 1)) / 2
        let maxY = (size.height * (clampedScale - 1)) / 2
        return CGSize(
            width: min(max(offset.width, -maxX), maxX),
            height: min(max(offset.height, -maxY), maxY)
        )
    }
    
    private var magnificationGesture: some Gesture {
        MagnificationGesture()
            .onChanged { value in
                scale = min(max(gestureBaseScale * value, minScale), maxScale)
            }
            .onEnded { _ in
                gestureBaseScale = scale
                if scale <= minScale + 0.01 {
                    scale = minScale
                    offset = .zero
                    gestureBaseScale = minScale
                    gestureBaseOffset = .zero
                }
            }
    }
    
    private var dragGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                guard clampedScale > minScale else { return }
                offset = CGSize(
                    width: gestureBaseOffset.width + value.translation.width,
                    height: gestureBaseOffset.height + value.translation.height
                )
            }
            .onEnded { _ in
                gestureBaseOffset = offset
            }
    }
    
    private func applyScrollZoom(delta: CGFloat) {
        guard abs(delta) > 0.0001 else { return }
        let factor = 1 + delta
        let newScale = min(max(scale * factor, minScale), maxScale)
        scale = newScale
        gestureBaseScale = newScale
        if newScale <= minScale {
            offset = .zero
            gestureBaseOffset = .zero
        }
    }
}

private struct ScrollWheelZoomLayer: NSViewRepresentable {
    let onScroll: (CGFloat) -> Void
    
    func makeNSView(context: Context) -> ScrollWheelZoomNSView {
        let view = ScrollWheelZoomNSView()
        view.onScroll = onScroll
        return view
    }
    
    func updateNSView(_ nsView: ScrollWheelZoomNSView, context: Context) {
        nsView.onScroll = onScroll
    }
}

private final class ScrollWheelZoomNSView: NSView {
    var onScroll: ((CGFloat) -> Void)?
    
    override var acceptsFirstResponder: Bool { true }
    
    override func scrollWheel(with event: NSEvent) {
        guard abs(event.scrollingDeltaY) > 0.01 else { return }
        let delta = event.hasPreciseScrollingDeltas
            ? event.scrollingDeltaY * 0.01
            : event.scrollingDeltaY * 0.08
        onScroll?(delta)
    }
}