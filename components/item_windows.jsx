import React from 'react'
import {FloatingWindow} from './floating_window.jsx'

// Where a window opens for a click at (x, y): beside the click, kept on screen
const placeAt = (at, width, height) => ({
    left: Math.max(8, Math.min(at.x + 12, window.innerWidth - width - 8)),
    top: Math.max(8, Math.min(at.y + 12, window.innerHeight - height - 8)),
    width,
    height,
})

// How far away is told, like "2 n, 1 e", from an `away` dict
const awayText = away => {
    const parts = ['n', 'e', 's', 'w'].filter(key => key in away).map(key => `${away[key]} ${key}`)
    return parts.length === 0 ? 'here' : parts.join(', ')
}

const Row = props => (
    <div className="flex justify-between gap-3 py-0.5">
        <span className="text-white/50">{props.label}</span>
        <span className="min-w-0 truncate text-right font-mono text-xs leading-5 text-white/90">{props.children}</span>
    </div>
)

// What a left click shows: the item as scan() would describe it, if it is near enough to make out.
//
//   info     from lookAt() in game/robot.js
//   at       {x, y}, where the click was
//   onClose  closes the window
export const ItemInfoWindow = props => {
    const {info, at, onClose} = props

    return (
        <FloatingWindow title={info.label} subtitle={info.id} place={placeAt(at, 280, 230)} onClose={onClose}>
            <div className="min-w-0 flex-1 overflow-y-auto p-3 text-sm">
                {!info.nearby &&
                <p className="text-white/60">
                    Too far away to make out. Get within 3 blocks of it to see more.
                </p>
                }

                {info.nearby &&
                <>
                    <Row label="name">{info.name}</Row>
                    <Row label="id">{info.id}</Row>
                    <Row label="away">{info.held ? 'carried' : awayText(info.away)}</Row>
                    <Row label="owner">{info.owner ?? 'None'}</Row>
                    <Row label="owned">{info.owned ? 'True' : 'False'}</Row>
                    {info.on && <Row label="on">{info.on}</Row>}
                    {info.spilled && <Row label="state">spilled</Row>}
                    {info.gone && <Row label="state">has left</Row>}
                </>
                }
            </div>
        </FloatingWindow>
    )
}

// What the robot can try with an item, as buttons. Each is a robot function and takes a tick, as in code.
//
//   info     from lookAt() in game/robot.js
//   at       {x, y}, where the click was
//   busy     true while the robot is still doing something
//   onAct    called with the function's name and arguments: onAct('pickup', ['mug_1'])
//   onClose  closes the window
export const ItemActionsWindow = props => {
    const {info, at, busy, onAct, onClose} = props

    const actions = [
        info.can.pickup && {label: 'Pick up', call: 'pickup', args: [info.id], hint: `pickup('${info.id}')`},
        info.can.say && {label: 'Say hello', call: 'say', args: [info.id, 'Hello!'], hint: `say('${info.id}', 'Hello!')`},
        info.can.spill && {label: 'Spill it', call: 'spill', args: [info.id], hint: `spill('${info.id}')`},
    ].filter(Boolean)

    return (
        <FloatingWindow title={`Do: ${info.label}`} subtitle={info.id} place={placeAt(at, 260, 200)} onClose={onClose}>
            <div className="min-w-0 flex-1 overflow-y-auto p-3">
                {actions.length === 0 &&
                <p className="text-sm text-white/60">There is nothing the robot can do with this.</p>
                }

                <div className="space-y-2">
                    {actions.map(action => (
                        <button
                            key={action.call}
                            disabled={busy}
                            onClick={() => onAct(action.call, action.args)}
                            className="block w-full rounded bg-white/10 px-3 py-1.5 text-left hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <span className="text-sm font-medium">{action.label}</span>
                            <span className="ml-2 font-mono text-xs text-white/40">{action.hint}</span>
                        </button>
                    ))}
                </div>

                {actions.length > 0 && !info.nearby &&
                <p className="mt-3 text-xs text-white/50">It is far away: walk up next to it first.</p>
                }
            </div>
        </FloatingWindow>
    )
}
