import {cylinder, assemble} from './parts.js'

// A small round table on a single stem, the right height for a chair
export const asset = {
    label: 'Cafe table',
    footprint: [1, 1],
    top: 0.75,
    build: () => assemble(
        cylinder(0.25, 0.25, 0.03, '#2e2e32'),
        cylinder(0.04, 0.04, 0.68, '#2e2e32', 0, 0.03),
        cylinder(0.42, 0.42, 0.04, '#d3ad7a', 0, 0.71),
    ),
}
