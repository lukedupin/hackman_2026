import React, {useEffect, useLayoutEffect, useRef, useState} from 'react'
import {FloatingWindow} from './floating_window.jsx'
import {createVim, press, leaveInsert, moveTo, selectionOf, statusOf, positionOf, INDENT} from './vim.js'
import {highlight} from './python_highlight.js'

// What the editor starts with: a short walk to try. What the robot can do is in the manual window.
export const STARTER_CODE = `for step in range(3):
    move('w')

things = scan()
print('I can see', len(things), 'things')
for thing in things:
    print(thing.name, thing.id, thing.away)
`

const LINE_COLORS = {
    log: 'text-white',
    action: 'text-sky-300',
    info: 'text-white/50',
    error: 'text-red-400',
}

// The text's colours, by what python_highlight.js calls each piece
// (Solarized dark: green, yellow, orange, magenta, violet, blue and cyan on its base tones.)
const KIND_COLORS = {
    keyword: '#859900',
    robot: '#b58900',
    def: '#268bd2',
    call: '#4aa3df',
    string: '#2aa198',
    number: '#d33682',
    comment: '#657b83',
    op: '#cb4b16',
    name: '#93a1a1',
}

// Both layers must lay text out identically, tabs included, or the invisible text drifts off the coloured text
const TEXT_STYLE = {whiteSpace: 'pre', tabSize: 4, MozTabSize: 4, fontVariantLigatures: 'none', letterSpacing: 'normal'}

// The entries of a dropdown, which the browser draws on its own background: colours set outright so
// they are readable whatever that is
export const OPTION_STYLE = {color: '#e2e8f0', backgroundColor: '#1e293b'}

// The textarea's text metrics (leading-5 and p-2), to keep the cursor line in view
const LINE_HEIGHT = 20
const PADDING = 8

// The key a keydown means to vim, or null if the browser should keep it (copy, F5, Tab...).
const vimKey = e => {
    if (e.key === 'Escape') {
        return 'Escape'
    }
    if (e.ctrlKey && e.key === 'r') {
        return 'Ctrl-r'
    }
    if (e.ctrlKey || e.metaKey || e.altKey) {
        return null
    }

    const named = {ArrowLeft: 'h', ArrowRight: 'l', ArrowUp: 'k', ArrowDown: 'j', Backspace: 'h', ' ': 'l', Enter: 'j'}
    if (e.key in named) {
        return named[e.key]
    }
    return e.key.length === 1 ? e.key : null
}

// The window with the Python editor and the program's output. The code itself is kept by the
// game (its Run and Step buttons run it). The editor takes vim keys: it starts in normal mode, i
// types, Esc goes back (see vim.js).
//
//   interactive, onInteractive  whether interactive mode is on, and what the button under the code does
//   programs      [{id, name}], every program the player has, for the picker in the title; currentId is the one open
//   onSelect, onNew  called with a program's id when another is picked, and with nothing for the + button
//   code, onCode  the code, and a function that is given the new code when it is edited
//   onRun         run the code, as the Run button does; Ctrl+Enter calls it
//   currentLine   the line the running program is on (counting from 1), or null; its number is lit up
//   output        [{kind, text}] to show under the editor, kind being log, action, info or error
export const CodeWindow = props => {
    const {interactive, onInteractive, programs, currentId, onSelect, onNew, code, onCode: setCode, onRun, currentLine, output} = props

    const [, setTick] = useState(0)                // bumped to redraw after vim changes its own state
    const vimRef = useRef(null)
    const vimFor = useRef(currentId)                // the program vim's state is for
    if (vimRef.current === null || vimFor.current !== currentId) {
        // Another program is a fresh start for vim: its cursor and undo history belong to the old text
        vimFor.current = currentId
        vimRef.current = createVim()
    }
    const vim = vimRef.current

    const gutterRef = useRef(null)
    const colorsRef = useRef(null)
    const outputRef = useRef(null)
    const textareaRef = useRef(null)
    const shown = useRef({cursor: -1, mode: ''})      // where vim's cursor was when we last scrolled to it

    const refresh = () => setTick(tick => tick + 1)

    // Keep the newest line of output in view
    useEffect(() => {
        outputRef.current.scrollTop = outputRef.current.scrollHeight
    }, [output])

    // Scrolls the editor so that a line is in view
    const showLine = line => {
        const textarea = textareaRef.current
        const top = PADDING + line * LINE_HEIGHT
        if (top < textarea.scrollTop + PADDING) {
            textarea.scrollTop = Math.max(0, top - PADDING)
        }
        else if (top + LINE_HEIGHT + PADDING > textarea.scrollTop + textarea.clientHeight) {
            textarea.scrollTop = top + LINE_HEIGHT + PADDING * 2 - textarea.clientHeight
        }
    }

    // Show vim's cursor (the character under it highlighted) or its selection, and keep it in view when it
    // moves. In insert mode the textarea has its own caret, which only needs placing when insert mode begins.
    useLayoutEffect(() => {
        const textarea = textareaRef.current

        if (vim.mode === 'insert') {
            if (vim.caretRequest === null) {
                return
            }
            textarea.setSelectionRange(vim.caretRequest, vim.caretRequest)
            showLine(positionOf(code, vim.caretRequest).line)
            vim.caretRequest = null
            return
        }

        const [start, end] = selectionOf(vim, code)
        textarea.setSelectionRange(start, end)

        // Only when the cursor has moved: the program's current line scrolls the editor too (below), and a
        // redraw for that shouldn't pull the view back to the cursor
        if (shown.current.cursor !== vim.cursor || shown.current.mode !== vim.mode) {
            shown.current = {cursor: vim.cursor, mode: vim.mode}
            showLine(positionOf(code, vim.cursor).line)
        }
    })

    // Follow the program: bring the line it is on into view
    useEffect(() => {
        if (currentLine !== null) {
            showLine(currentLine - 1)
        }
    }, [currentLine])

    const onKeyDown = e => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            onRun()
            return
        }

        if (vim.mode === 'insert') {
            if (e.key === 'Escape' || (e.ctrlKey && e.key === '[')) {
                e.preventDefault()
                leaveInsert(vim, code, e.target.selectionStart)
                refresh()
                return
            }

            // Tab types an indent, rather than moving focus out of the editor
            if (e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault()
                const {selectionStart, selectionEnd} = e.target
                setCode(code.slice(0, selectionStart) + INDENT + code.slice(selectionEnd))
                requestAnimationFrame(() => {
                    e.target.selectionStart = e.target.selectionEnd = selectionStart + INDENT.length
                })
            }
            return
        }

        const key = vimKey(e)
        if (key === null) {
            return
        }
        e.preventDefault()

        const next = press(vim, key, code)
        if (next !== code) {
            setCode(next)
        }
        refresh()
    }

    // A click puts vim's cursor where it landed
    const onMouseUp = e => {
        if (vim.mode === 'insert') {
            return
        }
        moveTo(vim, code, e.target.selectionStart)
        refresh()
    }

    // The textarea scrolls; the colours and the line numbers follow it
    const onScroll = e => {
        gutterRef.current.scrollTop = e.target.scrollTop
        colorsRef.current.scrollTop = e.target.scrollTop
        colorsRef.current.scrollLeft = e.target.scrollLeft
    }

    // The title is the program picker and the + beside it. Pressing on them must not start dragging the window.
    const titleBar = (
        <span className="flex items-center gap-2" onPointerDown={e => e.stopPropagation()}>
            <select
                value={currentId}
                onChange={e => onSelect(e.target.value)}
                title="Your robot programs"
                style={OPTION_STYLE}
                className="cursor-pointer rounded border-0 py-0.5 pl-2 pr-7 text-xs font-medium normal-case tracking-normal text-white focus:ring-1 focus:ring-white/40"
            >
                {programs.map(program => (
                    <option key={program.id} value={program.id} style={OPTION_STYLE}>{program.name}</option>
                ))}
            </select>
            <button
                onClick={onNew}
                title="New program"
                className="rounded bg-white/10 px-2 text-sm font-semibold leading-5 text-white hover:bg-white/20"
            >
                +
            </button>
        </span>
    )

    const colored = highlight(code)
    const lineCount = colored.length
    const status = statusOf(vim)
    const position = positionOf(code, vim.mode === 'insert' ? (textareaRef.current?.selectionStart ?? 0) : vim.cursor)

    return (
        <FloatingWindow title={titleBar} subtitle="Python" place={{left: 16, bottom: 16, width: 780, height: 460}}>
            <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex min-h-0 flex-1">
                    <div
                        ref={gutterRef}
                        aria-hidden="true"
                        className="select-none overflow-hidden bg-black/20 px-2 py-2 text-right font-mono text-sm leading-5 text-white/30"
                    >
                        {Array.from({length: lineCount}, (_, i) => (
                            <div key={i} className={i + 1 === currentLine ? 'rounded bg-emerald-500/40 px-1 text-emerald-100' : 'px-1'}>
                                {i + 1}
                            </div>
                        ))}
                    </div>

                    <div className="relative min-w-0 flex-1">
                        {/* The coloured code, underneath. The textarea above it is what you type in, with its
                            own text invisible, so you see this through it. */}
                        <div
                            ref={colorsRef}
                            aria-hidden="true"
                            style={TEXT_STYLE}
                            className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre p-2 font-mono text-sm leading-5"
                        >
                            <div className="w-max min-w-full">
                                {colored.map((pieces, i) => (
                                    <div
                                        key={i}
                                        style={{height: LINE_HEIGHT}}
                                        className={i + 1 === currentLine ? 'bg-emerald-400/25 ring-1 ring-inset ring-emerald-400/50' : ''}
                                    >
                                        {pieces.map((piece, k) => <span key={k} style={{color: KIND_COLORS[piece.kind]}}>{piece.text}</span>)}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <textarea
                            ref={textareaRef}
                            value={code}
                            readOnly={vim.mode !== 'insert'}
                            onChange={e => setCode(e.target.value)}
                            onKeyDown={onKeyDown}
                            onMouseUp={onMouseUp}
                            onScroll={onScroll}
                            spellCheck={false}
                            wrap="off"
                            style={{...TEXT_STYLE, WebkitTextFillColor: 'transparent'}}
                            className="absolute inset-0 h-full w-full resize-none whitespace-pre border-0 bg-transparent p-2 font-mono text-sm leading-5 text-transparent caret-emerald-300 selection:bg-amber-400/40 focus:ring-0"
                        />
                    </div>
                </div>

                {/* Under the last line of code: interactive mode runs the program, then adds a line of code
                    for each arrow key or action you pick, and runs it */}
                <div className="flex shrink-0 items-center gap-3 border-t border-white/10 bg-black/20 px-2 py-1.5">
                    <button
                        onClick={onInteractive}
                        className={`rounded px-3 py-1 text-xs font-medium text-white ${interactive ? 'bg-fuchsia-500/80 hover:bg-fuchsia-500' : 'bg-white/10 hover:bg-white/20'}`}
                        style={interactive ? undefined : {backgroundColor: '#334155'}}
                    >
                        {interactive ? 'Stop interactive' : 'Interactive'}
                    </button>
                    <span className="text-xs text-slate-400">
                        {interactive
                            ? 'Arrow keys add move lines, right-click an item for more. Each line is added here and run.'
                            : 'Runs this program, then lets you add lines by hand.'}
                    </span>
                </div>

                <div className="flex shrink-0 items-center gap-3 bg-black/30 px-2 py-0.5 font-mono text-xs">
                    <span className={vim.mode === 'insert' ? 'font-bold text-emerald-400' : 'font-bold text-amber-300'}>
                        {status.label}
                    </span>
                    <span className="text-white/60">{status.pending}</span>
                    <span className="ml-auto text-white/30">Ctrl+Enter runs</span>
                    <span className="text-white/40">{position.line + 1}:{position.column + 1}</span>
                </div>

                <div ref={outputRef} className="h-32 shrink-0 overflow-y-auto border-t border-white/10 bg-black/30 px-3 py-2 font-mono text-xs leading-5">
                    {output.length === 0 && <span className="text-white/30">Output appears here.</span>}
                    {output.map((line, i) => (
                        <div key={i} className={`whitespace-pre-wrap ${LINE_COLORS[line.kind]}`}>{line.text}</div>
                    ))}
                </div>
            </div>
        </FloatingWindow>
    )
}
