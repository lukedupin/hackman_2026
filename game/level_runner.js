import {createItem} from './items.js'
import {CONDITIONS} from './conditions.js'
import {updateBubbles} from './speech.js'
import {vanish} from './leaving.js'
import {checkRules} from './rules.js'

// Frees what an item's meshes hold on the GPU
const disposeObject = object => {
    object.traverse(child => {
        child.geometry?.dispose()
        child.material?.map?.dispose()
        child.material?.dispose()
    })
}

// Puts a level's items on the grid, replacing whatever was there. Returns the level's state:
// {items: {id: {id, type, col, row, cells, mesh, surface}}}, where col / row is the item's top-left
// cell and `cells` is every [col, row] it covers. Throws, naming the level, if the level is broken.
//
// An item is placed one of two ways. `at: [col, row]` puts it on the ground, with that as the
// top-left cell of its footprint. `on: 'item id'` puts it on top of an item that comes earlier in
// the list, centered on it, with an optional `offset: [x, z]` in cells to move it around the top.
// `rotate` is optional, in quarter turns clockwise seen from above: 0 faces down the grid (+row),
// 1 faces left, 2 up, 3 right. An odd rotation swaps the footprint's columns and rows.
//
// A one-cell item on the ground can instead have `path: [[col, row], ...]`: it starts on the first
// cell and walks to each in turn, from the last back to the first, over and over, facing the way it
// goes (so it needs no `at` or `rotate`). `speed` is optional, in cells per second (default 0.8).
// Only the straight lines between the cells are walked, so keep them clear of anything in the way.
// updateLevel() moves it, and its `col` / `row` / `cells` follow it.
const WALK_SPEED = 0.8

// How far, in blocks, the robot can see: what scan() returns and the nearby window lists
export const NEARBY_RADIUS = 3

export const loadLevel = (grid, level) => {
    for (const child of [...grid.group.items.children]) {
        grid.group.items.remove(child)
        disposeObject(child)
    }

    const state = {items: {}, bubbles: [], exit: level.exit ?? null, time: 0, size: grid.size, cellAt: grid.cellAt, cellPosition: grid.cellPosition}

    for (const item of level.items) {
        const where = `Level '${level.id}', item '${item.id}'`
        if (state.items[item.id]) {
            throw new Error(`${where}: the id is used twice`)
        }

        const rotate = ((item.rotate ?? 0) % 4 + 4) % 4
        const {mesh, footprint, placement, top} = createItem(item.type, item)
        const [cols, rows] = rotate % 2 === 0 ? footprint : [footprint[1], footprint[0]]

        if (item.on !== undefined && item.at !== undefined) {
            throw new Error(`${where}: has both 'at' and 'on', it needs just one`)
        }

        let cells = []
        let col, row, floor
        let motion = null

        if (item.path !== undefined) {
            if (item.on !== undefined || item.at !== undefined || item.rotate !== undefined) {
                throw new Error(`${where}: has a 'path', so it can't also have 'at', 'on' or 'rotate'`)
            }
            if (placement === 'surface' || cols !== 1 || rows !== 1) {
                throw new Error(`${where}: only a one-cell item that goes on the ground can have a 'path'`)
            }
            if (item.path.length < 2) {
                throw new Error(`${where}: a 'path' needs at least two cells`)
            }

            const route = item.path.map(([c, r]) => {
                if (c < 0 || r < 0 || c >= grid.size || r >= grid.size) {
                    throw new Error(`${where}: path cell [${c}, ${r}] is off the grid`)
                }
                return grid.cellPosition(c, r)
            })
            const lengths = route.map((from, i) => from.distanceTo(route[(i + 1) % route.length]))
            if (lengths.some(length => length === 0)) {
                throw new Error(`${where}: a 'path' can't list the same cell twice in a row`)
            }

            motion = {
                route, lengths, speed: item.speed ?? WALK_SPEED, distance: 0,
                total: lengths.reduce((sum, length) => sum + length, 0),
            }
        }

        if (item.on !== undefined) {
            // On top of another item: centered on it (moved by `offset`, in cells), at its top surface
            if (placement === 'ground') {
                throw new Error(`${where}: a ${item.type} goes on the ground, it can't be put on an item`)
            }

            const base = state.items[item.on]
            if (!base) {
                throw new Error(`${where}: 'on' names '${item.on}', which isn't an item before it in the list`)
            }
            if (base.surface === null) {
                throw new Error(`${where}: nothing can sit on '${item.on}' (a ${base.type})`)
            }

            // Only as far from the middle as the item underneath reaches
            const [dx, dz] = item.offset ?? [0, 0]
            if (Math.abs(dx) > base.size[0] / 2 || Math.abs(dz) > base.size[1] / 2) {
                throw new Error(`${where}: offset [${dx}, ${dz}] is off the top of '${item.on}', which is ${base.size[0]} by ${base.size[1]} cells`)
            }
            floor = base.surface
            mesh.position.set(base.mesh.position.x + dx, floor, base.mesh.position.z + dz)

            const cell = grid.cellAt(mesh.position)
            if (!cell) {
                throw new Error(`${where}: with that offset it is off the grid`)
            }
            col = cell.col
            row = cell.row
            cells = [[col, row]]
        }
        else {
            // On the ground: `at` is the top-left cell of what it covers
            if (placement === 'surface') {
                throw new Error(`${where}: a ${item.type} goes on top of an item, give it 'on' instead of 'at'`)
            }

            ;[col, row] = item.at ?? item.path?.[0] ?? []
            if (col === undefined) {
                throw new Error(`${where}: needs 'at', 'on' or 'path'`)
            }
            if (col < 0 || row < 0 || col + cols > grid.size || row + rows > grid.size) {
                throw new Error(`${where}: ${cols} by ${rows} at [${col}, ${row}] doesn't fit on the ${grid.size} by ${grid.size} grid`)
            }

            // The mesh is centered on its footprint, so it goes at the middle of the cells it covers
            const first = grid.cellPosition(col, row)
            const last = grid.cellPosition(col + cols - 1, row + rows - 1)
            mesh.position.set((first.x + last.x) / 2, 0, (first.z + last.z) / 2)
            floor = 0

            for (let r = row; r < row + rows; r++) {
                for (let c = col; c < col + cols; c++) {
                    cells.push([c, r])
                }
            }
        }

        mesh.rotation.y = -rotate * Math.PI / 2
        if (motion) {
            mesh.rotation.y = headingOf(motion, 0)
        }
        grid.group.items.add(mesh)

        // `surface` is how high things set on this item sit, or null if nothing can
        state.items[item.id] = {
            id: item.id, type: item.type, on: item.on ?? null, owner: item.owner ?? null, rules: item.rules ?? [], held: false, col, row, cells, mesh, size: [cols, rows], motion,
            surface: top === null ? null : floor + top,
        }
    }

    // An owner is another item in the level (the person who owns it), and rules have to make sense
    for (const item of Object.values(state.items)) {
        checkRules(level.id, item.id, item.rules)
        if (item.owner !== null && !state.items[item.owner]) {
            throw new Error(`Level '${level.id}', item '${item.id}': owner '${item.owner}' isn't an item`)
        }
    }

    // A condition that names something the level doesn't have could never be met
    for (const condition of level.conditions) {
        if (!(condition.type in CONDITIONS)) {
            throw new Error(`Level '${level.id}': unknown condition type '${condition.type}'`)
        }
        for (const key of ['item', 'target']) {
            if (key in condition && !state.items[condition[key]]) {
                throw new Error(`Level '${level.id}': condition '${condition.type}' names '${condition[key]}', which isn't an item`)
            }
        }
    }

    return state
}

// The direction (as a turn about y, where 0 faces +z) of the leg of a route that is `index`
const headingOf = (motion, index) => {
    const from = motion.route[index]
    const to = motion.route[(index + 1) % motion.route.length]
    return Math.atan2(to.x - from.x, to.z - from.z)
}

// Moves a level on by `delta` seconds: walkers go along their paths, and anything that animates
// (people typing, looking at phones, working) takes its next step. Call it every frame.
export const updateLevel = (state, delta) => {
    state.time += delta
    updateBubbles(state, delta)

    let index = 0
    for (const item of Object.values(state.items)) {
        index++
        if (item.gone) {
            continue
        }
        const {motion, mesh} = item

        if (motion) {
            if (motion.once) {
                // A one-way trip (someone leaving): at the end they are gone
                motion.distance += motion.speed * delta
                if (motion.distance >= motion.total) {
                    vanish(state, item)
                    continue
                }
            }
            else {
                motion.distance = (motion.distance + motion.speed * delta) % motion.total
            }

            let along = motion.distance
            let leg = 0
            while (leg < motion.lengths.length - 1 && along > motion.lengths[leg]) {
                along -= motion.lengths[leg]
                leg++
            }

            const from = motion.route[leg]
            const to = motion.route[(leg + 1) % motion.route.length]
            const t = along / motion.lengths[leg]
            mesh.position.set(from.x + (to.x - from.x) * t, 0, from.z + (to.z - from.z) * t)

            // Turn toward where it's going over a moment, the short way around
            const turn = headingOf(motion, leg) - mesh.rotation.y
            mesh.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * Math.min(1, delta * 8)

            const cell = state.cellAt(mesh.position)
            if (cell) {
                item.col = cell.col
                item.row = cell.row
                item.cells = [[cell.col, cell.row]]
            }
        }

        // A single step the robot is taking (see game/robot.js): slide to the next cell, with a small
        // hop, turning toward it, then say the step is done
        const step = item.walk
        if (step) {
            step.elapsed += delta
            const t = Math.min(1, (step.elapsed + 1e-6) / step.duration)   // (the 1e-6 absorbs rounding in the frame times)
            mesh.position.lerpVectors(step.from, step.to, t)
            mesh.position.y = 0.06 * Math.sin(t * Math.PI)

            const turn = step.heading - mesh.rotation.y
            mesh.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * Math.min(1, delta * 12)

            if (t >= 1) {
                mesh.position.y = 0
                item.walk = null
                step.resolve()
            }
        }
        else if (item.facing !== undefined && item.facing !== null) {
            // Standing still but told to face somewhere (the robot turning to whoever it is dealing with)
            const turn = item.facing - mesh.rotation.y
            mesh.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * Math.min(1, delta * 8)
        }

        // Each one at its own point in the loop, so a room of them doesn't move in step
        mesh.userData.animate?.(state.time + index * 1.7, Boolean(step))
    }
}

// Every item (other than `from` itself) within `radius` blocks of the item `from`, nearest first, as
// [{id, type, on, distance}], where `on` is the type of what it sits on, if anything. Distance is across the floor, from the middle of `from` to the nearest
// part of the other item: its middle, or for one covering several cells, the middle of the closest cell.
export const nearbyItems = (state, from, radius) => {
    const origin = from.mesh.position
    const found = []

    for (const item of Object.values(state.items)) {
        if (item === from) {
            continue
        }

        const spots = item.cells.length === 1
            ? [item.mesh.position]
            : item.cells.map(([col, row]) => state.cellPosition(col, row))
        const distance = Math.min(...spots.map(spot => Math.hypot(spot.x - origin.x, spot.z - origin.z)))

        if (distance <= radius) {
            found.push({id: item.id, type: item.type, on: item.on ? state.items[item.on].type : null, distance})
        }
    }

    return found.sort((a, b) => a.distance - b.distance)
}

// Where the level stands: each condition with whether it holds, and whether the level is complete.
// A level is complete when all its conditions hold, or any one does when `mode` is 'any'.
export const checkLevel = (level, state) => {
    const conditions = level.conditions.map(condition => ({
        label: CONDITIONS[condition.type].describe(condition),
        met: CONDITIONS[condition.type].check(state, condition),
    }))

    const complete = conditions.length > 0 && (
        level.mode === 'any' ? conditions.some(c => c.met) : conditions.every(c => c.met)
    )

    return {conditions, complete}
}
