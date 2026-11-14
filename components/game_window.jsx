import React from 'react'
import {FloatingWindow} from './floating_window.jsx'

const PHASES = {
    idle: {label: 'Ready', color: 'text-white/50'},
    running: {label: 'Running', color: 'text-emerald-400'},
    paused: {label: 'Paused', color: 'text-amber-300'},
    finished: {label: 'Finished', color: 'text-sky-300'},
    interactive: {label: 'Interactive', color: 'text-fuchsia-300'},
}

// The window that runs the game: the tick count and the buttons.
//
//   phase      'idle' (nothing run yet), 'running', 'paused' (stepping) or 'finished' (the program ended)
//   ticks      how many game ticks have gone by since the program started
//   line       the line of the code the program is on (counting from 1), or null when it isn't running
//   onRun     run the program from the start, or carry on if it is paused
//   onStep     run the program one tick further, starting it paused if it isn't running
//   onRestart  stop everything and put the level back how it started
//   onInteractive  start (or, if it is on, stop) driving the robot by hand; phase is 'interactive' while on
export const GameWindow = props => {
    const {phase, ticks, line, onRun, onStep, onRestart, onInteractive} = props

    const button = 'rounded px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40'

    return (
        <FloatingWindow title="Game" place={{right: 16, top: 16, width: 300, height: 190}}>
            <div className="flex min-w-0 flex-1 flex-col justify-between p-3">
                <div className="flex items-end justify-between">
                    <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-white/50">Game tick</div>
                        <div className="font-mono text-4xl leading-none">{ticks}</div>
                    </div>
                    <div className="text-right">
                        <div className={`text-sm font-medium ${PHASES[phase].color}`}>{PHASES[phase].label}</div>
                        <div className="font-mono text-xs text-white/50">{phase === 'interactive' ? 'Arrow keys move' : line === null ? 'Line -' : `Line ${line}`}</div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={onRun}
                        disabled={phase === 'running'}
                        className={`${button} bg-emerald-500/80 text-white hover:bg-emerald-500`}
                    >
                        {phase === 'paused' ? 'Resume' : 'Run'}
                    </button>
                    <button onClick={onStep} className={`${button} bg-sky-500/80 text-white hover:bg-sky-500`}>Step</button>
                    <button onClick={onRestart} className={`${button} bg-white/10 text-white/80 hover:bg-white/20`}>Restart</button>
                    <button
                        onClick={onInteractive}
                        title="Drive the robot yourself: arrow keys move, click an item for info, right-click it for actions"
                        className={`${button} ${phase === 'interactive' ? 'bg-fuchsia-500/80 text-white hover:bg-fuchsia-500' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}
                    >
                        {phase === 'interactive' ? 'Stop interactive' : 'Interactive'}
                    </button>
                </div>
            </div>
        </FloatingWindow>
    )
}
