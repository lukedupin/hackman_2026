// Every level, by id. To add one: make levels/<id>.js exporting `level` (see first_steps.js for the
// shape), import it here, and list its id in a world (worlds/).
//
//   level = {
//       id           the file name, snake_case
//       name         shown in the level dropdown
//       description  one line for the player
//       items        what starts on the grid, each one of:
//                      {id, type, at: [col, row], rotate?}          on the ground; `at` is the top-left cell it covers
//                      {id, type, on: 'item id', offset?, rotate?}  on top of an earlier item; `offset` is [x, z] in cells
//                    People can also have {path, speed} (a loop to walk, see coffee_shop.js), `owner` (a person's
//                    id) and `rules`: [{when, say?, leave?}], what they do when the robot speaks to them
//                    ('spoken_to'), spills a drink beside them ('splashed') or tries to take their things
//                    ('item_grabbed'). A person with no rule for an event does nothing about it.
//                    `rotate` is quarter turns clockwise. Any other field is handed to the asset, which
//                    is how people get their {skin, shirt, pants, hair}.
//       exit         optional, [col, row] people walk to when they leave (without one, the nearest edge)
//       conditions   [{type, ...params}]                what has to hold to finish
//       mode         optional, 'all' (default) or 'any' conditions have to hold
//   }
import {level as first_steps} from './first_steps.js'
import {level as wall_maze} from './wall_maze.js'
import {level as push_it} from './push_it.js'
import {level as showroom} from './showroom.js'
import {level as desk} from './desk.js'
import {level as coffee_shop} from './coffee_shop.js'

export const LEVELS = Object.fromEntries(
    [first_steps, wall_maze, push_it, showroom, desk, coffee_shop].map(level => [level.id, level])
)
