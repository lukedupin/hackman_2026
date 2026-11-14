import {box, assemble} from './parts.js'

// A leather billfold lying flat, with a card and a bill sticking out of it. Its opening is on the +z side.
export const asset = {
    label: 'Wallet',
    footprint: [1, 1],
    placement: 'surface',
    build: () => assemble(
        box(0.1, 0.012, 0.13, '#4a2c17', 0, 0, -0.01),
        box(0.1, 0.008, 0.07, '#5b371d', 0, 0.012, -0.04),
        box(0.09, 0.004, 0.008, '#2e1a0c', 0, 0.02, 0.0),
        box(0.07, 0.004, 0.05, '#2f6fb5', -0.012, 0.008, 0.06),
        box(0.06, 0.003, 0.04, '#7fae6b', 0.015, 0.006, 0.065),
    ),
}
