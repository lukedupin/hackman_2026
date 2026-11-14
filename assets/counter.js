import {box, assemble} from './parts.js'

// One cell of bar counter. Fills its cell edge to edge, so a row of them makes a continuous bar
export const asset = {
    label: 'Bar counter',
    footprint: [1, 1],
    top: 0.9,
    build: () => assemble(
        box(1, 0.1, 1, '#2b1b11'),
        box(1, 0.72, 1, '#5a3a24', 0, 0.1),
        box(1, 0.08, 1, '#c79a63', 0, 0.82),
    ),
}
