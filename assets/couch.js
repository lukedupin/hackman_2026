import {box, assemble} from './parts.js'

// A two-seat couch across two cells (2 wide, 1 deep), its back on the -z side
export const asset = {
    label: 'Couch',
    footprint: [2, 1],
    top: 0.52,
    build: () => assemble(
        box(1.9, 0.3, 0.85, '#4b6a8a', 0, 0.08),            // base
        box(0.86, 0.14, 0.7, '#5a7ba0', -0.45, 0.38, 0.06), // seat cushions
        box(0.86, 0.14, 0.7, '#5a7ba0', 0.45, 0.38, 0.06),
        box(1.9, 0.5, 0.2, '#4b6a8a', 0, 0.38, -0.325),     // back
        box(0.18, 0.5, 0.85, '#3f5a77', -0.86, 0.08),       // arms
        box(0.18, 0.5, 0.85, '#3f5a77', 0.86, 0.08),
        ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => box(0.08, 0.08, 0.08, '#2d2d30', sx * 0.88, 0, sz * 0.36)),
    ),
}
