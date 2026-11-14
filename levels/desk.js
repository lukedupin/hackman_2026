// Things on top of other things. Items with `on` sit on the item they name, which has to come earlier
// in the list; `offset` moves them around its top, in cells.
export const level = {
    id: 'desk',
    name: 'Desk',
    description: 'One of each tabletop asset. Nothing to do here but look around.',

    items: [
        {id: 'table1', type: 'low_table', at: [3, 5]},
        {id: 'mug1', type: 'coffee_mug', on: 'table1', offset: [-0.25, 0.2]},
        {id: 'mag1', type: 'magazine', on: 'table1', offset: [0.1, -0.05]},
        {id: 'glasses1', type: 'glasses', on: 'table1', offset: [0.1, 0.3]},

        {id: 'table2', type: 'tall_table', at: [6, 5]},
        {id: 'laptop1', type: 'laptop', on: 'table2', offset: [-0.02, 0.05]},
        {id: 'cup1', type: 'cup', on: 'table2', offset: [0.3, 0.22]},

        {id: 'table3', type: 'low_table', at: [9, 5]},
        {id: 'pc1', type: 'desktop_computer', on: 'table3'},
        {id: 'stapler1', type: 'stapler', on: 'table3', offset: [-0.3, 0.32]},
        {id: 'files1', type: 'files', on: 'table3', offset: [0.3, 0.3]},

        {id: 'stool1', type: 'stool', at: [12, 5]},
        {id: 'plant1', type: 'plant', on: 'stool1'},

        {id: 'trash1', type: 'trash_can', at: [13, 6]},
        {id: 'plant2', type: 'plant', at: [14, 6]},

        {id: 'couch1', type: 'couch', at: [6, 8], rotate: 2},
        {id: 'mag2', type: 'magazine', on: 'couch1', offset: [0.5, 0], rotate: 1},
    ],

    conditions: [],
}
