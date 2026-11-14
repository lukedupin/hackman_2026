export const level = {
    id: 'wall_maze',
    name: 'Wall Maze',
    description: 'Find a way around the walls to the goal.',

    items: [
        {id: 'p1', type: 'player', at: [1, 14]},
        {id: 'g1', type: 'goal', at: [14, 1]},

        {id: 'w1', type: 'wall', at: [4, 15]},
        {id: 'w2', type: 'wall', at: [4, 14]},
        {id: 'w3', type: 'wall', at: [4, 13]},
        {id: 'w4', type: 'wall', at: [4, 12]},
        {id: 'w5', type: 'wall', at: [8, 0]},
        {id: 'w6', type: 'wall', at: [8, 1]},
        {id: 'w7', type: 'wall', at: [8, 2]},
        {id: 'w8', type: 'wall', at: [8, 3]},
        {id: 'w9', type: 'wall', at: [8, 4]},
        {id: 'w10', type: 'wall', at: [8, 5]},
        {id: 'w11', type: 'wall', at: [11, 15]},
        {id: 'w12', type: 'wall', at: [11, 14]},
        {id: 'w13', type: 'wall', at: [11, 13]},
        {id: 'w14', type: 'wall', at: [11, 12]},
        {id: 'w15', type: 'wall', at: [11, 11]},
        {id: 'w16', type: 'wall', at: [11, 10]},
    ],

    conditions: [
        {type: 'item_on_item', item: 'p1', target: 'g1'},
    ],
}
