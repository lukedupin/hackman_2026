import * as THREE from 'three'
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

// A flat grid of rounded-edge blocks for items to be placed onto. The blocks lie on the ground
// plane: each is CELL wide and CELL long, and a third of that deep (thick), so it reads as a tile.
// The grid is centered on the origin and its top surface sits at y = 0, so anything placed with
// cellPosition() rests right on top of it.
export const GRID_SIZE = 16
const CELL = 1
const DEPTH = CELL / 3
const GAP = 0.06          // space between blocks, so each one reads as its own block
const RADIUS = 0.08       // how round the edges are
const SEGMENTS = 4        // smoothness of the rounded edges

const LIGHT = new THREE.Color('#9fb4c7')
const DARK = new THREE.Color('#8499ad')

// Returns the group to add to the scene, and helpers to work with the cells.
//   group           add this to the scene. `group.items` is an empty group to put placed items in.
//   cellPosition    (col, row) -> THREE.Vector3 at the center of that cell's top surface
//   cellAt          (point) -> {col, row}, or null when the point is off the grid
//   setColors       (light, dark) recolors the checkerboard
//   dispose        frees the geometry and material
export const createGrid = (size = GRID_SIZE) => {
    const geometry = new RoundedBoxGeometry(CELL - GAP, DEPTH, CELL - GAP, SEGMENTS, RADIUS)
    const material = new THREE.MeshStandardMaterial({roughness: 0.55, metalness: 0.05})

    const blocks = new THREE.InstancedMesh(geometry, material, size * size)
    const matrix = new THREE.Matrix4()
    const half = (size * CELL) / 2

    // World x / z of the middle of a column / row
    const centerOf = index => index * CELL - half + CELL / 2

    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            const idx = row * size + col
            // The block hangs below y = 0 so its top face is the surface items stand on
            matrix.setPosition(centerOf(col), -DEPTH / 2, centerOf(row))
            blocks.setMatrixAt(idx, matrix)
            blocks.setColorAt(idx, (col + row) % 2 === 0 ? LIGHT : DARK)
        }
    }
    blocks.instanceMatrix.needsUpdate = true
    blocks.instanceColor.needsUpdate = true

    const group = new THREE.Group()
    group.add(blocks)

    group.items = new THREE.Group()
    group.add(group.items)

    const cellPosition = (col, row) => new THREE.Vector3(centerOf(col), 0, centerOf(row))

    const cellAt = point => {
        const col = Math.floor((point.x + half) / CELL)
        const row = Math.floor((point.z + half) / CELL)
        if (col < 0 || row < 0 || col >= size || row >= size) {
            return null
        }
        return {col, row}
    }

    // Recolors the checkerboard, e.g. for a world's theme
    const setColors = (light, dark) => {
        const lightColor = new THREE.Color(light)
        const darkColor = new THREE.Color(dark)
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                blocks.setColorAt(row * size + col, (col + row) % 2 === 0 ? lightColor : darkColor)
            }
        }
        blocks.instanceColor.needsUpdate = true
    }

    const dispose = () => {
        geometry.dispose()
        material.dispose()
        blocks.dispose()
    }

    return {group, cellPosition, cellAt, setColors, dispose, size, extent: size * CELL}
}
