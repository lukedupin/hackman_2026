import {cylinder, assemble} from './parts.js'

// A small wastebasket, open at the top. Fine on the floor or on a table.
export const asset = {
    label: 'Trash can',
    footprint: [1, 1],
    placement: 'any',
    build: () => assemble(
        cylinder(0.13, 0.1, 0.3, '#6b7280'),
        cylinder(0.14, 0.14, 0.015, '#4b5563', 0, 0.285),       // rim
        cylinder(0.115, 0.115, 0.004, '#1f2937', 0, 0.294),     // dark opening
    ),
}
