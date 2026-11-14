// Every world, in the order they're listed. To add one: make worlds/<id>.js exporting `world` (see
// tutorial.js for the shape) and import it here. A level belongs to the world that lists it.
import {world as tutorial} from './tutorial.js'
import {world as warehouse} from './warehouse.js'
import {world as furniture} from './furniture.js'
import {world as cafe} from './cafe.js'
import {LEVELS} from '../levels/index.js'

export const WORLDS = [tutorial, warehouse, furniture, cafe]

// A mistake here would otherwise show up as a level that silently never appears
const claimed = {}
for (const world of WORLDS) {
    for (const levelId of world.levels) {
        if (!(levelId in LEVELS)) {
            throw new Error(`World '${world.id}' lists level '${levelId}', which doesn't exist in levels/`)
        }
        if (claimed[levelId]) {
            throw new Error(`Level '${levelId}' is listed by both '${claimed[levelId]}' and '${world.id}'`)
        }
        claimed[levelId] = world.id
    }
}

// The world a level is played in
export const worldOf = levelId => WORLDS.find(world => world.levels.includes(levelId)) ?? null

// The level the game opens on
export const FIRST_LEVEL = 'coffee_shop'
if (!worldOf(FIRST_LEVEL)) {
    throw new Error(`FIRST_LEVEL '${FIRST_LEVEL}' isn't in any world`)
}
