// Every asset: a thing that sits on the ground or on top of another item. Each file exports `asset`:
//
//   asset = {
//       label       a name for people, describing this exact asset (shown in the nearby window)
//                   (the general name the robot's code sees, like 'mug' or 'table', is set in NAMES below)
//       footprint   [cols, rows] of cells it covers, before any rotation
//       placement   optional: 'ground' (default) goes on a cell, 'surface' goes on top of another
//                   item, 'any' can do either
//       top         optional: how high above where it stands its top surface is, for things set on
//                   it. Leave it out for something nothing can sit on (a wall).
//       build       () -> a THREE.Group, centered on the middle of the footprint, standing on y = 0.
//                   A cell is 1 wide and the parts are put together with assets/parts.js.
//   }
//
// The file name is the asset's type, which is what a level's item `type` names. Facing: an asset
// that has a front (chair, couch, laptop) faces +z, down the grid, at rotate 0.
//
// To add one: make assets/<type>.js, import it here, and add it to the list.
import {asset as low_table} from './low_table.js'
import {asset as tall_table} from './tall_table.js'
import {asset as chair} from './chair.js'
import {asset as wall} from './wall.js'
import {asset as couch} from './couch.js'
import {asset as stool} from './stool.js'
import {asset as rug} from './rug.js'

import {asset as coffee_mug} from './coffee_mug.js'
import {asset as cup} from './cup.js'
import {asset as laptop} from './laptop.js'
import {asset as magazine} from './magazine.js'
import {asset as glasses} from './glasses.js'
import {asset as desktop_computer} from './desktop_computer.js'
import {asset as trash_can} from './trash_can.js'
import {asset as plant} from './plant.js'
import {asset as files} from './files.js'
import {asset as stapler} from './stapler.js'
import {asset as wallet} from './wallet.js'

import {asset as counter} from './counter.js'
import {asset as cafe_table} from './cafe_table.js'
import {asset as espresso_machine} from './espresso_machine.js'
import {asset as sitter_phone} from './sitter_phone.js'
import {asset as sitter_laptop} from './sitter_laptop.js'
import {asset as walker} from './walker.js'
import {asset as walker_phone} from './walker_phone.js'
import {asset as barista} from './barista.js'
import {asset as player} from './player.js'

// `build` is handed the level's item, so an asset can look different per item. The people read
// {skin, shirt, pants, hair} from it (see person.js).
const LISTED = {
    // On the ground
    low_table, tall_table, chair, wall, couch, stool, rug, counter, cafe_table,

    // On top of things
    coffee_mug, cup, laptop, magazine, glasses, desktop_computer, trash_can, plant, files, stapler, wallet,
    espresso_machine,

    // People: sitters go on a chair or stool, the rest on the ground
    sitter_phone, sitter_laptop, walker, walker_phone, barista,

    // The thing the player moves
    player,
}

// What the robot can do with an asset, by type. Each trait is a flag on the asset that game/robot.js reads:
//   portable    pickup() works on it (unless its owner is right next to it)
//   spillable   spill() works on it
//   person      say() works on it
//   walkable    the robot can step onto its cell
const TRAITS = {
    portable: ['coffee_mug', 'cup', 'wallet', 'magazine', 'glasses', 'stapler', 'files', 'laptop'],
    spillable: ['coffee_mug', 'cup'],
    person: ['sitter_phone', 'sitter_laptop', 'walker', 'walker_phone', 'barista'],
    walkable: ['rug'],
}

// The general name the robot's code sees for each type (`name` in scan()), as opposed to `label`, which
// describes the exact asset to people. Types that are the same kind of thing share a name.
const NAMES = {
    low_table: 'table', tall_table: 'table', cafe_table: 'table',
    chair: 'chair', stool: 'stool', couch: 'couch', rug: 'rug', wall: 'wall', counter: 'counter',
    coffee_mug: 'mug', cup: 'cup', laptop: 'laptop', magazine: 'magazine', glasses: 'glasses',
    desktop_computer: 'computer', trash_can: 'trash can', plant: 'plant', files: 'files', stapler: 'stapler',
    wallet: 'wallet', espresso_machine: 'espresso machine',
    sitter_phone: 'person', sitter_laptop: 'person', walker: 'person', walker_phone: 'person', barista: 'person',
    player: 'robot',
}

export const ASSETS = Object.fromEntries(
    Object.entries(LISTED).map(([type, asset]) => {
        if (!(type in NAMES)) {
            throw new Error(`Asset '${type}' has no general name, add it to NAMES in assets/index.js`)
        }
        return [
            type,
            {
                ...asset,
                name: NAMES[type],
                ...Object.fromEntries(Object.entries(TRAITS).map(([trait, types]) => [trait, types.includes(type)])),
            },
        ]
    })
)
