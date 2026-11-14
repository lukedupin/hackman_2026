import React, {useRef, useState} from 'react'

const MIN_WIDTH = 240
const MIN_HEIGHT = 140
const TITLE_HEIGHT = 36

const clamp = (value, low, high) => Math.min(Math.max(value, low), Math.max(low, high))

// What a drag does: 'move' moves the window, otherwise it names the edges being pulled
const MODES = {
    right: {right: true},
    bottom: {bottom: true},
    corner: {right: true, bottom: true},
}

// A window that floats over the view. Drag the title bar to move it, and the right edge, bottom edge
// or corner to resize it. It stays inside the view. What goes in the window is its children, which
// fill the space under the title bar.
//
//   title      shown at the left of the title bar
//   subtitle   optional, quieter text at the right of it
//   place      where it starts, in pixels: {width, height} and then `left` or `right` and `top` or `bottom`
//   onClose    optional; gives the title bar a close button that calls it
export const FloatingWindow = props => {
    const {title, subtitle, place, onClose, children} = props

    const [box, setBox] = useState(() => {
        const width = Math.min(place.width, window.innerWidth - 32)
        const height = Math.min(place.height, window.innerHeight - 32)
        return {
            width,
            height,
            x: place.left ?? Math.max(0, window.innerWidth - width - place.right),
            y: place.top ?? Math.max(0, window.innerHeight - height - place.bottom),
        }
    })

    const drag = useRef(null)

    const handle = mode => ({
        onPointerDown: e => {
            if (e.button !== 0) {
                return
            }
            e.preventDefault()
            e.currentTarget.setPointerCapture(e.pointerId)
            drag.current = {startX: e.clientX, startY: e.clientY, box}
        },
        onPointerMove: e => {
            const start = drag.current
            if (!start) {
                return
            }

            const dx = e.clientX - start.startX
            const dy = e.clientY - start.startY
            const {x, y, width, height} = start.box

            if (mode === 'move') {
                setBox({
                    ...start.box,
                    x: clamp(x + dx, 0, window.innerWidth - width),
                    y: clamp(y + dy, 0, window.innerHeight - TITLE_HEIGHT),
                })
                return
            }

            setBox({
                ...start.box,
                width: MODES[mode].right ? clamp(width + dx, MIN_WIDTH, window.innerWidth - x) : width,
                height: MODES[mode].bottom ? clamp(height + dy, MIN_HEIGHT, window.innerHeight - y) : height,
            })
        },
        onPointerUp: () => {
            drag.current = null
        },
    })

    return (
        <div
            style={{left: box.x, top: box.y, width: box.width, height: box.height}}
            className="absolute flex flex-col overflow-hidden rounded-lg bg-gray-900/95 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur"
        >
            <div
                {...handle('move')}
                style={{height: TITLE_HEIGHT}}
                className="flex shrink-0 cursor-move select-none items-center justify-between bg-white/10 px-3 text-xs font-medium uppercase tracking-wide text-white/70"
            >
                <span>{title}</span>
                <span className="flex items-center gap-3">
                    {subtitle && <span className="normal-case tracking-normal text-white/40">{subtitle}</span>}
                    {onClose &&
                    <button
                        onPointerDown={e => e.stopPropagation()}
                        onClick={onClose}
                        title="Close"
                        className="text-base leading-none text-white/60 hover:text-white"
                    >
                        ×
                    </button>
                    }
                </span>
            </div>

            <div className="flex min-h-0 flex-1">
                {children}
            </div>

            <div
                {...handle('right')}
                style={{top: TITLE_HEIGHT, height: `calc(100% - ${TITLE_HEIGHT}px)`}}
                className="absolute right-0 w-1.5 cursor-ew-resize"
            />
            <div {...handle('bottom')} className="absolute bottom-0 left-0 h-1.5 w-full cursor-ns-resize" />
            <div {...handle('corner')} className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize">
                <svg viewBox="0 0 16 16" className="h-4 w-4 text-white/40" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M14 6 L6 14 M14 10 L10 14" />
                </svg>
            </div>
        </div>
    )
}
