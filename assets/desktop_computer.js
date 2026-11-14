import {box, cylinder, assemble} from './parts.js'

// A desktop setup: monitor on a stand, with the keyboard in front of it (toward +z)
export const asset = {
    label: 'Desktop computer',
    footprint: [1, 1],
    placement: 'surface',
    build: () => assemble(
        cylinder(0.07, 0.08, 0.012, '#3a3f47', 0, 0, -0.12),                    // stand base
        box(0.035, 0.1, 0.03, '#3a3f47', 0, 0.012, -0.12),                      // neck
        box(0.5, 0.3, 0.03, '#2b3038', 0, 0.1, -0.12),                          // monitor body
        box(0.46, 0.26, 0.004, '#16324a', 0, 0.12, -0.103),                     // screen
        box(0.38, 0.014, 0.12, '#cfd3d8', 0, 0, 0.12),                          // keyboard
        box(0.07, 0.025, 0.045, '#cfd3d8', 0.27, 0, 0.12),                      // mouse
    ),
}
