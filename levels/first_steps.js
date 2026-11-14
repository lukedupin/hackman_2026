// A level is plain data. The file name is the level's id (snake_case).
export const level = {
    id: 'first_steps',
    name: 'First Steps',
    description: 'Get the player to the goal.',

    // What is on the grid at the start. Every item has a unique id, a type from game/items.js, and a cell [col, row]
    items: [
        {id: 'p1', type: 'player', at: [2, 13]},
        {id: 'g1', type: 'goal', at: [13, 2]},
    ],

    // What has to be true to finish. Types come from game/conditions.js
    conditions: [
        {type: 'item_on_item', item: 'p1', target: 'g1'},
    ],
}
