// The completion conditions a level can use. A condition is `{type, ...params}`, and each type here
// says how to read it (`describe`, shown to the player) and how to tell if it holds (`check`).
//
// `state.items` is {item id: {id, type, col, row, cells}}, where `cells` is every [col, row] the item
// covers. Cells are always written [col, row]. Items that cover several cells count as "on" something
// when any of their cells overlap it.
//
// To add a condition: add it here, then use its key as `type` in a level's `conditions`.
const overlap = (a, b) => a.cells.some(([col, row]) => b.cells.some(([c, r]) => c === col && r === row))

export const CONDITIONS = {
    // {type: 'item_at', item: 'p1', at: [13, 2]} -- the item covers that cell
    item_at: {
        describe: c => `${c.item} is on (${c.at[0]}, ${c.at[1]})`,
        check: (state, c) => {
            const item = state.items[c.item]
            return !!item && item.cells.some(([col, row]) => col === c.at[0] && row === c.at[1])
        },
    },

    // {type: 'item_on_item', item: 'p1', target: 'g1'} -- the two share a cell
    item_on_item: {
        describe: c => `${c.item} is on ${c.target}`,
        check: (state, c) => {
            const item = state.items[c.item]
            const target = state.items[c.target]
            return !!item && !!target && overlap(item, target)
        },
    },

    // {type: 'all_on', kind: 'crate', target_kind: 'goal'} -- every item of one type shares a cell
    // with an item of the other type (and there is at least one)
    all_on: {
        describe: c => `every ${c.kind} is on a ${c.target_kind}`,
        check: (state, c) => {
            const items = Object.values(state.items)
            const movers = items.filter(item => item.type === c.kind)
            const targets = items.filter(item => item.type === c.target_kind)
            return movers.length > 0 && movers.every(m => targets.some(t => overlap(m, t)))
        },
    },
}
