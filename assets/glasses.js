import {box, cylinder, torus, assemble} from './parts.js'

// A pair of glasses lying flat with the arms folded out toward -z
export const asset = {
    label: 'Glasses',
    footprint: [1, 1],
    placement: 'surface',
    build: () => {
        const lenses = [-1, 1].map(side => {
            const lens = cylinder(0.027, 0.027, 0.001, '#9ec8e8', side * 0.04, 0.002)
            lens.material.transparent = true
            lens.material.opacity = 0.45
            return lens
        })

        return assemble(
            ...[-1, 1].map(side => torus(0.03, 0.0035, '#222222', side * 0.04, 0.0035, 0.03, Math.PI / 2)),
            ...lenses,
            box(0.02, 0.004, 0.004, '#222222', 0, 0, 0.03),     // bridge
            ...[-1, 1].map(side => box(0.004, 0.004, 0.11, '#222222', side * 0.07, 0, -0.025)),  // arms
        )
    },
}
