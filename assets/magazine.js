import {box, assemble} from './parts.js'

// A magazine lying flat, cover up
export const asset = {
    label: 'Magazine',
    footprint: [1, 1],
    placement: 'surface',
    build: () => assemble(
        box(0.22, 0.002, 0.3, '#d94f6a'),                       // back cover
        box(0.212, 0.006, 0.294, '#f2f2f2', 0, 0.002),          // pages
        box(0.22, 0.002, 0.3, '#d94f6a', 0, 0.008),             // front cover
        box(0.16, 0.0025, 0.07, '#f5d86b', 0, 0.0099, -0.08),   // title bar
    ),
}
