import {box, assemble} from './parts.js'

// An open laptop. The keyboard is toward +z (the person using it) and the screen leans back toward -z.
export const asset = {
    label: 'Laptop',
    footprint: [1, 1],
    placement: 'surface',
    build: () => {
        const screen = assemble(
            box(0.34, 0.22, 0.012, '#9aa0a6', 0, 0),
            box(0.31, 0.19, 0.004, '#1b2430', 0, 0.015, 0.0065),
        )
        // Hinged along the back edge of the base
        screen.position.set(0, 0.02, -0.12)
        screen.rotation.x = -0.28

        return assemble(
            box(0.34, 0.02, 0.24, '#9aa0a6'),
            box(0.3, 0.004, 0.1, '#6b7078', 0, 0.02, 0.02),     // keys
            screen,
        )
    },
}
