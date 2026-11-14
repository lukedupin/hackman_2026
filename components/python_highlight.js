import {tokenize, ROBOT_FUNCTIONS} from '../game/python.js'

// Colours Python for the code window. highlight(code) gives the code as lines, each a list of
// {text, kind} pieces, where kind says how to colour it:
//
//   keyword   if, for, def, return, True...
//   robot     the robot's own functions (move, scan, pickup...) and print
//   def       the name of a function or class where it is defined
//   call      any other name that is being called
//   string    'text'
//   number    42
//   comment   # like this
//   op        the special characters: brackets, : , . = + - and the rest
//   name      everything else
const KEYWORDS = new Set([
    'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del',
    'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal',
    'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
])

const ROBOT_NAMES = new Set([...ROBOT_FUNCTIONS, 'inventory', 'print'])

const KINDS = {name: 'name', number: 'number', string: 'string', comment: 'comment', op: 'op', space: 'name', newline: 'name'}

export const highlight = code => {
    const tokens = tokenize(code)

    const significant = (from, step) => {
        let at = from + step
        while (tokens[at] && tokens[at].type === 'space') {
            at += step
        }
        return tokens[at]
    }

    const lines = [[]]
    tokens.forEach((token, i) => {
        let kind = KINDS[token.type]

        if (token.type === 'name') {
            const before = significant(i, -1)
            const after = significant(i, 1)
            if (KEYWORDS.has(token.text)) {
                kind = 'keyword'
            }
            else if (before && before.type === 'name' && (before.text === 'def' || before.text === 'class')) {
                kind = 'def'
            }
            else if (ROBOT_NAMES.has(token.text) && !(before && before.type === 'op' && before.text === '.')) {
                kind = 'robot'
            }
            else if (after && after.type === 'op' && after.text === '(') {
                kind = 'call'
            }
        }

        // A token can run over several lines (a triple-quoted string): each line gets its own piece
        token.text.split('\n').forEach((text, part) => {
            if (part > 0) {
                lines.push([])
            }
            if (text !== '') {
                lines[lines.length - 1].push({text, kind})
            }
        })
    })
    return lines
}
