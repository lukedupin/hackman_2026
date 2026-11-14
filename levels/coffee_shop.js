// A busy coffee shop: a U-shaped bar in the middle with baristas inside it and customers on stools
// around the outside, cafe tables along the edges, and people walking about. Written with a few
// helpers so the people and furniture can be moved around without redoing the numbers.
//
// Everyone is white and has a loop of their own: the walkers go round a route (`path`), the sitters
// scroll, type or glance about, and the baristas work the bar.
//
// A person at rotate R looks the way a chair at rotate R faces. A laptop's front faces +z at
// rotate 0, so one turned toward a person at R is at R + 2.
const items = []

const turnedAround = rotate => (rotate + 2) % 4

// A person standing at a spot, facing `rotate`
const stand = (id, type, at, rotate) => {
    items.push({id, type, at, rotate})
}

// A person walking round a loop of cells: from the last back to the first, over and over
const walk = (id, type, path, speed) => {
    items.push({id, type, path, speed})
}

// A person sitting on a chair or stool that is already in the list, facing the same way as it
const sit = (id, type, seat, rotate) => {
    items.push({id, type, on: seat, rotate})
}

// A chair with someone in it
const seated = (id, type, at, rotate) => {
    items.push({id: `${id}_chair`, type: 'chair', at, rotate})
    sit(id, type, `${id}_chair`, rotate)
}

// Something on top of an item, a laptop turned toward whoever sits at `rotate`
const put = (id, type, on, offset, rotate) => {
    items.push({id, type, on, offset, rotate})
}

// The back wall
for (let col = 0; col < 16; col++) {
    items.push({id: `wall_${col}`, type: 'wall', at: [col, 0]})
}

// The bar: a U open toward the back wall. The bottom of the U is row 7 and the legs are columns 5
// and 10. It is laid out below with its opening toward the front of the shop and every spot goes
// through flip(), which turns the whole bar and everyone at it half way round the middle of the
// bar: the cell [col, row] goes to [15 - col, 10 - row] and each facing turns two quarter turns.
const flip = ([col, row]) => [15 - col, 10 - row]
const half = rotate => (rotate + 2) % 4

const BAR = [
    [5, 3], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3],
    [5, 4], [5, 5], [5, 6], [5, 7],
    [10, 4], [10, 5], [10, 6], [10, 7],
]
for (const [col, row] of BAR) {
    items.push({id: `bar_${col}_${row}`, type: 'counter', at: flip([col, row])})
}

// Behind the bar
put('machine_1', 'espresso_machine', 'bar_6_3', [0, 0], half(0))
put('machine_2', 'espresso_machine', 'bar_9_3', [0, 0], half(0))
put('bar_mug_1', 'coffee_mug', 'bar_7_3', [0, -0.1], 0)
stand('barista_1', 'barista', flip([7, 4]), half(2))
stand('barista_2', 'barista', flip([9, 5]), half(3))

// Stools around the outside of the bar
items.push(
    {id: 'stool_l1', type: 'stool', at: flip([4, 5])},
    {id: 'stool_l2', type: 'stool', at: flip([4, 6])},
    {id: 'stool_r1', type: 'stool', at: flip([11, 5])},
    {id: 'stool_r2', type: 'stool', at: flip([11, 6])},
    {id: 'stool_b1', type: 'stool', at: flip([6, 2])},
    {id: 'stool_b2', type: 'stool', at: flip([8, 2])},
)
sit('bar_left_1', 'sitter_phone', 'stool_l1', half(3))
put('bar_left_mug', 'coffee_mug', 'bar_5_5', [0, 0], 0)
sit('bar_left_2', 'sitter_laptop', 'stool_l2', half(3))
put('bar_left_laptop', 'laptop', 'bar_5_6', [0, 0], turnedAround(half(3)))
sit('bar_right_1', 'sitter_phone', 'stool_r1', half(1))
put('bar_right_cup', 'cup', 'bar_10_5', [0, 0], 0)
sit('bar_right_2', 'sitter_laptop', 'stool_r2', half(1))
put('bar_right_laptop', 'laptop', 'bar_10_6', [0, 0], turnedAround(half(1)))
sit('bar_back_1', 'sitter_phone', 'stool_b1', half(2))
sit('bar_back_2', 'sitter_laptop', 'stool_b2', half(2))
put('bar_back_laptop', 'laptop', 'bar_8_3', [0, 0], turnedAround(half(2)))

// Tables along the left edge, chairs on the side toward the room
items.push(
    {id: 'table_l1', type: 'cafe_table', at: [1, 3]},
    {id: 'table_l2', type: 'cafe_table', at: [1, 6]},
    {id: 'table_l3', type: 'cafe_table', at: [1, 9]},
)
seated('left_1', 'sitter_phone', [2, 3], 1)
put('left_1_mug', 'coffee_mug', 'table_l1', [0.2, 0.2], 0)
seated('left_2', 'sitter_laptop', [2, 6], 1)
put('left_2_laptop', 'laptop', 'table_l2', [0, 0], turnedAround(1))
put('left_2_cup', 'cup', 'table_l2', [0.25, 0.25], 0)
seated('left_3', 'sitter_laptop', [2, 9], 1)
put('left_3_laptop', 'laptop', 'table_l3', [0, 0], turnedAround(1))
seated('left_4', 'sitter_phone', [1, 10], 2)
put('left_4_mug', 'coffee_mug', 'table_l3', [0.2, 0.25], 0)

// Along the right edge
items.push(
    {id: 'table_r1', type: 'cafe_table', at: [14, 3]},
    {id: 'table_r2', type: 'cafe_table', at: [14, 6]},
    {id: 'table_r3', type: 'cafe_table', at: [14, 9]},
)
seated('right_1', 'sitter_laptop', [13, 3], 3)
put('right_1_laptop', 'laptop', 'table_r1', [0, 0], turnedAround(3))
put('right_1_mug', 'coffee_mug', 'table_r1', [-0.25, 0.25], 0)
seated('right_2', 'sitter_phone', [13, 6], 3)
put('right_2_cup', 'cup', 'table_r2', [0, 0.1], 0)
seated('right_3', 'sitter_laptop', [13, 9], 3)
put('right_3_laptop', 'laptop', 'table_r3', [0, 0], turnedAround(3))
put('right_3_cup', 'cup', 'table_r3', [-0.25, 0.25], 0)
seated('right_4', 'sitter_phone', [14, 10], 2)

// Along the front edge
items.push(
    {id: 'table_f1', type: 'cafe_table', at: [3, 14]},
    {id: 'table_f2', type: 'cafe_table', at: [6, 14]},
    {id: 'table_f3', type: 'cafe_table', at: [9, 14]},
    {id: 'table_f4', type: 'cafe_table', at: [12, 14]},
)
seated('front_1', 'sitter_laptop', [3, 13], 0)
put('front_1_laptop', 'laptop', 'table_f1', [0, 0], turnedAround(0))
put('front_1_mug', 'coffee_mug', 'table_f1', [0.25, -0.2], 0)
seated('front_2', 'sitter_phone', [6, 13], 0)
put('front_2_mug', 'coffee_mug', 'table_f2', [0, 0], 0)
put('front_2_wallet', 'wallet', 'table_f2', [0.22, -0.12], 1)
seated('front_3', 'sitter_phone', [9, 13], 0)
put('front_3_cup', 'cup', 'table_f3', [0, 0.05], 0)
seated('front_4', 'sitter_laptop', [12, 13], 0)
put('front_4_laptop', 'laptop', 'table_f4', [0, 0], turnedAround(0))

// People on their feet, each on a loop of their own that keeps clear of the others and the furniture
walk('walker_1', 'walker', [[3, 9], [5, 9], [5, 12], [3, 12]], 0.8)
walk('walker_2', 'walker_phone', [[7, 9], [9, 9], [9, 11], [7, 11]], 0.6)
walk('walker_3', 'walker', [[11, 10], [12, 10], [12, 12], [11, 12]], 0.9)
walk('walker_4', 'walker_phone', [[3, 4], [3, 8]], 0.5)
walk('walker_5', 'walker_phone', [[12, 4], [12, 8]], 0.55)
walk('walker_6', 'walker', [[6, 1], [9, 1]], 0.9)

// The player starts right in the front right corner, facing into the shop
stand('player_1', 'player', [15, 15], 2)

// Dressing
items.push(
    {id: 'rug', type: 'rug', at: [7, 13]},
    {id: 'plant_l', type: 'plant', at: [0, 1]},
    {id: 'plant_r', type: 'plant', at: [15, 1]},
    {id: 'trash', type: 'trash_can', at: [15, 13]},
)

// Who owns what. The things on a table belong to the person sitting at it (laptops, mugs and cups), the
// bar's to whoever is at the bar, and the wallet to a walker who left it behind: it only counts as owned while the owner is
// within 1.5 blocks of it, so the wallet can be taken once the walker has gone off on their loop.
const OWNERS = {
    left_1_mug: 'left_1',
    left_2_cup: 'left_2',
    left_4_mug: 'left_4',
    right_1_mug: 'right_1',
    right_2_cup: 'right_2',
    right_3_cup: 'right_3',
    front_1_mug: 'front_1',
    front_2_mug: 'front_2',
    front_3_cup: 'front_3',
    front_2_wallet: 'walker_1',
    left_2_laptop: 'left_2',
    left_3_laptop: 'left_3',
    right_1_laptop: 'right_1',
    right_3_laptop: 'right_3',
    front_1_laptop: 'front_1',
    front_4_laptop: 'front_4',
    bar_left_laptop: 'bar_left_2',
    bar_right_laptop: 'bar_right_2',
    bar_back_laptop: 'bar_back_2',
    bar_mug_1: 'barista_1',
    bar_left_mug: 'bar_left_1',
    bar_right_cup: 'bar_right_1',
}
for (const item of items) {
    if (item.id in OWNERS) {
        item.owner = OWNERS[item.id]
    }
}

export const level = {
    id: 'coffee_shop',
    name: 'Coffee Shop',

    // Where people leave by, at the front of the shop
    exit: [8, 15],
    description: 'A busy morning. Nothing to do but look around.',

    items,

    conditions: [],
}
