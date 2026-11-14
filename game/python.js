import {createRobot} from './robot.js'

// Runs the player's Python with Brython. The player writes ordinary-looking synchronous Python:
//
//     for step in range(3):
//         move('w')
//     things = scan()
//
// but every robot function is really async in JavaScript (it takes game time, see game/clock.js). Brython
// can't block on a promise, so before the code is run it is rewritten to await them:
//
//   * the whole program goes inside `async def __program__():`
//   * every call to a robot function becomes `(await __at__(LINE, move)('w'))`, where __at__ reports the
//     line the program is on and hands back the function
//   * every `def` that calls (directly, or through other functions) a robot function becomes `async def`,
//     and calls to it are awaited the same way
//   * `global x` inside a function becomes `nonlocal x`, since the program's top-level variables are now
//     the locals of __program__
//
// What can't work: calling a robot function inside a lambda or a comprehension (Brython can't await there,
// so it's refused with a message), or from __init__ or another special method.

const BRYTHON_URL = 'https://cdn.jsdelivr.net/npm/brython@3.12.4/'

export const ROBOT_FUNCTIONS = ['move', 'scan', 'pickup', 'say', 'spill', 'wait']

// Things the player's code may have done wrong, with the line (counting from 1) it is on
export class PythonError extends Error {
    constructor(line, message) {
        super(message)
        this.line = line
    }
}

// ---------------------------------------------------------------------------------- reading the code

const NAME = /[\p{L}_][\p{L}\p{N}_]*/uy
const NUMBER = /(?:0[xX][\da-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d+)?[jJ]?)/y
const SPACE = /[ \t\f]+/y
const NEWLINE = /\n/y
const CONTINUATION = /\\\n/y
const COMMENT = /#[^\n]*/y
const STRING_PREFIXES = new Set(['r', 'u', 'b', 'f', 'br', 'rb', 'fr', 'rf'])
const OPERATORS = [
    '**=', '//=', '>>=', '<<=', '...',
    '==', '!=', '<=', '>=', ':=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '@=', '->', '**', '//', '>>', '<<',
]

const matchAt = (regex, source, at) => {
    regex.lastIndex = at
    const match = regex.exec(source)
    return match ? match[0] : null
}

// Where a string that starts with a quote at `at` ends (just past its closing quote)
const stringEnd = (source, at) => {
    const quote = source[at]
    const triple = quote.repeat(3)
    if (source.startsWith(triple, at)) {
        for (let i = at + 3; i < source.length; i++) {
            if (source[i] === '\\') {
                i++
            }
            else if (source.startsWith(triple, i)) {
                return i + 3
            }
        }
        return source.length
    }

    for (let i = at + 1; i < source.length; i++) {
        if (source[i] === '\\') {
            i++
        }
        else if (source[i] === quote) {
            return i + 1
        }
        else if (source[i] === '\n') {
            return i
        }
    }
    return source.length
}

// Splits Python into tokens: {type, text, start, end, line, depth}, where type is name, number, string,
// comment, space, newline or op, `line` counts from 1 and `depth` is how many brackets are open before it.
// The tokens joined back together are exactly the source.
export const tokenize = source => {
    const tokens = []
    let at = 0
    let line = 1
    let depth = 0

    const push = (type, text) => {
        tokens.push({type, text, start: at, end: at + text.length, line, depth})
        for (const ch of text) {
            if (ch === '\n') {
                line++
            }
        }
        at += text.length
    }

    while (at < source.length) {
        const ch = source[at]
        let text

        if ((text = matchAt(CONTINUATION, source, at)) || (text = matchAt(SPACE, source, at))) {
            push('space', text)
        }
        else if (matchAt(NEWLINE, source, at)) {
            push('newline', '\n')
        }
        else if ((text = matchAt(COMMENT, source, at))) {
            push('comment', text)
        }
        else if (ch === '"' || ch === "'") {
            push('string', source.slice(at, stringEnd(source, at)))
        }
        else if ((text = matchAt(NAME, source, at))) {
            const quoteAt = at + text.length
            if (STRING_PREFIXES.has(text.toLowerCase()) && (source[quoteAt] === '"' || source[quoteAt] === "'")) {
                push('string', source.slice(at, stringEnd(source, quoteAt)))
            }
            else {
                push('name', text)
            }
        }
        else if ((text = matchAt(NUMBER, source, at))) {
            push('number', text)
        }
        else {
            text = OPERATORS.find(op => source.startsWith(op, at)) ?? ch
            if (')]}'.includes(text) && text.length === 1) {
                depth = Math.max(0, depth - 1)
                tokens.push({type: 'op', text, start: at, end: at + 1, line, depth})
                at++
                continue
            }
            push('op', text)
            if ('([{'.includes(text) && text.length === 1) {
                depth++
            }
        }
    }
    return tokens
}

// ---------------------------------------------------------------------------------- rewriting it

const isOp = (token, text) => token !== undefined && token.type === 'op' && token.text === text
const isName = (token, text) => token !== undefined && token.type === 'name' && token.text === text

// The index of the next / previous token that isn't blank space, or -1
const nextSignificant = (tokens, i) => {
    let at = i + 1
    while (at < tokens.length && tokens[at].type === 'space') {
        at++
    }
    return at < tokens.length ? at : -1
}

const previousSignificant = (tokens, i) => {
    let at = i - 1
    while (at >= 0 && tokens[at].type === 'space') {
        at--
    }
    return at
}

// The index of the bracket that closes the one at `open`
const closingBracket = (tokens, open) => {
    for (let at = open + 1; at < tokens.length; at++) {
        if (tokens[at].type === 'op' && ')]}'.includes(tokens[at].text) && tokens[at].depth === tokens[open].depth) {
            return at
        }
    }
    return tokens.length - 1
}

// The functions the program defines, each with how far in its line is and the names it calls
const findFunctions = tokens => {
    // Logical lines: where each starts, how far in it is, and whether it is only blank or a comment
    const lines = []
    let first = 0
    for (let i = 0; i <= tokens.length; i++) {
        if (i === tokens.length || (tokens[i].type === 'newline' && tokens[i].depth === 0)) {
            const significant = tokens.slice(first, i).filter(t => t.type !== 'space' && t.type !== 'comment')
            const indent = tokens[first] && tokens[first].type === 'space' ? tokens[first].text.length : 0
            lines.push({first, end: i, indent, blank: significant.length === 0})
            first = i + 1
        }
    }

    const functions = []
    lines.forEach((line, lineIndex) => {
        if (line.blank) {
            return
        }
        let at = line.first
        while (tokens[at].type === 'space') {
            at++
        }
        if (isName(tokens[at], 'async')) {
            at = nextSignificant(tokens, at)
        }
        if (!isName(tokens[at], 'def')) {
            return
        }
        const nameAt = nextSignificant(tokens, at)

        // The function goes on until a line that is no further in than its `def`
        let last = lineIndex
        for (let k = lineIndex + 1; k < lines.length; k++) {
            if (!lines[k].blank && lines[k].indent <= line.indent) {
                break
            }
            last = k
        }

        const calls = new Set()
        for (let i = nameAt + 1; i < lines[last].end; i++) {
            if (tokens[i].type === 'name' && isOp(tokens[nextSignificant(tokens, i)], '(')) {
                calls.add(tokens[i].text)
            }
        }
        functions.push({name: tokens[nameAt].text, defAt: at, calls, line: tokens[at].line})
    })
    return functions
}

// Turns the player's code (as written) into the body of __program__: the code with awaits put in, and
// the line numbers it still has. Throws a PythonError for what can't be run.
export const rewrite = source => {
    const tokens = tokenize(source)
    const functions = findFunctions(tokens)

    // The functions that need to be async: those that call a robot function, or one of the async ones
    const asyncUser = new Set()
    for (let changed = true; changed;) {
        changed = false
        for (const fn of functions) {
            if (!asyncUser.has(fn.name) && [...fn.calls].some(name => ROBOT_FUNCTIONS.includes(name) || asyncUser.has(name))) {
                asyncUser.add(fn.name)
                changed = true
            }
        }
    }

    const edits = []   // {at, text, drop?}: put `text` at `at`, in place of `drop` characters

    for (const fn of functions) {
        if (!asyncUser.has(fn.name)) {
            continue
        }
        if (fn.name.startsWith('__') && fn.name.endsWith('__')) {
            throw new PythonError(fn.line, `${fn.name} can't use the robot's functions. Put them in a normal function and call that from elsewhere.`)
        }
        if (!isName(tokens[previousSignificant(tokens, fn.defAt)], 'async')) {
            edits.push({at: tokens[fn.defAt].start, text: 'async ', drop: 0})
        }
    }

    // Brackets that hold a comprehension (they have a `for` of their own), where nothing can be awaited
    const comprehensions = []
    tokens.forEach((token, i) => {
        if (token.type === 'op' && '([{'.includes(token.text) && token.text.length === 1) {
            const close = closingBracket(tokens, i)
            const inside = tokens.slice(i + 1, close)
            if (inside.some(t => isName(t, 'for') && t.depth === token.depth + 1)) {
                comprehensions.push([i, close])
            }
        }
    })

    // Where each lambda's body ends: at a comma or closing bracket at its own level, or the end of the line
    const lambdas = []
    tokens.forEach((token, i) => {
        if (isName(token, 'lambda')) {
            let end = i + 1
            while (end < tokens.length) {
                const t = tokens[end]
                const closes = t.type === 'op' && ')]}'.includes(t.text) && t.depth === token.depth
                const separates = isOp(t, ',') && t.depth === token.depth
                const ends = t.type === 'newline' && token.depth === 0
                if (closes || separates || ends) {
                    break
                }
                end++
            }
            lambdas.push([i, end])
        }
    })

    tokens.forEach((token, i) => {
        if (token.type !== 'name') {
            return
        }
        const open = nextSignificant(tokens, i)
        if (open === -1 || !isOp(tokens[open], '(')) {
            return
        }
        const before = previousSignificant(tokens, i)
        if (before >= 0 && (isName(tokens[before], 'def') || isName(tokens[before], 'class'))) {
            return
        }

        // A call written as a.b.c(...) is awaited from the start of a.b.c, if that starts with a plain name
        let start = i
        const dotted = before >= 0 && isOp(tokens[before], '.')
        if (dotted) {
            while (isOp(tokens[start - 1], '.') && tokens[start - 2] && tokens[start - 2].type === 'name') {
                start -= 2
            }
            if (isOp(tokens[start - 1], '.')) {
                return
            }
        }

        const awaited = dotted ? asyncUser.has(token.text) : (ROBOT_FUNCTIONS.includes(token.text) || asyncUser.has(token.text))
        if (!awaited) {
            return
        }

        if (comprehensions.some(([from, to]) => i > from && i < to)) {
            throw new PythonError(token.line, `${token.text}() can't be used inside a list comprehension or generator. Use a for loop instead.`)
        }
        if (lambdas.some(([from, to]) => i > from && i < to)) {
            throw new PythonError(token.line, `${token.text}() can't be used inside a lambda. Use a def instead.`)
        }

        const close = closingBracket(tokens, open)
        edits.push({at: tokens[start].start, text: `(await __at__(${token.line}, `, drop: 0})
        edits.push({at: token.end, text: ')', drop: 0})
        edits.push({at: tokens[close].end, text: ')', drop: 0})
    })

    // global x inside a function is nonlocal x now. At the top of the program it does nothing.
    const globals = new Set()
    tokens.forEach((token, i) => {
        if (!isName(token, 'global')) {
            return
        }
        const before = previousSignificant(tokens, i)
        if (before >= 0 && !['newline'].includes(tokens[before].type) && !isOp(tokens[before], ';')) {
            return
        }

        const lineStart = tokens.slice(0, i).reverse().findIndex(t => t.type === 'newline')
        const first = lineStart === -1 ? 0 : i - lineStart
        const indent = tokens[first].type === 'space' ? tokens[first].text.length : 0

        for (let k = i + 1; k < tokens.length && tokens[k].type !== 'newline'; k++) {
            if (tokens[k].type === 'name') {
                globals.add(tokens[k].text)
            }
        }
        edits.push(indent > 0
            ? {at: token.start, text: 'nonlocal', drop: token.text.length}
            : {at: token.start, text: 'pass  #', drop: token.text.length})
    })

    // Apply the edits from the end, so the earlier positions stay right
    let code = source
    const ordered = edits.map((edit, order) => ({...edit, order})).sort((a, b) => b.at - a.at || b.order - a.order)
    for (const edit of ordered) {
        code = code.slice(0, edit.at) + edit.text + code.slice(edit.at + edit.drop)
    }

    // Lines that begin inside a string must keep their text exactly
    const insideString = new Set()
    for (const token of tokens) {
        if (token.type === 'string') {
            const newlines = token.text.split('\n').length - 1
            for (let k = 1; k <= newlines; k++) {
                insideString.add(token.line + k)
            }
        }
    }

    const body = code.split('\n')
        .map((text, i) => insideString.has(i + 1) || text.trim() === '' ? text : `    ${text}`)
        .join('\n')

    return {body, globals: [...globals], lines: source.split('\n').length}
}

// ---------------------------------------------------------------------------------- the whole program

// The Python that the robot's functions are written in. They are async because they take game time; the
// program is made to await them by rewrite(). They hand back real Python values: dicts, lists, True, None.
const prelude = bridge => `from browser import window, aio

async def _robot(name, *args):
    return eval(await window.${bridge}.call(name, *args))

async def move(direction):
    return await _robot('move', direction)

class Thing:
    def __init__(self, fields):
        for key, value in fields.items():
            setattr(self, key, value)

    def __getitem__(self, key):
        return getattr(self, key)

    def __repr__(self):
        return 'Thing(' + ', '.join([key + '=' + repr(value) for key, value in self.__dict__.items()]) + ')'

async def scan():
    return [Thing(item) for item in await _robot('scan')]

async def pickup(item_id):
    return await _robot('pickup', item_id)

async def say(item_id, text):
    return await _robot('say', item_id, text)

async def spill(item_id):
    return await _robot('spill', item_id)

async def wait(ticks=1):
    return await _robot('wait', ticks)

def inventory():
    return [Thing(item) for item in eval(window.${bridge}.inventory())]

def print(*args, sep=' ', end='\\n'):
    window.${bridge}.print(sep.join([str(arg) for arg in args]))

def __at__(line, fn):
    window.${bridge}.line(line)
    return fn

`

const epilogue = bridge => `

async def __robot_main__():
    try:
        await __program__()
    except BaseException as error:
        lines = []
        trace = error.__traceback__
        while trace is not None:
            lines.append(trace.tb_lineno)
            trace = trace.tb_next
        window.${bridge}.failed(type(error).__name__, str(error), ','.join([str(n) for n in lines]))
    else:
        window.${bridge}.done()

aio.run(__robot_main__())
`

// The complete Python source for a program, and how many lines come before the player's code in it
export const buildProgram = (userCode, bridge) => {
    const {body, globals, lines} = rewrite(userCode.replace(/\r\n?/g, '\n'))

    const head = prelude(bridge)
        + 'async def __program__():\n'
        + globals.map(name => `    ${name} = None\n`).join('')

    return {
        source: head + (body.trim() === '' ? '    pass' : body) + epilogue(bridge),
        offset: head.split('\n').length - 1,
        lines,
    }
}

// ---------------------------------------------------------------------------------- Brython

const addScript = src => new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.onload = resolve
    script.onerror = () => reject(new Error(`Couldn't load ${src}. Python needs it to run.`))
    document.head.appendChild(script)
})

let loading = null
let ready = false

// Whether Brython is already loaded, so that loadBrython() will be instant
export const isBrythonReady = () => ready

// Loads Brython (once) and starts it. The standard library is loaded too, before Brython starts, so that
// the player can import things like random and math.
export const loadBrython = () => {
    loading ??= (async () => {
        if (typeof window.__BRYTHON__?.runPythonSource !== 'function') {
            await addScript(`${BRYTHON_URL}brython.min.js`)
            await addScript(`${BRYTHON_URL}brython_stdlib.js`)
            window.brython({indexedDB: false})
        }
        ready = true
        return window.__BRYTHON__
    })().catch(err => {
        loading = null
        throw err
    })
    return loading
}

// A robot function's result as Python source for a literal, which the prelude eval()s into real Python
// values. (JSON strings are valid Python string literals.)
const toPython = value => {
    if (value === null || value === undefined) {
        return 'None'
    }
    if (value === true) {
        return 'True'
    }
    if (value === false) {
        return 'False'
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? String(value) : 'None'
    }
    if (typeof value === 'string') {
        return JSON.stringify(value)
    }
    if (Array.isArray(value)) {
        return `[${value.map(toPython).join(', ')}]`
    }
    return `{${Object.entries(value).map(([key, item]) => `${JSON.stringify(key)}: ${toPython(item)}`).join(', ')}}`
}

const HALTED = ['Stopped.', 'The level changed.']

let runCount = 0

// Runs the player's Python on the robot. `onLine(n)` is told the line the program is on (counting from
// 1) as it starts each action, and `log(kind, text)` writes to the output: 'log' for what the program
// prints, 'action' for what the robot did, and 'info' and 'error'. Resolves once the program has finished,
// been stopped or failed; it never throws.
export const runPython = async (code, getState, log, run, clock, onLine = () => {}) => {
    const bridgeName = `__robot_${++runCount}__`

    let program
    try {
        program = buildProgram(code, bridgeName)
    }
    catch (err) {
        if (err instanceof PythonError) {
            log('error', `Line ${err.line}: ${err.message}`)
            return
        }
        throw err
    }

    let api
    try {
        api = createRobot(getState, log, run, clock)
    }
    catch (err) {
        log('error', err.message)
        return
    }

    let brython
    try {
        brython = await loadBrython()
    }
    catch (err) {
        log('error', err.message)
        return
    }

    // What the Python side calls back into. Its own name for each run, so that a program that was stopped
    // can't report into the next one.
    let lastLine = null
    let settle
    const finished = new Promise(resolve => settle = resolve)

    window[bridgeName] = {
        call: async (name, ...args) => {
            if (!ROBOT_FUNCTIONS.includes(name)) {
                throw new Error(`There is no robot function '${name}'`)
            }
            return toPython(await api[name](...args))
        },
        inventory: () => toPython(api.inventory()),
        line: line => {
            lastLine = line
            onLine(line)
        },
        print: text => log('log', text),
        done: () => settle({kind: 'done'}),
        failed: (type, message, lines) => {
            const inProgram = String(lines).split(',').map(Number)
                .filter(n => n > program.offset && n <= program.offset + program.lines)
            const line = inProgram.length > 0 ? inProgram[inProgram.length - 1] - program.offset : lastLine

            // A JavaScript error is the robot refusing something, which reads better without the type
            const text = type === 'JavascriptError' ? String(message).replace(/^\w*Error: /, '') : `${type}: ${message}`
            settle({kind: HALTED.includes(text) ? 'halted' : 'failed', line, text})
        },
    }

    try {
        brython.runPythonSource(program.source, `robot_program_${runCount}`)
    }
    catch (err) {
        delete window[bridgeName]

        // A syntax error: its message, and where in the player's code it is
        const place = err?.args?.[1]
        const line = Array.isArray(place) && typeof place[1] === 'number' ? Math.max(1, place[1] - program.offset) : null
        const kind = err?.__class__?.__qualname__ ?? 'Error'
        log('error', `${line === null ? '' : `Line ${line}: `}${kind}: ${err?.args?.[0] ?? err?.message ?? err}`)
        return
    }

    try {
        const outcome = await Promise.race([finished, run.whenStopped.then(() => ({kind: 'stopped'}))])
        if (outcome.kind === 'done') {
            log('info', 'Done.')
        }
        else if (outcome.kind === 'stopped') {
            log('info', 'Stopped.')
        }
        else if (outcome.kind === 'halted') {
            log('info', outcome.text)
        }
        else {
            log('error', `${outcome.line === null ? '' : `Line ${outcome.line}: `}${outcome.text}`)
        }
    }
    finally {
        delete window[bridgeName]
    }
}
