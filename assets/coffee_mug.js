import {cylinder, torus, assemble} from './parts.js'

export const asset = {
    label: 'Coffee mug',
    footprint: [1, 1],
    placement: 'surface',
    build: () => assemble(
        cylinder(0.045, 0.04, 0.09, '#e8e2d5'),
        cylinder(0.038, 0.038, 0.004, '#3b2314', 0, 0.084),     // the coffee
        torus(0.028, 0.008, '#e8e2d5', 0.062, 0.048),           // handle
    ),
}
