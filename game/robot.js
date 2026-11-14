import * as THREE from 'three'
import {ITEM_TYPES} from './items.js'
import {nearbyItems, NEARBY_RADIUS} from './level_runner.js'
import {fire} from './rules.js'
import {TICK_SECONDS, waitTicks} from './clock.js'

// What the player's code can do with the robot. These are the robot's functions as JavaScript async
// functions (createRobot below); game/python.js makes them available to the player's Python as plain
// functions that look synchronous, and converts what they return into Python dicts and lists.
//
//   move(direction)   one step 'n', 'e', 's' or 'w' (n is toward the back wall, e toward the right), or
//                     'f', 'b', 'l' or 'r': forward, back, left or right of the way the robot faces.
//                     Resolves to {ok: true}, or {ok: false, reason} if something is in the way.
//   scan()            the items within 3 blocks, as [{name, id, owner, owned, away}]. `owner` is the id of
//                     the person it belongs to, if any. `owned` is whether that is in force right now.
//                     `away` says where it is from you, as {n, e, s, w} with just the directions it is
//                     in: {n: 2, e: 1} is two blocks north and one east.
//   pickup(id)        take an item (a cup, mug, wallet, laptop...). It has to be next to you, be something
//                     that can be carried, and not be owned. Trying to take something owned makes its
//                     owner shout at you in a speech bubble. Resolves to {ok, reason?}.
//   say(id, text)     say something to a person within 3 blocks. Resolves to {ok, reason?}.
//   spill(id)         knock over a cup or mug next to you. Resolves to {ok, reason?}.
//   wait(ticks)       do nothing for that many ticks (just wait() is one)
//   inventory()       what you are carrying, as the same kind of list as scan(). Free, it takes no time.
//
// Every action (all of the above except inventory) takes one tick, which is 0.75
// seconds of real time, whether it works or not: a step walks for exactly one tick. wait(n) takes n
// ticks. An action that is refused still uses its tick up. The program does not go on to its next line
// until the tick is over.
//
// What people do when talked to, splashed or told off is not decided here: each person's `rules` in the
// level say (see game/rules.js).
//
// An item is owned when its owner (a person, named by the level) is within 1.5 blocks of it, so a
// wallet left on a table becomes fair game once whoever left it has wandered off. `owner` is always
// the owner's id, but `owned` is only true while they are that close.
//
// Bad calls (an unknown direction, a missing id argument) throw; things that just can't happen in the
// world right now come back as {ok: false, reason}.

const DIRECTIONS = {n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0]}

// Steps from the way the robot faces: forward, back, left and right
const RELATIVE = {f: true, b: true, l: true, r: true}

// The [column, row] step for 'f', 'b', 'l' or 'r' when the robot faces `facing` (an angle, as the robot
// keeps it). Facing is taken as the nearest of north, east, south and west. North is up the screen (row
// going down is south), so facing north, right is east.
// The way a robot faces, as an angle: where it last turned to, or, before it has, the way it was set down
const facingOf = player => player.facing ?? player.mesh.rotation.y

const relativeStep = (facing, way) => {
    const across = Math.sin(facing)
    const down = Math.cos(facing)
    const [fx, fz] = Math.abs(across) >= Math.abs(down) ? [Math.sign(across), 0] : [0, Math.sign(down)]
    const step = {f: [fx, fz], b: [-fx, -fz], r: [-fz, fx], l: [fz, -fx]}[way]
    return step.map(value => value + 0)   // no negative zeros
}

// The compass direction ('n', 'e', 's' or 'w') that 'f', 'b', 'l' or 'r' means for the robot right now, or
// null if the level has no robot. Interactive mode uses it to write out the move it was asked for.
export const compassFor = (state, way) => {
    const player = playerOf(state)
    if (!player) {
        return null
    }
    const [dx, dz] = relativeStep(facingOf(player), way)
    return Object.keys(DIRECTIONS).find(key => DIRECTIONS[key][0] === dx && DIRECTIONS[key][1] === dz) ?? null
}

const REACH = 1        // blocks, counting diagonals, for picking up and spilling

// Thrown to end a program that has been stopped or whose level has gone. Its messages are what
// python.js recognises as that (see HALTED there).
class Halt extends Error {}

const playerOf = state => Object.values(state.items).find(item => item.type === 'player')
const nameOf = item => ITEM_TYPES[item.type].name   // the general name: 'mug', 'table', 'person'

// How many blocks apart two items are, counting a diagonal as one and measuring to the nearest cells.
// An item being carried is nowhere, so it is infinitely far.
const gap = (a, b) => Math.min(...a.cells.flatMap(([ac, ar]) => b.cells.map(([bc, br]) => Math.max(Math.abs(ac - bc), Math.abs(ar - br)))))

// How close, in blocks, an owner has to be to an item for it to count as owned
const OWNERSHIP_RANGE = 1.5

// The person whose ownership of an item is in force right now, if there is one: its owner, when they
// are within OWNERSHIP_RANGE blocks of it, straight-line across the floor (so it changes smoothly as
// a walking owner comes and goes). Further away, or once they have left, the item still has its owner
// (`item.owner`) but isn't owned.
const ownerHere = (state, item) => {
    const owner = item.owner && state.items[item.owner]
    if (!owner || owner.gone || item.held) {
        return null
    }

    const distance = Math.hypot(owner.mesh.position.x - item.mesh.position.x, owner.mesh.position.z - item.mesh.position.z)
    return distance <= OWNERSHIP_RANGE ? owner : null
}

// The item standing in the way of a cell, if any. Things on tables, the rug and anything carried
// don't block.
const blockerAt = (state, self, col, row) => Object.values(state.items).find(item => (
    item !== self && !item.held && item.on === null && !ITEM_TYPES[item.type].walkable
    && item.cells.some(([c, r]) => c === col && r === row)
))

// Which way, and how many blocks, an item is from `from`, as {n, e, s, w} with only the directions it
// is in: an item two blocks north and one east is {n: 2, e: 1}. It is measured to the item's nearest
// cell. An item that is nowhere (being carried) is {}.
const awayFrom = (from, item) => {
    const [fromCol, fromRow] = [from.col, from.row]
    const nearest = item.cells.reduce((best, cell) => {
        const reach = Math.max(Math.abs(cell[0] - fromCol), Math.abs(cell[1] - fromRow))
        return best === null || reach < best.reach ? {cell, reach} : best
    }, null)
    if (!nearest) {
        return {}
    }

    const across = nearest.cell[0] - fromCol
    const down = nearest.cell[1] - fromRow
    const away = {}
    if (down < 0) {
        away.n = -down
    }
    if (down > 0) {
        away.s = down
    }
    if (across > 0) {
        away.e = across
    }
    if (across < 0) {
        away.w = -across
    }
    return away
}

// What an item looks like to the program, from where the robot is
const describe = (state, item, robot) => ({
    name: nameOf(item),
    id: item.id,
    owner: item.owner,
    owned: ownerHere(state, item) !== null,
    away: awayFrom(robot, item),
})

// What the interactive mode shows about an item that has been clicked, or null if there is no such item:
// what scan() would say, plus its label, whether it is near enough to make out (within NEARBY_RADIUS) and
// how far, how it is, and what the robot can try with it (`can`: pickup, say, spill).
export const lookAt = (state, id) => {
    const player = playerOf(state)
    const item = state.items[id]
    if (!player || !item) {
        return null
    }

    const type = ITEM_TYPES[item.type]
    const near = nearbyItems(state, player, NEARBY_RADIUS).find(other => other.id === id)
    const here = !item.gone && !item.held
    return {
        ...describe(state, item, player),
        label: type.label,
        nearby: Boolean(near) || Boolean(item.held),
        distance: near ? near.distance : null,
        held: Boolean(item.held),
        gone: Boolean(item.gone),
        spilled: Boolean(item.spilled),
        on: item.on ? ITEM_TYPES[state.items[item.on].type].label : null,
        can: {
            pickup: Boolean(type.portable) && here,
            say: Boolean(type.person) && !item.gone,
            spill: Boolean(type.spillable) && here && !item.spilled,
        },
    }
}

// The functions for one run of a program. `run` says when it has been stopped, `log` writes a line to
// the output, and everything checks that the level it started on is still the one being played.
export const createRobot = (getState, log, run, clock) => {
    const state = getState()
    const player = state && playerOf(state)
    if (!player) {
        throw new Error('This level has no robot to control')
    }

    const live = () => {
        if (run.stopped) {
            throw new Halt('Stopped.')
        }
        if (getState() !== state) {
            throw new Halt('The level changed.')
        }
    }

    // Turns the robot to look at an item (updateLevel does the turning, over a moment)
    const faceItem = item => {
        const from = player.mesh.position
        const to = item.mesh.position
        if (!item.held && !item.gone && (to.x !== from.x || to.z !== from.z)) {
            player.facing = Math.atan2(to.x - from.x, to.z - from.z)
        }
    }

    const fail = (call, reason) => {
        log('action', `${call} failed: ${reason}`)
        return {ok: false, reason}
    }

    // The item an id names, for the function called `name`
    const itemFor = (name, id) => {
        if (typeof id !== 'string') {
            throw new Error(`${name}() needs the id of an item, like ${name}('mug_1')`)
        }
        return state.items[id]
    }

    // Why the robot can't reach an item with the function called `name`, as a failed result, or null
    // if it can
    const unreachable = (name, item, id) => {
        const call = `${name}('${id}')`
        if (!item) {
            return fail(call, `there is no item '${id}'`)
        }
        if (item.gone) {
            return fail(call, `the ${nameOf(item)} has left`)
        }
        if (item.held) {
            return fail(call, `you are already carrying the ${nameOf(item)}`)
        }
        if (gap(player, item) > REACH) {
            return fail(call, `the ${nameOf(item)} is too far away, it has to be right next to you`)
        }
        return null
    }

    const move = async direction => {
        live()
        const way = String(direction).toLowerCase()
        const delta = DIRECTIONS[way] ?? (way in RELATIVE ? relativeStep(facingOf(player), way) : null)
        if (!delta) {
            throw new Error(`move() takes 'n', 'e', 's' or 'w', or 'f', 'b', 'l' or 'r' from where the robot faces, not '${direction}'`)
        }

        // A step still going from an earlier call that wasn't awaited finishes first
        while (player.walk) {
            await player.walk.done
            live()
        }

        const call = `move('${direction}')`
        const col = player.col + delta[0]
        const row = player.row + delta[1]
        if (col < 0 || row < 0 || col >= state.size || row >= state.size) {
            return fail(call, 'that is the edge of the shop')
        }

        const blocker = blockerAt(state, player, col, row)
        if (blocker) {
            return fail(call, `the ${nameOf(blocker)} (${blocker.id}) is in the way`)
        }

        let finish
        const done = new Promise(resolve => finish = resolve)
        player.walk = {
            from: player.mesh.position.clone(),
            to: state.cellPosition(col, row),
            heading: Math.atan2(delta[0], delta[1]),
            elapsed: 0,
            duration: TICK_SECONDS,
            done,
            resolve: finish,
        }
        player.col = col
        player.row = row
        player.cells = [[col, row]]
        player.facing = player.walk.heading   // after the step it keeps looking the way it went

        await done
        log('action', `${call} -> [${col}, ${row}]`)
        return {ok: true}
    }

    const scan = () => {
        live()
        const found = nearbyItems(state, player, NEARBY_RADIUS).map(near => describe(state, state.items[near.id], player))
        log('action', `scan() -> ${found.length} items`)
        return found
    }

    const inventory = () => {
        live()
        return Object.values(state.items).filter(item => item.held).map(item => describe(state, item, player))
    }

    const pickup = async id => {
        live()
        const item = itemFor('pickup', id)
        if (item) {
            faceItem(item)
        }
        const call = `pickup('${id}')`
        const problem = unreachable('pickup', item, id)
        if (problem) {
            return problem
        }

        if (!ITEM_TYPES[item.type].portable) {
            return fail(call, `a ${nameOf(item)} can't be picked up`)
        }
        const owner = ownerHere(state, item)
        if (owner) {
            // What the owner does about it is up to their rules in the level
            const reaction = fire(state, owner, 'item_grabbed')
            if (reaction?.said) {
                log('action', `The ${nameOf(owner)} (${owner.id}) says: "${reaction.said}"`)
            }
            if (reaction?.left) {
                log('action', `The ${nameOf(owner)} (${owner.id}) gets up and leaves`)
            }
            return fail(call, `it belongs to the ${nameOf(owner)} (${owner.id}), who is right there`)
        }

        // Carried at the robot's side, stacked up
        const carrying = Object.values(state.items).filter(other => other.held).length
        item.held = true
        item.on = null
        item.cells = []
        item.mesh.parent?.remove(item.mesh)
        item.mesh.position.set(0.32, 0.5 + carrying * 0.12, 0.2)
        item.mesh.rotation.set(0, 0, 0)
        player.mesh.add(item.mesh)

        log('action', `${call} -> picked up the ${nameOf(item)}`)
        return {ok: true}
    }

    const say = async (id, text) => {
        live()
        const item = itemFor('say', id)
        const call = `say('${id}', ...)`
        if (!item) {
            return fail(call, `there is no item '${id}'`)
        }
        if (item.gone) {
            return fail(call, `the ${nameOf(item)} has left`)
        }
        faceItem(item)
        if (!ITEM_TYPES[item.type].person) {
            return fail(call, `the ${nameOf(item)} can't hear you, say() is for people`)
        }
        if (item.held || gap(player, item) > NEARBY_RADIUS) {
            return fail(call, `the ${nameOf(item)} is too far away to hear you`)
        }

        log('action', `You say to the ${nameOf(item)} (${id}): "${text}"`)

        // What they do about it is up to their rules in the level
        const reaction = fire(state, item, 'spoken_to')
        if (reaction?.said) {
            log('action', `The ${nameOf(item)} (${id}) says: "${reaction.said}"`)
        }
        if (reaction?.left) {
            log('action', `The ${nameOf(item)} (${id}) gets up and leaves`)
        }
        return {ok: true}
    }

    const spill = async id => {
        live()
        const item = itemFor('spill', id)
        const call = `spill('${id}')`
        const problem = unreachable('spill', item, id)
        if (problem) {
            return problem
        }

        if (!ITEM_TYPES[item.type].spillable) {
            return fail(call, `a ${nameOf(item)} has nothing to spill`)
        }
        if (item.spilled) {
            return fail(call, `the ${nameOf(item)} is already spilled`)
        }

        // On its side, with a puddle where it stood
        item.spilled = true
        const {x, y, z} = item.mesh.position
        const puddle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.13, 0.13, 0.004, 20),
            new THREE.MeshStandardMaterial({color: '#3b2314', roughness: 0.3}),
        )
        puddle.position.set(x, y + 0.003, z)
        item.mesh.parent.add(puddle)
        item.mesh.rotation.z = Math.PI / 2
        item.mesh.position.y += 0.075

        log('action', `${call} -> the ${nameOf(item)} is spilled`)

        // Anyone right next to it gets it on them; what they do about it is up to their rules in the level
        const splashed = Object.values(state.items).filter(other => (
            ITEM_TYPES[other.type].person && !other.gone && gap(other, item) <= REACH
        ))
        for (const person of splashed) {
            const reaction = fire(state, person, 'splashed')
            if (reaction?.said) {
                log('action', `The ${nameOf(person)} (${person.id}) says: "${reaction.said}"`)
            }
            if (reaction?.left) {
                log('action', `The ${nameOf(person)} (${person.id}) gets it all over them and leaves`)
            }
        }
        return {ok: true}
    }

    // Does nothing for `ticks` ticks (one by default). This is the only action that takes more than a tick.
    const wait = async (ticks = 1) => {
        live()
        if (typeof ticks !== 'number' || !(ticks > 0) || !Number.isFinite(ticks)) {
            throw new Error(`wait() takes a number of ticks above 0, not '${ticks}'`)
        }

        log('action', ticks === 1 ? 'wait()' : `wait(${ticks})`)
        await waitTicks(clock, ticks)
        live()
        return {ok: true}
    }

    // Makes an action take a tick. It does its work as soon as it is called, and the program is held
    // until the tick is over. A step's own walk fills the tick, so it is not held any longer.
    const timed = action => async (...args) => {
        live()
        const tick = waitTicks(clock, 1)
        const [result] = await Promise.all([action(...args), tick])
        live()
        return result
    }

    return {
        move: timed(move),
        scan: timed(scan),
        pickup: timed(pickup),
        say: timed(say),
        spill: timed(spill),
        wait,
        inventory,
    }
}

// A run of a program that can be stopped: stop() ends it, and whenStopped resolves when it does
export const createRun = () => {
    const run = {stopped: false}
    run.whenStopped = new Promise(resolve => {
        run.stop = () => {
            run.stopped = true
            resolve()
        }
    })
    return run
}
