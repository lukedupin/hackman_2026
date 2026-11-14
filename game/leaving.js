import {createItem, ITEM_TYPES} from './items.js'
import {speak} from './speech.js'

// People walking out of the shop, for when the robot talks to them (see say() in robot.js). A person
// who is sent away stands up if they were sitting, walks to the level's `exit` cell the shortest way
// around the furniture, and is gone: taken off the grid, owning nothing from then on.
const LEAVE_SPEED = 1.0   // blocks a second

const GRUMBLES = [
    "Fine, fine, I'm going.",
    'Wow. Rude. I am leaving.',
    "I didn't want to sit here anyway.",
    'Ugh, whatever. Bye.',
    'Okay okay, I am leaving!',
    'Weirdo. I am out of here.',
]

const WALKING_TYPES = ['walker', 'walker_phone']

const dispose = object => {
    object.traverse(child => {
        child.geometry?.dispose()
        child.material?.map?.dispose()
        child.material?.dispose()
    })
}

// Whether a person could walk through a cell: furniture on the ground and walls are in the way, but
// people, the robot, things on tables and things on the floor you can step over are not
const blocked = (state, self, col, row) => Object.values(state.items).some(other => {
    const traits = ITEM_TYPES[other.type]
    return other !== self && !other.held && !other.gone && other.on === null
        && !traits.walkable && !traits.person && other.type !== 'player'
        && other.cells.some(([c, r]) => c === col && r === row)
})

// The cells from `start` to the level's exit (or, with no exit, the nearest free cell on the edge of the
// grid), nearest way round, as [[col, row], ...] with `start` first. Null if there is no way out.
const findRoute = (state, item, start) => {
    const {size, exit} = state
    const atExit = (col, row) => exit
        ? col === exit[0] && row === exit[1]
        : col === 0 || row === 0 || col === size - 1 || row === size - 1

    const key = (col, row) => `${col},${row}`
    const came = {[key(...start)]: null}
    const queue = [start]

    while (queue.length > 0) {
        const [col, row] = queue.shift()
        if (atExit(col, row)) {
            const route = []
            for (let at = [col, row]; at; at = came[key(...at)]) {
                route.unshift(at)
            }
            return route
        }

        for (const [dc, dr] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
            const next = [col + dc, row + dr]
            if (next[0] < 0 || next[1] < 0 || next[0] >= size || next[1] >= size || key(...next) in came) {
                continue
            }
            if (blocked(state, item, ...next)) {
                continue
            }
            came[key(...next)] = [col, row]
            queue.push(next)
        }
    }
    return null
}

// Takes the person off the grid for good
export const vanish = (state, item) => {
    state.bubbles = state.bubbles.filter(bubble => bubble.item !== item)
    item.mesh.parent?.remove(item.mesh)
    dispose(item.mesh)
    item.gone = true
    item.leaving = false
    item.motion = null
    item.cells = []
}

// Tells a person to get up and go. They say something grumpy as they do: `line`, or one of the usual
// grumbles. Returns false if they have no way out, and true if they are leaving (or already were).
export const sendAway = (state, item, line = GRUMBLES[Math.floor(Math.random() * GRUMBLES.length)]) => {
    if (item.leaving || item.gone) {
        return true
    }

    const path = findRoute(state, item, item.cells[0])
    if (!path) {
        return false
    }

    // A sitting person stands up: their seated model is swapped for a walking one where they were
    if (!WALKING_TYPES.includes(item.type)) {
        const parent = item.mesh.parent
        const {mesh} = createItem('walker')
        mesh.position.copy(item.mesh.position)
        mesh.position.y = 0
        mesh.rotation.y = item.mesh.rotation.y
        parent.remove(item.mesh)
        dispose(item.mesh)
        parent.add(mesh)

        item.mesh = mesh
        item.type = 'walker'
        item.on = null
    }

    // From where they are now, through the middle of each cell on the way
    const route = [item.mesh.position.clone(), ...path.slice(1).map(([col, row]) => state.cellPosition(col, row))]
        .filter((point, i, all) => i === 0 || point.distanceTo(all[i - 1]) > 1e-6)
    const lengths = route.slice(1).map((point, i) => point.distanceTo(route[i]))
    const total = lengths.reduce((sum, length) => sum + length, 0)

    speak(state, item, line)

    if (total === 0) {
        vanish(state, item)
        return true
    }

    item.motion = {route, lengths, total, speed: LEAVE_SPEED, distance: 0, once: true}
    item.leaving = true
    return true
}
