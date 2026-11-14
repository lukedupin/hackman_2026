import {box, yaw, assemble} from './parts.js'

// A loose stack of manila file folders
export const asset = {
    label: 'Files',
    footprint: [1, 1],
    placement: 'surface',
    build: () => assemble(
        yaw(box(0.22, 0.012, 0.3, '#e0c16b', 0, 0), 0.05),
        yaw(box(0.22, 0.012, 0.3, '#d6b45a', 0, 0.012), -0.09),
        yaw(box(0.22, 0.012, 0.3, '#e0c16b', 0, 0.024), 0.12),
        yaw(box(0.22, 0.012, 0.3, '#d6b45a', 0, 0.036), -0.03),
        yaw(box(0.21, 0.004, 0.29, '#f4f1ea', 0, 0.048), 0.02),   // a loose sheet on top
    ),
}
