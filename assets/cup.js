import {cylinder, torus, assemble} from './parts.js'

// A teacup on its saucer
export const asset = {
    label: 'Cup',
    footprint: [1, 1],
    placement: 'surface',
    build: () => assemble(
        cylinder(0.07, 0.06, 0.008, '#f4f1ea'),                 // saucer
        cylinder(0.05, 0.032, 0.06, '#f4f1ea', 0, 0.008),
        cylinder(0.042, 0.042, 0.004, '#8a5a2b', 0, 0.064),     // the tea
        torus(0.02, 0.006, '#f4f1ea', 0.062, 0.042),            // handle
    ),
}
