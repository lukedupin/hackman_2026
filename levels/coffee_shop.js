// A busy coffee shop: a U-shaped bar in the middle with baristas inside it and customers on stools
// around the outside, cafe tables along the edges, and people walking about.
//
// The level is complete in this file: every item is written out with where it is and what it does.
//   at / on / offset   where it is: a cell [col, row], or on top of an earlier item (`offset` in cells)
//   rotate             quarter turns clockwise; a person looks the way a chair at the same rotate faces,
//                      and a laptop turned toward a person at R is at R + 2
//   path, speed        a walker's loop of cells, from the last back to the first, and its speed
//   owner              the id of the person it belongs to. It only counts as owned while that person
//                      is within 1.5 blocks of it.
//   rules              what a person does when something happens to them (see game/rules.js): when the
//                      robot speaks to them, spills a drink beside them, or tries to take their things.
//                      Each rule can make them `say` something and `leave` (get up and walk out by `exit`).
//
// Everyone is white and has a loop of their own: the walkers go round a route, the sitters scroll,
// type or glance about, and the baristas work the bar. An item can only be put on one that is listed
// before it, so tables and chairs come before what is on them.

// How each kind of person reacts. Change a list here to change how all of them do, or give one person
// a `rules` of their own in the items below.
const SITTER_RULES = [
    {
        when: 'spoken_to',
        say: ["Fine, fine, I'm going.", 'Wow. Rude. I am leaving.', "I didn't want to sit here anyway.", 'Ugh, whatever. Bye.'],
        leave: true,
    },
    {
        when: 'splashed',
        say: ['Hey! My shirt! Look what you did!', 'Oh come ON! I am leaving!', 'You got it all over me! I am done.'],
        leave: true,
    },
    {
        when: 'item_grabbed',
        say: ['Buzz off!', 'Hey! Leave my stuff alone!', "That's mine. Hands off, tin can!", 'Do I look like I share?'],
    },
]

const WALKER_RULES = [
    {
        when: 'spoken_to',
        say: ['Okay okay, I am leaving!', 'Weirdo. I am out of here.', "I don't have time for this."],
        leave: true,
    },
    {
        when: 'splashed',
        say: ['Are you kidding me?! Unbelievable!', 'Oh come ON! I am leaving!'],
        leave: true,
    },
    {
        when: 'item_grabbed',
        say: ['Get your grubby claws off my things!', 'Scram, you rusty heap!', 'Mine! Go find your own.'],
    },
]

const BARISTA_RULES = [
    {
        when: 'spoken_to',
        say: ["Fine, I'm taking my break.", 'Wow. I am clocking out.', 'Ugh, whatever. Bye.'],
        leave: true,
    },
    {
        when: 'splashed',
        say: ['Hey! I just cleaned that! I quit!', 'You got it all over me! I am done.'],
        leave: true,
    },
    {
        when: 'item_grabbed',
        say: ['Back off, bucket of bolts!', 'That is for customers, not you!'],
    },
]

export const level = {
    id: 'coffee_shop',
    name: 'Coffee Shop',
    description: 'A busy morning. Nothing to do but look around.',

    // Where people leave by, at the front of the shop
    exit: [8, 15],

    items: [
        // The back wall
        {id: 'wall_0', type: 'wall', at: [0, 0]},
        {id: 'wall_1', type: 'wall', at: [1, 0]},
        {id: 'wall_2', type: 'wall', at: [2, 0]},
        {id: 'wall_3', type: 'wall', at: [3, 0]},
        {id: 'wall_4', type: 'wall', at: [4, 0]},
        {id: 'wall_5', type: 'wall', at: [5, 0]},
        {id: 'wall_6', type: 'wall', at: [6, 0]},
        {id: 'wall_7', type: 'wall', at: [7, 0]},
        {id: 'wall_8', type: 'wall', at: [8, 0]},
        {id: 'wall_9', type: 'wall', at: [9, 0]},
        {id: 'wall_10', type: 'wall', at: [10, 0]},
        {id: 'wall_11', type: 'wall', at: [11, 0]},
        {id: 'wall_12', type: 'wall', at: [12, 0]},
        {id: 'wall_13', type: 'wall', at: [13, 0]},
        {id: 'wall_14', type: 'wall', at: [14, 0]},
        {id: 'wall_15', type: 'wall', at: [15, 0]},

        // The bar: a U open toward the back wall. The ids are the cells they cover.
        {id: 'bar_5_7', type: 'counter', at: [5, 7]},
        {id: 'bar_6_7', type: 'counter', at: [6, 7]},
        {id: 'bar_7_7', type: 'counter', at: [7, 7]},
        {id: 'bar_8_7', type: 'counter', at: [8, 7]},
        {id: 'bar_9_7', type: 'counter', at: [9, 7]},
        {id: 'bar_10_7', type: 'counter', at: [10, 7]},
        {id: 'bar_5_6', type: 'counter', at: [5, 6]},
        {id: 'bar_5_5', type: 'counter', at: [5, 5]},
        {id: 'bar_5_4', type: 'counter', at: [5, 4]},
        {id: 'bar_5_3', type: 'counter', at: [5, 3]},
        {id: 'bar_10_6', type: 'counter', at: [10, 6]},
        {id: 'bar_10_5', type: 'counter', at: [10, 5]},
        {id: 'bar_10_4', type: 'counter', at: [10, 4]},
        {id: 'bar_10_3', type: 'counter', at: [10, 3]},

        // Behind the bar
        {id: 'machine_1', type: 'espresso_machine', on: 'bar_9_7', offset: [0, 0], rotate: 2},
        {id: 'machine_2', type: 'espresso_machine', on: 'bar_6_7', offset: [0, 0], rotate: 2},
        {id: 'barista_1', type: 'barista', at: [8, 6], rotate: 0, rules: BARISTA_RULES},
        {id: 'barista_2', type: 'barista', at: [6, 5], rotate: 1, rules: BARISTA_RULES},
        {id: 'bar_mug_1', type: 'coffee_mug', on: 'bar_8_7', offset: [0, -0.1], rotate: 0, owner: 'barista_1'},

        // Stools around the outside of the bar, and who is on them
        {id: 'stool_l1', type: 'stool', at: [11, 5]},
        {id: 'stool_l2', type: 'stool', at: [11, 4]},
        {id: 'stool_r1', type: 'stool', at: [4, 5]},
        {id: 'stool_r2', type: 'stool', at: [4, 4]},
        {id: 'stool_b1', type: 'stool', at: [9, 8]},
        {id: 'stool_b2', type: 'stool', at: [7, 8]},

        {id: 'bar_left_1', type: 'sitter_phone', on: 'stool_l1', rotate: 1, rules: SITTER_RULES},
        {id: 'bar_left_mug', type: 'coffee_mug', on: 'bar_10_5', offset: [0, 0], rotate: 0, owner: 'bar_left_1'},
        {id: 'bar_left_2', type: 'sitter_laptop', on: 'stool_l2', rotate: 1, rules: SITTER_RULES},
        {id: 'bar_left_laptop', type: 'laptop', on: 'bar_10_4', offset: [0, 0], rotate: 3, owner: 'bar_left_2'},
        {id: 'bar_right_1', type: 'sitter_phone', on: 'stool_r1', rotate: 3, rules: SITTER_RULES},
        {id: 'bar_right_cup', type: 'cup', on: 'bar_5_5', offset: [0, 0], rotate: 0, owner: 'bar_right_1'},
        {id: 'bar_right_2', type: 'sitter_laptop', on: 'stool_r2', rotate: 3, rules: SITTER_RULES},
        {id: 'bar_right_laptop', type: 'laptop', on: 'bar_5_4', offset: [0, 0], rotate: 1, owner: 'bar_right_2'},
        {id: 'bar_back_1', type: 'sitter_phone', on: 'stool_b1', rotate: 0, rules: SITTER_RULES},
        {id: 'bar_back_2', type: 'sitter_laptop', on: 'stool_b2', rotate: 0, rules: SITTER_RULES},
        {id: 'bar_back_laptop', type: 'laptop', on: 'bar_7_7', offset: [0, 0], rotate: 2, owner: 'bar_back_2'},

        // Tables along the left edge, chairs on the side toward the room
        {id: 'table_l1', type: 'cafe_table', at: [1, 3]},
        {id: 'table_l2', type: 'cafe_table', at: [1, 6]},
        {id: 'table_l3', type: 'cafe_table', at: [1, 9]},

        {id: 'left_1_chair', type: 'chair', at: [2, 3], rotate: 1},
        {id: 'left_1', type: 'sitter_phone', on: 'left_1_chair', rotate: 1, rules: SITTER_RULES},
        {id: 'left_1_mug', type: 'coffee_mug', on: 'table_l1', offset: [0.2, 0.2], rotate: 0, owner: 'left_1'},

        {id: 'left_2_chair', type: 'chair', at: [2, 6], rotate: 1},
        {id: 'left_2', type: 'sitter_laptop', on: 'left_2_chair', rotate: 1, rules: SITTER_RULES},
        {id: 'left_2_laptop', type: 'laptop', on: 'table_l2', offset: [0, 0], rotate: 3, owner: 'left_2'},
        {id: 'left_2_cup', type: 'cup', on: 'table_l2', offset: [0.25, 0.25], rotate: 0, owner: 'left_2'},

        {id: 'left_3_chair', type: 'chair', at: [2, 9], rotate: 1},
        {id: 'left_3', type: 'sitter_laptop', on: 'left_3_chair', rotate: 1, rules: SITTER_RULES},
        {id: 'left_3_laptop', type: 'laptop', on: 'table_l3', offset: [0, 0], rotate: 3, owner: 'left_3'},

        {id: 'left_4_chair', type: 'chair', at: [1, 10], rotate: 2},
        {id: 'left_4', type: 'sitter_phone', on: 'left_4_chair', rotate: 2, rules: SITTER_RULES},
        {id: 'left_4_mug', type: 'coffee_mug', on: 'table_l3', offset: [0.2, 0.25], rotate: 0, owner: 'left_4'},

        // Along the right edge
        {id: 'table_r1', type: 'cafe_table', at: [14, 3]},
        {id: 'table_r2', type: 'cafe_table', at: [14, 6]},
        {id: 'table_r3', type: 'cafe_table', at: [14, 9]},

        {id: 'right_1_chair', type: 'chair', at: [13, 3], rotate: 3},
        {id: 'right_1', type: 'sitter_laptop', on: 'right_1_chair', rotate: 3, rules: SITTER_RULES},
        {id: 'right_1_laptop', type: 'laptop', on: 'table_r1', offset: [0, 0], rotate: 1, owner: 'right_1'},
        {id: 'right_1_mug', type: 'coffee_mug', on: 'table_r1', offset: [-0.25, 0.25], rotate: 0, owner: 'right_1'},

        {id: 'right_2_chair', type: 'chair', at: [13, 6], rotate: 3},
        {id: 'right_2', type: 'sitter_phone', on: 'right_2_chair', rotate: 3, rules: SITTER_RULES},
        {id: 'right_2_cup', type: 'cup', on: 'table_r2', offset: [0, 0.1], rotate: 0, owner: 'right_2'},

        {id: 'right_3_chair', type: 'chair', at: [13, 9], rotate: 3},
        {id: 'right_3', type: 'sitter_laptop', on: 'right_3_chair', rotate: 3, rules: SITTER_RULES},
        {id: 'right_3_laptop', type: 'laptop', on: 'table_r3', offset: [0, 0], rotate: 1, owner: 'right_3'},
        {id: 'right_3_cup', type: 'cup', on: 'table_r3', offset: [-0.25, 0.25], rotate: 0, owner: 'right_3'},

        {id: 'right_4_chair', type: 'chair', at: [14, 10], rotate: 2},
        {id: 'right_4', type: 'sitter_phone', on: 'right_4_chair', rotate: 2, rules: SITTER_RULES},

        // Along the front edge
        {id: 'table_f1', type: 'cafe_table', at: [3, 14]},
        {id: 'table_f2', type: 'cafe_table', at: [6, 14]},
        {id: 'table_f3', type: 'cafe_table', at: [9, 14]},
        {id: 'table_f4', type: 'cafe_table', at: [12, 14]},

        {id: 'front_1_chair', type: 'chair', at: [3, 13], rotate: 0},
        {id: 'front_1', type: 'sitter_laptop', on: 'front_1_chair', rotate: 0, rules: SITTER_RULES},
        {id: 'front_1_laptop', type: 'laptop', on: 'table_f1', offset: [0, 0], rotate: 2, owner: 'front_1'},
        {id: 'front_1_mug', type: 'coffee_mug', on: 'table_f1', offset: [0.25, -0.2], rotate: 0, owner: 'front_1'},

        {id: 'front_2_chair', type: 'chair', at: [6, 13], rotate: 0},
        {id: 'front_2', type: 'sitter_phone', on: 'front_2_chair', rotate: 0, rules: SITTER_RULES},
        {id: 'front_2_mug', type: 'coffee_mug', on: 'table_f2', offset: [0, 0], rotate: 0, owner: 'front_2'},
        // Left behind by a walker: it only counts as owned while walker_1 is near it
        {id: 'front_2_wallet', type: 'wallet', on: 'table_f2', offset: [0.22, -0.12], rotate: 1, owner: 'walker_1'},

        {id: 'front_3_chair', type: 'chair', at: [9, 13], rotate: 0},
        {id: 'front_3', type: 'sitter_phone', on: 'front_3_chair', rotate: 0, rules: SITTER_RULES},
        {id: 'front_3_cup', type: 'cup', on: 'table_f3', offset: [0, 0.05], rotate: 0, owner: 'front_3'},

        {id: 'front_4_chair', type: 'chair', at: [12, 13], rotate: 0},
        {id: 'front_4', type: 'sitter_laptop', on: 'front_4_chair', rotate: 0, rules: SITTER_RULES},
        {id: 'front_4_laptop', type: 'laptop', on: 'table_f4', offset: [0, 0], rotate: 2, owner: 'front_4'},

        // People on their feet, each on a loop of their own that keeps clear of the others and the furniture
        {id: 'walker_1', type: 'walker', path: [[3, 9], [5, 9], [5, 12], [3, 12]], speed: 0.8, rules: WALKER_RULES},
        {id: 'walker_2', type: 'walker_phone', path: [[7, 9], [9, 9], [9, 11], [7, 11]], speed: 0.6, rules: WALKER_RULES},
        {id: 'walker_3', type: 'walker', path: [[11, 10], [12, 10], [12, 12], [11, 12]], speed: 0.9, rules: WALKER_RULES},
        {id: 'walker_4', type: 'walker_phone', path: [[3, 4], [3, 8]], speed: 0.5, rules: WALKER_RULES},
        {id: 'walker_5', type: 'walker_phone', path: [[12, 4], [12, 8]], speed: 0.55, rules: WALKER_RULES},
        {id: 'walker_6', type: 'walker', path: [[6, 1], [9, 1]], speed: 0.9, rules: WALKER_RULES},

        // The player starts right in the front right corner, facing into the shop
        {id: 'player_1', type: 'player', at: [15, 15], rotate: 2},

        // Dressing
        {id: 'rug', type: 'rug', at: [7, 13]},
        {id: 'plant_l', type: 'plant', at: [0, 1]},
        {id: 'plant_r', type: 'plant', at: [15, 1]},
        {id: 'trash', type: 'trash_can', at: [15, 13]},
    ],

    conditions: [],
}
