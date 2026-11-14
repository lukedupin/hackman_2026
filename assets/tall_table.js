import {cylinder, assemble} from './parts.js'

// A bar-height table: a round top on one pedestal with a round base
export const asset = {
    label: 'Tall table',
    footprint: [1, 1],
    top: 1,
    build: () => assemble(
        cylinder(0.24, 0.24, 0.04, '#4a4a4f', 0, 0),
        cylinder(0.04, 0.04, 0.91, '#4a4a4f', 0, 0.04),
        cylinder(0.4, 0.4, 0.05, '#a37350', 0, 0.95),
    ),
}
