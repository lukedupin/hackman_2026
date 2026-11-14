export const level = {
    id: 'push_it',
    name: 'Push It',
    description: 'Put every crate on a goal.',

    items: [
        {id: 'p1', type: 'player', at: [7, 8]},

        {id: 'c1', type: 'crate', at: [5, 5]},
        {id: 'c2', type: 'crate', at: [8, 6]},
        {id: 'c3', type: 'crate', at: [10, 9]},

        {id: 'g1', type: 'goal', at: [3, 12]},
        {id: 'g2', type: 'goal', at: [7, 12]},
        {id: 'g3', type: 'goal', at: [12, 12]},
    ],

    conditions: [
        {type: 'all_on', kind: 'crate', target_kind: 'goal'},
    ],
}
