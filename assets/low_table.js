import {box, assemble} from './parts.js'

// A coffee table: a wide top on four short legs
export const asset = {
    label: 'Low table',
    footprint: [1, 1],
    top: 0.36,
    build: () => assemble(
        box(0.86, 0.06, 0.86, '#8a5a3b', 0, 0.3),
        ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => box(0.07, 0.3, 0.07, '#6e4529', sx * 0.37, 0, sz * 0.37)),
    ),
}
