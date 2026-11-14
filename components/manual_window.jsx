import React from 'react'
import {FloatingWindow} from './floating_window.jsx'

// The quick summary at the top: each function and a few words
const SUMMARY = [
    ['move(direction)', 'step one block: n e s w, or f b l r from where you face'],
    ['scan()', 'list what is within 3 blocks'],
    ['pickup(id)', 'take a small thing next to you'],
    ['say(id, text)', 'talk to a person'],
    ['spill(id)', 'knock over a cup or mug'],
    ['wait(ticks)', 'do nothing for a while'],
    ['inventory()', 'what you are carrying'],
    ['print(...)', 'show something in the output'],
]

// What the robot's code can call (see game/robot.js). `call` is how it is written, `does` what it does.
const FUNCTIONS = [
    {
        call: "move('n' | 'e' | 's' | 'w' | 'f' | 'b' | 'l' | 'r')",
        does: "Take one step. n is toward the back wall, e toward the right, s toward the front, w toward the left. Or go from the way the robot is facing: f forward, b back, l left, r right. Gives back a dict: {'ok': True}, or {'ok': False, 'reason': ...} if something is in the way.",
    },
    {
        call: 'scan()',
        does: "Look around. Gives back a list of the things within 3 blocks, each one an object with the fields name, id, owner, owned and away.",
    },
    {
        call: 'pickup(id)',
        does: 'Pick up a cup, mug, wallet, laptop or other small thing that is right next to you. It does not work on something that is owned.',
    },
    {
        call: 'say(id, text)',
        does: 'Say something to a person within 3 blocks. They get up and leave.',
    },
    {
        call: 'spill(id)',
        does: 'Knock over a cup or mug that is right next to you. Anyone next to it gets it on them, and leaves.',
    },
    {
        call: 'wait(ticks)',
        does: 'Do nothing for that many ticks. wait() on its own is one tick.',
    },
    {
        call: 'inventory()',
        does: 'What you are carrying, in the same form as scan(). It takes no time.',
    },
    {
        call: 'print(...)',
        does: 'Print to the output under the editor, as Python does.',
    },
]

const THINGS = [
    ['name', "What kind of thing it is: 'mug', 'table', 'person'..."],
    ['id', 'Its own name, which is what pickup, say and spill take.'],
    ['owner', 'The id of the person it belongs to, or None.'],
    ['owned', 'True if its owner is within 1.5 blocks of it right now. Owned things cannot be picked up, and the owner will tell you off for trying.'],
    ['away', "Where it is from you, like {'n': 2, 'e': 1} for two blocks north and one east. Only the directions it is in are there."],
]

const VIM_KEYS = [
    ['i  a  I  A  o  O', 'Start typing (insert mode). Esc to stop.'],
    ['h j k l  0 ^ $', 'Move: left, down, up, right, line start, first character, line end.'],
    ['w b e  W B E', 'Move by word.'],
    ['gg  G  f t F T + a character', 'Top, bottom, or along the line to a character.'],
    ['x  dd  dw  D', 'Delete a character, a line, a word, to the end of the line.'],
    ['cw  cc  C  s  S', 'Change: delete, then type.'],
    ['yy  yw  Y  p  P', 'Copy and paste.'],
    ['diw  ciw  daw', 'The word under the cursor.'],
    ['>>  <<  J  r  ~', 'Indent, dedent, join lines, replace a character, swap case.'],
    ['v  V', 'Select by character or by line, then d, y, c, > or <.'],
    ['u  Ctrl+r', 'Undo, redo.'],
    ['3j  2dd  d2w', 'A number first repeats the command.'],
]

const Heading = props => (
    <h3 className="mb-1.5 mt-4 text-xs font-semibold uppercase tracking-wide text-white/50 first:mt-0">{props.children}</h3>
)

const Code = props => <code className="font-mono text-emerald-200">{props.children}</code>

// The manual: what the robot's code can do, the game's rules, and the editor's keys.
export const ManualWindow = () => (
    <FloatingWindow title="Manual" place={{left: 16, top: 190, width: 440, height: 440}}>
        <div className="min-w-0 flex-1 overflow-y-auto p-3 text-sm leading-6">
            <Heading>In short</Heading>
            <div className="rounded bg-black/20 px-2.5 py-2">
                {SUMMARY.map(([call, text]) => (
                    <div key={call} className="flex gap-3">
                        <span className="w-36 shrink-0 font-mono text-emerald-200">{call}</span>
                        <span className="text-white/70">{text}</span>
                    </div>
                ))}
            </div>

            <Heading>Running your code</Heading>
            <p className="text-white/80">
                Write Python for the robot in the code window. Run starts the level over and runs it from the top,
                Step runs it one tick at a time, and Restart puts everything back. The robot's functions are called like
                any other and the program waits for each one to finish, so there is no need for <Code>await</Code>.
            </p>
            <p className="mt-2 text-white/80">
                Everything the robot does takes one tick, which is 0.75 seconds of game time, whether it works or not.
                Only inventory() is free. The game window counts the ticks and shows the line the program is on.
            </p>

            <Heading>Interactive</Heading>
            <p className="text-white/80">
                The Interactive button in the game window starts the level over and lets you drive the robot yourself.
                The arrow keys move it (up is n, right is e, down is s, left is w). Left-click an item for what scan()
                would tell you about it, and right-click it for a window of the things the robot can do with it. Each
                takes a tick, as in code. Each one is added to the end of your code and run, and the game is paused between
                them: it only moves while a line is running, and anything you press meanwhile is ignored. Press the
                button again, or Restart, to stop.
            </p>

            <Heading>The robot</Heading>
            <div className="space-y-2">
                {FUNCTIONS.map(fn => (
                    <div key={fn.call}>
                        <div className="font-mono text-emerald-200">{fn.call}</div>
                        <div className="text-white/70">{fn.does}</div>
                    </div>
                ))}
            </div>

            <Heading>What scan() tells you</Heading>
            <p className="mb-2 text-white/80">Each thing in the list is an object, so <Code>thing.id</Code> is its id.</p>
            <div className="space-y-2">
                {THINGS.map(([field, text]) => (
                    <div key={field}>
                        <span className="font-mono text-sky-300">{field}</span>
                        <span className="text-white/70"> {text}</span>
                    </div>
                ))}
            </div>

            <Heading>People and their things</Heading>
            <p className="text-white/80">
                A thing is owned while the person it belongs to is within 1.5 blocks of it. Walk off with someone's
                wallet while they are away from it and nobody minds. Try to take their mug while they are sitting
                right there and they will shout at you.
            </p>

            <Heading>Python notes</Heading>
            <ul className="list-disc space-y-1 pl-5 text-white/80">
                <li>
                    Your own functions can call the robot's, and so can their callers. The robot's functions
                    don't work inside a <Code>lambda</Code> or a list comprehension, so use a <Code>def</Code> or a for loop there.
                </li>
                <li>
                    You can <Code>import</Code> things like <Code>random</Code> and <Code>math</Code>. Python is run by Brython, which
                    is fetched the first time you press Run.
                </li>
            </ul>

            <Heading>Editor keys</Heading>
            <p className="mb-2 text-white/80">
                The editor works like vim. It starts in normal mode, where keys are commands. Press i to type, and Esc to
                get back to commands. Ctrl+Enter runs the program from either.
            </p>
            <div className="space-y-1">
                {VIM_KEYS.map(([keys, text]) => (
                    <div key={keys} className="flex gap-3">
                        <span className="w-44 shrink-0 font-mono text-xs leading-6 text-amber-200">{keys}</span>
                        <span className="text-white/70">{text}</span>
                    </div>
                ))}
            </div>
        </div>
    </FloatingWindow>
)
