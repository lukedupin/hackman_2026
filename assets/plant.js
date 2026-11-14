import {cylinder, sphere, assemble} from './parts.js'

// A potted plant. Fine on the floor or on a table.
export const asset = {
    label: 'Plant',
    footprint: [1, 1],
    placement: 'any',
    build: () => assemble(
        cylinder(0.09, 0.065, 0.12, '#b8613a'),                 // pot
        cylinder(0.08, 0.08, 0.004, '#4a3524', 0, 0.118),       // soil
        cylinder(0.012, 0.012, 0.1, '#3a7a3f', 0, 0.12),        // stem
        sphere(0.085, '#3f8f4a', 0, 0.17),
        sphere(0.06, '#4aa157', 0.06, 0.2, 0.02),
        sphere(0.055, '#357a3f', -0.055, 0.19, -0.03),
        sphere(0.05, '#4aa157', 0.0, 0.25, -0.03),
    ),
}
