// Every asset on the grid, to see how they look. A goal-less level, so it can't be finished.
export const level = {
    id: 'showroom',
    name: 'Showroom',
    description: 'One of each asset. Nothing to do here but look around.',

    items: [
        {id: 'rug1', type: 'rug', at: [3, 6]},
        {id: 'couch1', type: 'couch', at: [3, 8], rotate: 2},
        {id: 'low1', type: 'low_table', at: [3, 5]},
        {id: 'chair1', type: 'chair', at: [5, 6], rotate: 1},
        {id: 'stool1', type: 'stool', at: [8, 6]},
        {id: 'tall1', type: 'tall_table', at: [10, 6]},
        {id: 'wall1', type: 'wall', at: [12, 6]},
        {id: 'chair2', type: 'chair', at: [10, 8]},
    ],

    conditions: [],
}
