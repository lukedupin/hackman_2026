import {cylinder, assemble} from './parts.js'

// A round stool on three legs
export const asset = {
    label: 'Stool',
    footprint: [1, 1],
    top: 0.6,
    build: () => assemble(
        cylinder(0.22, 0.22, 0.05, '#c9a227', 0, 0.55),
        ...[90, 210, 330].map(degrees => {
            const angle = (degrees * Math.PI) / 180
            return cylinder(0.025, 0.025, 0.55, '#7a6216', Math.cos(angle) * 0.15, 0, Math.sin(angle) * 0.15)
        }),
    ),
}
