import {box, assemble} from './parts.js'

// A desk stapler, its nose toward +x
export const asset = {
    label: 'Stapler',
    footprint: [1, 1],
    placement: 'surface',
    build: () => assemble(
        box(0.14, 0.014, 0.035, '#2f3a4a'),                     // base
        box(0.13, 0.016, 0.03, '#b32d2d', -0.003, 0.014),       // arm
        box(0.02, 0.01, 0.03, '#2f3a4a', 0.05, 0.03),           // nose
    ),
}
