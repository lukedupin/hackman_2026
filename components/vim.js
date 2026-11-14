// Vim-style editing for the code window, as plain functions on a string, so it can be tested without a
// browser. The editor keeps the text and shows it; this works out what a key does.
//
//   const vim = createVim()                      the editor's state (mode, cursor, register, undo history)
//   text = press(vim, key, text)                 a key in normal or visual mode; returns the new text
//   leaveInsert(vim, text, caret)                Esc in insert mode (typing itself is the textarea's job)
//   selectionOf(vim, text) -> [start, end]       what to highlight: the block cursor, or the selection
//   statusOf(vim) -> {label, pending}            "NORMAL" and the keys typed so far, for the status bar
//
// Keys are `event.key` names, with arrows, Backspace and Space already turned into h j k l, and Ctrl+r
// as 'Ctrl-r'.
//
// What is supported:
//   modes      normal, insert, visual (v), visual line (V)
//   insert     i a I A o O
//   motions    h j k l  0 ^ $  w W b B e E  gg G  f F t T <char>   (all take a count: 3j, 2w)
//   operators  d c y > <  with a motion (dw, c$, y2j, d3w, dfx), doubled for lines (dd cc yy >> <<),
//              and with the text objects iw / aw (ciw, daw)
//   shortcuts  x X D C s S Y   p P (paste)   r<char>   J   ~   u  Ctrl-r (undo, redo)
//   visual     any motion, then d x y c s > <  (D X Y work on whole lines), o to swap ends
// Not supported: . (repeat), registers, marks, macros, search and the : command line.
export const INDENT = '    '

const WORD = /[A-Za-z0-9_]/
const BLANK = /[ \t]/
const MAX_UNDO = 200

export const createVim = () => ({
    mode: 'normal',          // 'normal', 'insert', 'visual' or 'visual_line'
    cursor: 0,               // index into the text of the character the block cursor is on
    column: 0,               // the column j and k try to stay in
    count: '',               // digits typed so far
    operator: null,          // d c y > < waiting for a motion
    opCount: null,           // the count typed before the operator
    waiting: '',             // a key that needs one more: g r f F t T i a
    anchor: 0,               // where visual mode started
    register: {text: '', linewise: false},
    past: [],                // undo history: {text, cursor}
    future: [],              // redo history
    insertStart: null,       // the text when insert mode began, to know whether typing changed anything
    insertPushed: false,     // whether the command that began insert mode already made an undo step
    caretRequest: null,      // where the editor should put the caret on entering insert mode
    skipHistory: false,
})

// ---------------------------------------------------------------------------------- text helpers

const lineStartOf = (text, i) => i <= 0 ? 0 : text.lastIndexOf('\n', i - 1) + 1

const lineEndOf = (text, i) => {
    const newline = text.indexOf('\n', i)
    return newline === -1 ? text.length : newline
}

const lineIndexOf = (text, i) => {
    let line = 0
    for (let k = 0; k < i && k < text.length; k++) {
        if (text[k] === '\n') {
            line++
        }
    }
    return line
}

// The index where line number `line` (counting from 0) starts
const lineStartIndex = (text, line) => {
    let at = 0
    for (let l = 0; l < line; l++) {
        const newline = text.indexOf('\n', at)
        if (newline === -1) {
            return at
        }
        at = newline + 1
    }
    return at
}

// The first character on a line that is not blank (the last one, if all of it is)
const firstNonBlank = (text, lineStart) => {
    const end = lineEndOf(text, lineStart)
    let at = lineStart
    while (at < end && BLANK.test(text[at])) {
        at++
    }
    return at < end ? at : Math.max(lineStart, end - 1)
}

// Where the block cursor can be: on a character, never past the end of its line (an empty line is
// the one place it sits on the line break)
const settle = (text, i) => {
    const at = Math.max(0, Math.min(i, text.length))
    const start = lineStartOf(text, at)
    const end = lineEndOf(text, at)
    return end === start ? start : Math.min(at, end - 1)
}

// 0 for blanks, 1 for word characters, 2 for punctuation. With `big` (W B E) everything not blank is 1.
const classOf = (ch, big = false) => {
    if (ch === undefined || /\s/.test(ch)) {
        return 0
    }
    return big || WORD.test(ch) ? 1 : 2
}

const wordForward = (text, i, big) => {
    const cls = classOf(text[i], big)
    let at = i
    if (cls !== 0) {
        while (at < text.length && classOf(text[at], big) === cls) {
            at++
        }
    }
    while (at < text.length && classOf(text[at], big) === 0) {
        // An empty line counts as a word
        if (text[at] === '\n' && text[at + 1] === '\n') {
            return at + 1
        }
        at++
    }
    return at
}

const wordEnd = (text, i, big, fromHere) => {
    let at = fromHere && classOf(text[i], big) !== 0 ? i : i + 1
    while (at < text.length && classOf(text[at], big) === 0) {
        at++
    }
    const cls = classOf(text[at], big)
    while (at + 1 < text.length && classOf(text[at + 1], big) === cls) {
        at++
    }
    return Math.min(at, Math.max(0, text.length - 1))
}

const wordBack = (text, i, big) => {
    let at = i - 1
    while (at > 0 && classOf(text[at], big) === 0) {
        if (text[at] === '\n' && text[at - 1] === '\n') {
            return at
        }
        at--
    }
    if (at <= 0) {
        return 0
    }
    const cls = classOf(text[at], big)
    while (at > 0 && classOf(text[at - 1], big) === cls) {
        at--
    }
    return at
}

// The word under the cursor for iw / aw, as the range [start, end) on its line. Null on an empty line.
const wordObject = (text, c, around) => {
    const start = lineStartOf(text, c)
    const end = lineEndOf(text, c)
    if (end === start) {
        return null
    }

    const cls = classOf(text[c])
    let from = c
    let to = c + 1
    while (from > start && classOf(text[from - 1]) === cls) {
        from--
    }
    while (to < end && classOf(text[to]) === cls) {
        to++
    }

    // "a word" takes the blanks after it, or if there are none, the ones before it
    if (around && cls !== 0) {
        let after = to
        while (after < end && classOf(text[after]) === 0) {
            after++
        }
        if (after > to) {
            to = after
        }
        else {
            while (from > start && classOf(text[from - 1]) === 0) {
                from--
            }
        }
    }
    return {start: from, end: to}
}

// ---------------------------------------------------------------------------------- pending keys

const clearPending = vim => {
    vim.count = ''
    vim.operator = null
    vim.opCount = null
    vim.waiting = ''
}

const parseCount = vim => vim.count === '' ? null : parseInt(vim.count, 10)

// The count for a motion: the one before the operator times the one after it, or null if none was typed
const effectiveCount = vim => {
    const count = parseCount(vim)
    return count === null && vim.opCount === null ? null : (vim.opCount ?? 1) * (count ?? 1)
}

const enterInsert = (vim, text) => {
    vim.mode = 'insert'
    vim.insertStart = {text, cursor: vim.cursor}
    vim.insertPushed = false
    vim.caretRequest = vim.cursor
}

// ---------------------------------------------------------------------------------- motions

// Where a motion goes from the cursor: {to, linewise?, inclusive?}, or null when it can't. `arg` is the
// character for f F t T. `linewise` motions take whole lines when an operator uses them, and `inclusive`
// ones include the character they land on.
const motionOf = (vim, text, key, count, arg) => {
    const c = vim.cursor
    const operating = vim.operator !== null
    const start = lineStartOf(text, c)
    const end = lineEndOf(text, c)
    const n = count ?? 1

    switch (key) {
        case 'h':
            return {to: Math.max(start, c - n)}

        case 'l':
            return {to: Math.min(operating ? end : Math.max(start, end - 1), c + n)}

        case 'j':
        case 'k': {
            const lines = text.split('\n')
            const line = lineIndexOf(text, c)
            const target = Math.max(0, Math.min(lines.length - 1, key === 'j' ? line + n : line - n))
            if (target === line) {
                return null
            }
            const column = Math.min(vim.column, Math.max(0, lines[target].length - 1))
            return {to: lineStartIndex(text, target) + column, linewise: true}
        }

        case '0':
            return {to: start}

        case '^':
            return {to: firstNonBlank(text, start)}

        case '$': {
            const lines = text.split('\n')
            const target = Math.min(lines.length - 1, lineIndexOf(text, c) + n - 1)
            const targetStart = lineStartIndex(text, target)
            const targetEnd = targetStart + lines[target].length
            return {to: targetEnd > targetStart ? targetEnd - 1 : targetStart, inclusive: targetEnd > targetStart}
        }

        case 'w':
        case 'W': {
            let to = c
            for (let k = 0; k < n; k++) {
                to = wordForward(text, to, key === 'W')
            }
            // dw on the last word of a line stops at the end of the line, it doesn't pull the next one up
            if (operating && lineIndexOf(text, to) > lineIndexOf(text, c)) {
                to = end
            }
            return {to: Math.min(to, text.length)}
        }

        case 'b':
        case 'B': {
            let to = c
            for (let k = 0; k < n; k++) {
                to = wordBack(text, to, key === 'B')
            }
            return {to}
        }

        case 'e':
        case 'E': {
            let to = c
            for (let k = 0; k < n; k++) {
                to = wordEnd(text, to, key === 'E', k === 0 && arg === 'here')
            }
            return {to, inclusive: true}
        }

        case 'G':
        case 'gg': {
            const last = text.split('\n').length - 1
            const line = count === null ? (key === 'G' ? last : 0) : Math.min(count - 1, last)
            return {to: firstNonBlank(text, lineStartIndex(text, line)), linewise: true}
        }

        case 'f':
        case 't': {
            let at = c
            for (let k = 0; k < n; k++) {
                at = text.indexOf(arg, at + 1)
                if (at === -1 || at >= end) {
                    return null
                }
            }
            return {to: key === 'f' ? at : Math.max(c, at - 1), inclusive: true}
        }

        case 'F':
        case 'T': {
            let at = c
            for (let k = 0; k < n; k++) {
                if (at - 1 < start) {
                    return null
                }
                at = text.lastIndexOf(arg, at - 1)
                if (at < start) {
                    return null
                }
            }
            return {to: key === 'F' ? at : Math.min(c, at + 1)}
        }

        default:
            return null
    }
}

const MOTION_KEYS = ['h', 'l', 'j', 'k', '0', '^', '$', 'w', 'W', 'b', 'B', 'e', 'E', 'G']
const NEEDS_KEY = ['g', 'f', 'F', 't', 'T']

// ---------------------------------------------------------------------------------- operators

// A range for an operator: charwise {start, end} (end not included) or linewise {first, last} lines
const lineRange = (first, last) => ({linewise: true, first, last})

const rangeOfMotion = (vim, text, motion) => {
    const from = vim.cursor
    if (motion.linewise) {
        return lineRange(lineIndexOf(text, Math.min(from, motion.to)), lineIndexOf(text, Math.max(from, motion.to)))
    }
    const low = Math.min(from, motion.to)
    const high = Math.max(from, motion.to)
    return {linewise: false, start: low, end: motion.inclusive ? Math.min(text.length, high + 1) : high}
}

// Indents or dedents the lines of a range
const shiftLines = (vim, text, op, first, last) => {
    const lines = text.split('\n')
    for (let line = first; line <= last; line++) {
        if (op === '>') {
            lines[line] = lines[line] === '' ? '' : INDENT + lines[line]
        }
        else {
            lines[line] = lines[line].replace(new RegExp(`^(\\t|${INDENT}| {1,${INDENT.length - 1}})`), '')
        }
    }
    const next = lines.join('\n')
    vim.cursor = firstNonBlank(next, lineStartIndex(next, first))
    return next
}

// Does `op` (d c y > <) to a range, returning the new text
const operate = (vim, text, op, range) => {
    if (op === '>' || op === '<') {
        const first = range.linewise ? range.first : lineIndexOf(text, range.start)
        const last = range.linewise ? range.last : lineIndexOf(text, Math.max(range.start, range.end - 1))
        return shiftLines(vim, text, op, first, last)
    }

    if (range.linewise) {
        const lines = text.split('\n')
        const taken = lines.slice(range.first, range.last + 1)
        vim.register = {text: taken.join('\n'), linewise: true}

        if (op === 'y') {
            if (range.first < lineIndexOf(text, vim.cursor)) {
                const column = vim.cursor - lineStartOf(text, vim.cursor)
                vim.cursor = Math.min(lineStartIndex(text, range.first) + column, lineEndOf(text, lineStartIndex(text, range.first)))
            }
            return text
        }

        if (op === 'd') {
            lines.splice(range.first, taken.length)
            const next = lines.join('\n')
            vim.cursor = lines.length === 0 ? 0 : firstNonBlank(next, lineStartIndex(next, Math.min(range.first, lines.length - 1)))
            return next
        }

        // c: the lines become one empty one, keeping the first line's indent
        const indent = taken[0].match(/^[ \t]*/)[0]
        lines.splice(range.first, taken.length, indent)
        const next = lines.join('\n')
        vim.cursor = lineStartIndex(next, range.first) + indent.length
        enterInsert(vim, next)
        return next
    }

    vim.register = {text: text.slice(range.start, range.end), linewise: false}
    if (op === 'y') {
        vim.cursor = range.start
        return text
    }

    const next = text.slice(0, range.start) + text.slice(range.end)
    vim.cursor = range.start
    if (op === 'c') {
        enterInsert(vim, next)
    }
    return next
}

// A motion key, once everything it needs is known: moves the cursor, or applies the pending operator
const useMotion = (vim, text, key, arg) => {
    const count = effectiveCount(vim)
    const operator = vim.operator

    // cw changes to the end of the word, like ce, rather than through the blanks after it
    let motionKey = key
    let motionArg = arg
    if (operator === 'c' && (key === 'w' || key === 'W') && classOf(text[vim.cursor]) !== 0) {
        motionKey = key === 'w' ? 'e' : 'E'
        motionArg = 'here'
    }

    const motion = motionOf(vim, text, motionKey, count, motionArg)
    clearPending(vim)
    if (!motion) {
        return text
    }

    if (operator) {
        return operate(vim, text, operator, rangeOfMotion(vim, text, motion))
    }
    vim.cursor = motion.to
    return text
}

// dd, yy, cc, >>, <<: the operator doubled works on whole lines, as many as the count
const doubleOperator = (vim, text) => {
    const total = effectiveCount(vim) ?? 1
    const operator = vim.operator
    clearPending(vim)

    const lastLine = text.split('\n').length - 1
    const first = lineIndexOf(text, vim.cursor)
    return operate(vim, text, operator, lineRange(first, Math.min(lastLine, first + total - 1)))
}

// x X D C s S Y: operators with a motion built in
const shortcut = (vim, text, operator, motionKey) => {
    vim.operator = operator
    vim.opCount = parseCount(vim)
    vim.count = ''
    return motionKey === operator ? doubleOperator(vim, text) : useMotion(vim, text, motionKey)
}

// ---------------------------------------------------------------------------------- visual mode

const visualRange = (vim, text) => {
    const low = Math.min(vim.anchor, vim.cursor)
    const high = Math.max(vim.anchor, vim.cursor)
    if (vim.mode === 'visual_line') {
        return lineRange(lineIndexOf(text, low), lineIndexOf(text, high))
    }
    return {linewise: false, start: low, end: Math.min(text.length, high + 1)}
}

const visualKey = (vim, key, text) => {
    const operators = {d: 'd', x: 'd', y: 'y', c: 'c', s: 'c', '>': '>', '<': '<'}
    const wholeLines = {D: 'd', X: 'd', Y: 'y', C: 'c', S: 'c'}

    if (key in operators || key in wholeLines) {
        let range = visualRange(vim, text)
        if (key in wholeLines) {
            range = lineRange(lineIndexOf(text, Math.min(vim.anchor, vim.cursor)), lineIndexOf(text, Math.max(vim.anchor, vim.cursor)))
        }
        vim.mode = 'normal'
        clearPending(vim)
        return operate(vim, text, operators[key] ?? wholeLines[key], range)
    }

    if (key === 'v' || key === 'V') {
        const mode = key === 'v' ? 'visual' : 'visual_line'
        vim.mode = vim.mode === mode ? 'normal' : mode
        return text
    }

    if (key === 'o') {
        ;[vim.anchor, vim.cursor] = [vim.cursor, vim.anchor]
        return text
    }

    if (MOTION_KEYS.includes(key)) {
        return useMotion(vim, text, key)
    }
    if (NEEDS_KEY.includes(key)) {
        vim.waiting = key
        return text
    }
    clearPending(vim)
    return text
}

// ---------------------------------------------------------------------------------- normal mode

const paste = (vim, text, before) => {
    const n = parseCount(vim) ?? 1
    clearPending(vim)
    if (vim.register.text === '' && !vim.register.linewise) {
        return text
    }

    const c = vim.cursor
    if (vim.register.linewise) {
        const lines = text.split('\n')
        const at = lineIndexOf(text, c) + (before ? 0 : 1)
        const pasted = []
        for (let k = 0; k < n; k++) {
            pasted.push(...vim.register.text.split('\n'))
        }
        lines.splice(at, 0, ...pasted)
        const next = lines.join('\n')
        vim.cursor = firstNonBlank(next, lineStartIndex(next, at))
        return next
    }

    const piece = vim.register.text.repeat(n)
    const at = before || text[c] === undefined || text[c] === '\n' ? c : c + 1
    vim.cursor = piece.includes('\n') ? at : at + piece.length - 1
    return text.slice(0, at) + piece + text.slice(at)
}

const join = (vim, text) => {
    const joins = Math.max(1, (parseCount(vim) ?? 2) - 1)
    clearPending(vim)

    let next = text
    for (let k = 0; k < joins; k++) {
        const end = lineEndOf(next, vim.cursor)
        if (end >= next.length) {
            break
        }
        const left = next.slice(0, end)
        const right = next.slice(end + 1).replace(/^[ \t]+/, '')
        const separator = left === '' || BLANK.test(left[left.length - 1]) || right.startsWith(')') || right.startsWith('\n') || right === '' ? '' : ' '
        next = left + separator + right
        vim.cursor = end
    }
    return next
}

const undo = (vim, text) => {
    const previous = vim.past.pop()
    if (!previous) {
        return text
    }
    vim.future.push({text, cursor: vim.cursor})
    vim.cursor = previous.cursor
    vim.skipHistory = true
    return previous.text
}

const redo = (vim, text) => {
    const next = vim.future.pop()
    if (!next) {
        return text
    }
    vim.past.push({text, cursor: vim.cursor})
    vim.cursor = next.cursor
    vim.skipHistory = true
    return next.text
}

// A key that was waiting for one more (the second g of gg, the character after r or f)
const finishWaiting = (vim, key, text) => {
    const waiting = vim.waiting
    vim.waiting = ''

    if (key === 'Escape' || key.length !== 1) {
        clearPending(vim)
        return text
    }

    if (waiting === 'g') {
        if (key === 'g') {
            return useMotion(vim, text, 'gg')
        }
        clearPending(vim)
        return text
    }

    if (waiting === 'r') {
        const n = parseCount(vim) ?? 1
        clearPending(vim)
        const c = vim.cursor
        if (c + n > lineEndOf(text, c)) {
            return text
        }
        vim.cursor = c + n - 1
        return text.slice(0, c) + key.repeat(n) + text.slice(c + n)
    }

    if (waiting === 'i' || waiting === 'a') {
        const operator = vim.operator
        const object = key === 'w' || key === 'W' ? wordObject(text, vim.cursor, waiting === 'a') : null
        clearPending(vim)
        return object && operator ? operate(vim, text, operator, {linewise: false, ...object}) : text
    }

    return useMotion(vim, text, waiting, key)
}

const run = (vim, key, text) => {
    if (vim.waiting) {
        return finishWaiting(vim, key, text)
    }

    if (key === 'Escape') {
        clearPending(vim)
        vim.mode = 'normal'
        return text
    }

    if (/^[1-9]$/.test(key) || (key === '0' && vim.count !== '')) {
        vim.count += key
        return text
    }

    if (vim.mode === 'visual' || vim.mode === 'visual_line') {
        return visualKey(vim, key, text)
    }

    // An operator is waiting for what to work on
    if (vim.operator) {
        if (key === vim.operator) {
            return doubleOperator(vim, text)
        }
        if (key === 'i' || key === 'a' || NEEDS_KEY.includes(key)) {
            vim.waiting = key
            return text
        }
        if (MOTION_KEYS.includes(key)) {
            return useMotion(vim, text, key)
        }
        clearPending(vim)
        return text
    }

    const c = vim.cursor
    switch (key) {
        case 'i':
            clearPending(vim)
            enterInsert(vim, text)
            return text

        case 'a':
            clearPending(vim)
            vim.cursor = text[c] === undefined || text[c] === '\n' ? c : c + 1
            enterInsert(vim, text)
            return text

        case 'I':
            clearPending(vim)
            vim.cursor = firstNonBlank(text, lineStartOf(text, c))
            enterInsert(vim, text)
            return text

        case 'A':
            clearPending(vim)
            vim.cursor = lineEndOf(text, c)
            enterInsert(vim, text)
            return text

        case 'o':
        case 'O': {
            clearPending(vim)
            const start = lineStartOf(text, c)
            const indent = text.slice(start, lineEndOf(text, c)).match(/^[ \t]*/)[0]
            const next = key === 'o'
                ? text.slice(0, lineEndOf(text, c)) + '\n' + indent + text.slice(lineEndOf(text, c))
                : text.slice(0, start) + indent + '\n' + text.slice(start)
            vim.cursor = (key === 'o' ? lineEndOf(text, c) + 1 : start) + indent.length
            enterInsert(vim, next)
            return next
        }

        case 'd':
        case 'c':
        case 'y':
        case '>':
        case '<':
            vim.operator = key
            vim.opCount = parseCount(vim)
            vim.count = ''
            return text

        case 'x': return shortcut(vim, text, 'd', 'l')
        case 'X': return shortcut(vim, text, 'd', 'h')
        case 'D': return shortcut(vim, text, 'd', '$')
        case 'C': return shortcut(vim, text, 'c', '$')
        case 's': return shortcut(vim, text, 'c', 'l')
        case 'S': return shortcut(vim, text, 'c', 'c')
        case 'Y': return shortcut(vim, text, 'y', 'y')

        case 'p': return paste(vim, text, false)
        case 'P': return paste(vim, text, true)
        case 'J': return join(vim, text)

        case '~': {
            const n = Math.min(parseCount(vim) ?? 1, lineEndOf(text, c) - c)
            clearPending(vim)
            const swapped = [...text.slice(c, c + n)].map(ch => ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase()).join('')
            vim.cursor = c + n
            return text.slice(0, c) + swapped + text.slice(c + n)
        }

        case 'r':
            vim.waiting = 'r'
            return text

        case 'v':
        case 'V':
            clearPending(vim)
            vim.mode = key === 'v' ? 'visual' : 'visual_line'
            vim.anchor = c
            return text

        case 'u':
            clearPending(vim)
            return undo(vim, text)

        case 'Ctrl-r':
            clearPending(vim)
            return redo(vim, text)

        default:
            if (MOTION_KEYS.includes(key)) {
                return useMotion(vim, text, key)
            }
            if (NEEDS_KEY.includes(key)) {
                vim.waiting = key
                return text
            }
            clearPending(vim)
            return text
    }
}

// ---------------------------------------------------------------------------------- the editor's side

// A key in normal or visual mode (and it also starts insert mode). Returns the new text; the cursor,
// mode and so on are updated on `vim`.
export const press = (vim, key, text) => {
    const before = {text, cursor: vim.cursor}
    vim.skipHistory = false

    const next = run(vim, key, text)

    // A change is one undo step; if it also began insert mode, so is everything typed after it
    if (next !== text && !vim.skipHistory) {
        vim.past.push(before)
        vim.past = vim.past.slice(-MAX_UNDO)
        vim.future = []
        if (vim.mode === 'insert') {
            vim.insertPushed = true
        }
    }

    if (vim.mode !== 'insert') {
        vim.cursor = settle(next, vim.cursor)
        if (key !== 'j' && key !== 'k') {
            vim.column = vim.cursor - lineStartOf(next, vim.cursor)
        }
    }
    return next
}

// Esc in insert mode. `caret` is where the textarea's caret is; the block cursor lands on the
// character before it, as in vim.
export const leaveInsert = (vim, text, caret) => {
    if (!vim.insertPushed && vim.insertStart && text !== vim.insertStart.text) {
        vim.past.push(vim.insertStart)
        vim.past = vim.past.slice(-MAX_UNDO)
        vim.future = []
    }

    vim.insertStart = null
    vim.mode = 'normal'
    clearPending(vim)
    vim.cursor = settle(text, caret > lineStartOf(text, caret) ? caret - 1 : caret)
    vim.column = vim.cursor - lineStartOf(text, vim.cursor)
}

// Puts the cursor where the mouse clicked (normal and visual mode)
export const moveTo = (vim, text, index) => {
    clearPending(vim)
    vim.cursor = settle(text, index)
    vim.column = vim.cursor - lineStartOf(text, vim.cursor)
}

// What to highlight in the textarea: the character under the cursor (a block cursor), or the selection
export const selectionOf = (vim, text) => {
    if (vim.mode === 'visual_line') {
        const range = visualRange(vim, text)
        return [lineStartIndex(text, range.first), lineEndOf(text, lineStartIndex(text, range.last))]
    }
    if (vim.mode === 'visual') {
        const range = visualRange(vim, text)
        return [range.start, range.end]
    }
    return [vim.cursor, Math.min(text.length, vim.cursor + 1)]
}

export const statusOf = vim => ({
    label: {normal: 'NORMAL', insert: 'INSERT', visual: 'VISUAL', visual_line: 'VISUAL LINE'}[vim.mode],
    pending: `${vim.opCount ?? ''}${vim.operator ?? ''}${vim.count}${vim.waiting}`,
})

// Which line (counting from 0) and column an index in the text is at
export const positionOf = (text, index) => ({line: lineIndexOf(text, index), column: index - lineStartOf(text, index)})
