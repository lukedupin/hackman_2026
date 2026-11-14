import {box, cylinder, assemble} from './parts.js'

// An espresso machine with two group heads and a steam wand. Its front, where the baristas stand, is +z.
export const asset = {
    label: 'Espresso machine',
    footprint: [1, 1],
    placement: 'surface',
    build: () => assemble(
        box(0.56, 0.3, 0.32, '#b8bcc2'),
        box(0.56, 0.04, 0.34, '#8a8f96', 0, 0.3),
        box(0.5, 0.02, 0.12, '#333338', 0, 0, 0.2),
        ...[-0.15, 0.15].map(x => cylinder(0.04, 0.04, 0.06, '#222226', x, 0.14, 0.19)),
        ...[-0.15, 0.15].map(x => box(0.03, 0.03, 0.1, '#222226', x, 0.14, 0.26)),
        cylinder(0.01, 0.01, 0.22, '#9a9ea4', 0.27, 0.06, 0.1),
    ),
}
