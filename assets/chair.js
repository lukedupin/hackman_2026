import {box, assemble} from './parts.js'

// A chair with its back on the -z side, so at rotate 0 it faces down the grid
export const asset = {
    label: 'Chair',
    footprint: [1, 1],
    top: 0.5,
    build: () => assemble(
        box(0.5, 0.05, 0.5, '#b5651d', 0, 0.45),
        box(0.5, 0.45, 0.05, '#b5651d', 0, 0.5, -0.225),
        ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => box(0.05, 0.45, 0.05, '#8c4f15', sx * 0.2, 0, sz * 0.2)),
    ),
}
