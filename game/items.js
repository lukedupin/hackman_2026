import * as THREE from 'three'
import {assemble, box, cylinder} from '../assets/parts.js'
import {ASSETS} from '../assets/index.js'

// The kinds of item a level can place on the grid: the furniture, walls, people and the player in
// assets/, plus the pieces the game itself is played with. Each has a `footprint` ([cols, rows] it covers) and a
// `build` that makes a mesh centered on that footprint and standing on y = 0.
//
// To add a kind: for scenery make an asset (assets/), for a game piece add it here, then use its
// key as `type` in a level's `items`.
const emissive = (group, color) => {
    group.traverse(child => child.material && (child.material.emissive = new THREE.Color(color)))
    return group
}

const PIECES = {
    crate: {
        label: 'Crate',
        name: 'crate',
        footprint: [1, 1],
        top: 0.7,
        build: () => assemble(box(0.7, 0.7, 0.7, '#c08a4b')),
    },
    goal: {
        label: 'Goal',
        name: 'goal',
        footprint: [1, 1],
        walkable: true,
        build: () => emissive(assemble(cylinder(0.38, 0.38, 0.04, '#4cd08a')), '#1f7a4d'),
    },
}

export const ITEM_TYPES = {...PIECES, ...ASSETS}

// `options` is the level's item, which builds that read it (the people's colors) can use
export const createItem = (type, options = {}) => {
    if (!(type in ITEM_TYPES)) {
        throw new Error(`Unknown item type '${type}'. Known types: ${Object.keys(ITEM_TYPES).join(', ')}`)
    }
    const {footprint, build, placement = 'ground', top = null} = ITEM_TYPES[type]
    return {mesh: build(options), footprint, placement, top}
}
