import {box, assemble} from './parts.js'

// A wall block, two cells tall (a cell is 1 wide)
export const asset = {
    label: 'Wall',
    footprint: [1, 1],
    build: () => assemble(
        box(0.94, 2, 0.94, '#5b6673'),
    ),
}
