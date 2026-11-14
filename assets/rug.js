import {box, assemble} from './parts.js'

// A flat rug over two by two cells, with a lighter field inside its border
export const asset = {
    label: 'Rug',
    footprint: [2, 2],
    top: 0.04,
    build: () => assemble(
        box(1.9, 0.03, 1.9, '#8c3b3b'),
        box(1.55, 0.034, 1.55, '#d9c9a3'),
        box(1.2, 0.038, 1.2, '#8c3b3b'),
    ),
}
