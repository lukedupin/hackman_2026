import React, {useEffect, useRef, useState} from 'react'
import {Routes, Route} from 'react-router-dom'
import * as THREE from 'three'
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js'
import {CheckCircleIcon} from '@heroicons/react/24/solid'
import {createGrid} from './components/grid.js'
import {LEVELS} from './levels/index.js'
import {WORLDS, FIRST_LEVEL, worldOf} from './worlds/index.js'
import {loadLevel, checkLevel, updateLevel, nearbyItems, NEARBY_RADIUS} from './game/level_runner.js'
import {createRun, createRobot, lookAt} from './game/robot.js'
import {runPython, loadBrython, isBrythonReady} from './game/python.js'
import {createClock, resetClock, gameDeltaOf, advanceClock, ticksOf, TICK_SECONDS} from './game/clock.js'
import {CodeWindow, STARTER_CODE, OPTION_STYLE} from './components/code_window.jsx'
import {NearbyWindow} from './components/nearby_window.jsx'
import {GameWindow} from './components/game_window.jsx'
import {ManualWindow} from './components/manual_window.jsx'
import {ItemInfoWindow, ItemActionsWindow} from './components/item_windows.jsx'

// The scene fills the whole view. Left-click and drag turns the camera around its focus, right-click
// and drag moves the focus across the grid, and the wheel zooms. When the level has a player the
// focus follows them instead, so only turning and zooming are left.
//
//   interactive  a ref holding {active, onPick}: while active, clicks on items are reported to onPick
const Scene = props => {
    const {level, resets, stateRef, clock, interactive, onStatus, onNearby, onTicks, showToast} = props

    const mountRef = useRef(null)
    const stuff = useRef(null)   // the renderer's scene and grid, for the level effect below

    useEffect(() => {
        const mount = mountRef.current

        const renderer = new THREE.WebGLRenderer({antialias: true})
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        mount.appendChild(renderer.domElement)

        const scene = new THREE.Scene()
        scene.background = new THREE.Color('#10151c')

        const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200)
        camera.position.set(0, 14, 18)

        scene.add(new THREE.HemisphereLight('#ffffff', '#3a4654', 1.1))
        const sun = new THREE.DirectionalLight('#ffffff', 1.6)
        sun.position.set(8, 20, 10)
        scene.add(sun)

        const grid = createGrid()
        scene.add(grid.group)

        // state is the loaded level, which moves things each frame; snap means the camera jumps to the
        // player instead of easing, as when a level has just loaded
        // nearKey is what the nearby list last sent looked like, to send it only on a change
        // ticks is the tick count last sent to the game window
        stuff.current = {scene, grid, state: null, snap: false, nearKey: null, ticks: 0}
        stateRef.current = () => stuff.current?.state ?? null

        // Left button turns the camera around the focus, right button slides the focus over the grid
        const controls = new OrbitControls(camera, renderer.domElement)
        controls.mouseButtons = {LEFT: THREE.MOUSE.ROTATE, MIDDLE: -1, RIGHT: THREE.MOUSE.PAN}
        controls.screenSpacePanning = false             // slide along the grid, not up into the air
        controls.enableDamping = true
        controls.minDistance = 6
        controls.maxDistance = 60
        controls.maxPolarAngle = Math.PI / 2 - 0.05     // never under the grid
        controls.target.set(0, 0, 0)
        controls.update()

        const resize = () => {
            const {clientWidth, clientHeight} = mount
            renderer.setSize(clientWidth, clientHeight)
            camera.aspect = clientWidth / Math.max(clientHeight, 1)
            camera.updateProjectionMatrix()
        }
        const observer = new ResizeObserver(resize)
        observer.observe(mount)
        resize()

        // Clicking things, when the game is in interactive mode (interactive.current.active): a click is
        // a press and release that hardly moved, so that turning the camera isn't one. The game is told
        // which item was under it (or null) and which button.
        const caster = new THREE.Raycaster()
        const pointer = new THREE.Vector2()
        const canvas = renderer.domElement
        let pressed = null

        const onPointerDown = e => {
            pressed = {x: e.clientX, y: e.clientY, button: e.button}
        }
        const onPointerUp = e => {
            const start = pressed
            pressed = null
            const hooks = interactive.current
            const state = stuff.current?.state
            if (!start || !hooks?.active || !state || start.button !== e.button) {
                return
            }
            if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5) {
                return
            }

            const rect = canvas.getBoundingClientRect()
            pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
            caster.setFromCamera(pointer, camera)

            // The first thing hit that belongs to an item (or is part of one), nearest first
            const byMesh = new Map(Object.values(state.items).map(item => [item.mesh, item]))
            let found = null
            for (const hit of caster.intersectObjects(scene.children, true)) {
                for (let part = hit.object; part && !found; part = part.parent) {
                    found = byMesh.get(part) ?? null
                }
                if (found) {
                    break
                }
            }
            hooks.onPick({id: found && found.type !== 'player' ? found.id : null, button: e.button, x: e.clientX, y: e.clientY})
        }
        const onContextMenu = e => e.preventDefault()
        canvas.addEventListener('pointerdown', onPointerDown)
        canvas.addEventListener('pointerup', onPointerUp)
        canvas.addEventListener('contextmenu', onContextMenu)

        // The focus can't be slid off the grid
        const limit = grid.extent / 2

        let last = performance.now()

        let frame = requestAnimationFrame(function animate() {
            // A long gap (a hidden tab) would otherwise throw the walkers far along their routes
            const now = performance.now()
            const delta = Math.min((now - last) / 1000, 0.1)
            last = now
            const {state, snap} = stuff.current

            // The game moves on by game time: real time, except when stepping, where it only moves as far as
            // the Step button has allowed. The camera below goes by real time either way.
            const gameDelta = gameDeltaOf(clock, delta)
            if (clock.counting) {
                advanceClock(clock, gameDelta)
            }
            if (state) {
                updateLevel(state, gameDelta)
            }

            const ticks = ticksOf(clock)
            if (ticks !== stuff.current.ticks) {
                stuff.current.ticks = ticks
                onTicks(ticks)
            }

            // The camera stays on the player: the focus eases over to them, and the camera moves by
            // the same amount so the angle and distance you've turned it to are kept. With a player to
            // follow, sliding the focus by hand would only fight that, so it's off. A level with no
            // player is left to be panned around.
            const player = state && Object.values(state.items).find(item => item.type === 'player')
            controls.enablePan = !player
            if (player) {
                const {x, z} = player.mesh.position
                const step = new THREE.Vector3(x, 0.6, z).sub(controls.target).multiplyScalar(snap ? 1 : Math.min(1, delta * 5))
                controls.target.add(step)
                camera.position.add(step)
                stuff.current.snap = false
            }

            // Tell the nearby window what's around the player, but only when that has changed
            const near = player ? nearbyItems(state, player, NEARBY_RADIUS) : []
            const nearKey = near.map(item => `${item.id}:${item.distance.toFixed(1)}`).join('|')
            if (nearKey !== stuff.current.nearKey) {
                stuff.current.nearKey = nearKey
                onNearby(near)
            }

            controls.target.x = THREE.MathUtils.clamp(controls.target.x, -limit, limit)
            controls.target.z = THREE.MathUtils.clamp(controls.target.z, -limit, limit)
            controls.update()
            renderer.render(scene, camera)
            frame = requestAnimationFrame(animate)
        })

        return () => {
            cancelAnimationFrame(frame)
            canvas.removeEventListener('pointerdown', onPointerDown)
            canvas.removeEventListener('pointerup', onPointerUp)
            canvas.removeEventListener('contextmenu', onContextMenu)
            observer.disconnect()
            controls.dispose()
            grid.dispose()
            renderer.dispose()
            mount.removeChild(renderer.domElement)
            stuff.current = null
        }
    }, [])

    // Put the chosen level on the grid, in its world's look
    useEffect(() => {
        const {scene, grid} = stuff.current

        const theme = worldOf(level.id)?.theme
        if (theme) {
            scene.background = new THREE.Color(theme.background)
            grid.setColors(...theme.tiles)
        }

        stuff.current.state = null
        try {
            const state = loadLevel(grid, level)
            stuff.current.state = state
            stuff.current.snap = true
            stuff.current.nearKey = null
            onStatus(checkLevel(level, state))
        }
        catch (err) {
            console.error(err)
            showToast?.(err.message)
        }
    }, [level, resets])

    return <div ref={mountRef} className="h-screen w-full overflow-hidden" />
}

// The level dropdown, grouped by world, and where the level stands
const LevelPanel = props => {
    const {levelId, onLevel, level, status} = props

    return (
        <div className="absolute left-4 top-4 w-72 rounded-lg bg-black/60 p-4 text-white shadow-lg backdrop-blur">
            <label className="block text-xs font-medium uppercase tracking-wide text-white/60">Level</label>
            <select
                value={levelId}
                onChange={e => onLevel(e.target.value)}
                className="mt-1 block w-full rounded-md border-0 bg-white/10 py-1.5 text-sm text-white focus:ring-2 focus:ring-white/40"
            >
                {WORLDS.map(world => (
                    <optgroup key={world.id} label={world.name} style={OPTION_STYLE}>
                        {world.levels.map(id => (
                            <option key={id} value={id} style={OPTION_STYLE}>{LEVELS[id].name}</option>
                        ))}
                    </optgroup>
                ))}
            </select>

            <p className="mt-3 text-sm text-white/80">{level.description}</p>

            {status &&
            <ul className="mt-3 space-y-1.5">
                {status.conditions.map(condition => (
                    <li key={condition.label} className="flex items-center gap-2 text-sm">
                        <CheckCircleIcon className={`h-4 w-4 shrink-0 ${condition.met ? 'text-emerald-400' : 'text-white/25'}`} />
                        <span className={condition.met ? 'text-white' : 'text-white/70'}>{condition.label}</span>
                    </li>
                ))}
            </ul>
            }

            {status?.complete &&
            <p className="mt-3 text-sm font-semibold text-emerald-400">Level complete</p>
            }
        </div>
    )
}

const MAX_OUTPUT_LINES = 300

const PROGRAMS_KEY = 'hackman_programs'

// The saved programs, or the one starter program if there are none (or they can't be read)
const loadPrograms = () => {
    try {
        const saved = JSON.parse(localStorage.getItem(PROGRAMS_KEY))
        if (saved && Array.isArray(saved.programs) && saved.programs.length > 0) {
            return saved
        }
    }
    catch (err) {
        // Nothing usable saved
    }
    return {programs: [{id: 'p1', name: 'Program 1', code: STARTER_CODE}], current: 'p1'}
}

const Game = props => {
    const {showToast} = props

    const [levelId, setLevelId] = useState(FIRST_LEVEL)
    const [status, setStatus] = useState(null)
    const [nearby, setNearby] = useState([])
    const [resets, setResets] = useState(0)          // goes up to load the level afresh
    const [output, setOutput] = useState([])

    // The player's programs, [{id, name, code}], and which one is open. They are kept in the browser's
    // localStorage so they are still there next visit.
    const [store, setStore] = useState(loadPrograms)
    const program = store.programs.find(p => p.id === store.current) ?? store.programs[0]
    const code = program.code
    const setCode = text => setStore(was => ({
        ...was,
        programs: was.programs.map(p => p.id === was.current ? {...p, code: text} : p),
    }))
    const selectProgram = id => setStore(was => ({...was, current: id}))
    const newProgram = () => setStore(was => {
        const id = `p${Date.now().toString(36)}`
        const number = Math.max(0, ...was.programs.map(p => Number(p.name.replace('Program ', '')) || 0)) + 1
        return {programs: [...was.programs, {id, name: `Program ${number}`, code: ''}], current: id}
    })
    useEffect(() => {
        try {
            localStorage.setItem(PROGRAMS_KEY, JSON.stringify(store))
        }
        catch (err) {
            // Storage unavailable: the programs just last until the page is closed
        }
    }, [store])

    // Where the game is: 'idle' (nothing run yet), 'running', 'paused' (stepping) or 'finished' (the
    // program ended), and how many game ticks it has run for
    const [phase, setPhase] = useState('idle')
    const [ticks, setTicks] = useState(0)
    const [line, setLine] = useState(null)           // the line of the code the program is on
    const level = LEVELS[levelId]

    const [clock] = useState(createClock)            // game time (see game/clock.js)
    const stateRef = useRef(() => null)              // the Scene fills this in: the loaded level
    const runRef = useRef(null)                      // the program running, so it can be stopped

    const log = (kind, text) => setOutput(lines => [...lines, {kind, text}].slice(-MAX_OUTPUT_LINES))

    // The scene reloads the level on the next render: this asks for that and waits until the new one is
    // there (or `run` is stopped)
    const reloadLevel = async run => {
        const before = stateRef.current()
        setResets(count => count + 1)
        for (let frames = 0; frames < 120 && !run.stopped; frames++) {
            const loaded = stateRef.current()
            if (loaded && loaded !== before) {
                break
            }
            await new Promise(resolve => requestAnimationFrame(resolve))
        }
    }

    // Interactive mode: you drive the robot with the arrow keys and the item windows, using the same robot
    // functions a program does. manualRef is {run, robot, busy, pending}: pending is one more action
    // waiting for the one in progress.
    const manualRef = useRef(null)
    const interactiveRef = useRef(null)
    const [busy, setBusy] = useState(false)
    const [info, setInfo] = useState(null)            // {data, at, key}: the window from a left click
    const [actions, setActions] = useState(null)      // the same, from a right click

    const stopInteractive = () => {
        manualRef.current?.run.stop()
        manualRef.current = null
        setBusy(false)
        setInfo(null)
        setActions(null)
    }

    // Does one robot function ('move', 'pickup'...), or lines it up after the one in progress
    const perform = async (call, args) => {
        const manual = manualRef.current
        if (!manual?.robot) {
            return
        }
        if (manual.busy) {
            manual.pending = [call, args]
            return
        }

        manual.busy = true
        setBusy(true)
        try {
            await manual.robot[call](...args)
        }
        catch (err) {
            if (manualRef.current === manual) {
                log('error', err.message)
            }
        }
        manual.busy = false
        if (manualRef.current !== manual) {
            return
        }
        setBusy(false)
        const next = manual.pending
        manual.pending = null
        if (next) {
            perform(...next)
        }
    }

    const interactive = async () => {
        if (phase === 'interactive') {
            restart()
            return
        }

        runRef.current?.stop()
        runRef.current = null
        stopInteractive()

        const run = createRun()
        const manual = {run, robot: null, busy: false, pending: null}
        manualRef.current = manual
        resetClock(clock)
        setTicks(0)
        setLine(null)
        setOutput([])
        setPhase('interactive')

        await reloadLevel(run)
        if (manualRef.current !== manual) {
            return
        }

        // Game time runs as it does in real time, and the robot's functions wait on it
        clock.counting = true
        clock.mode = 'live'
        clock.budget = 0
        try {
            manual.robot = createRobot(() => stateRef.current(), log, run, clock)
        }
        catch (err) {
            log('error', err.message)
        }
    }

    // A click on the scene (see Scene): left shows what the item is, right what can be done with it
    const pick = ({id, button, x, y}) => {
        const state = stateRef.current()
        const data = id && state ? lookAt(state, id) : null
        if (!data) {
            setInfo(null)
            setActions(null)
            return
        }

        const opened = {data, at: {x, y}, key: `${id}-${Date.now()}`}
        if (button === 0) {
            setInfo(opened)
        }
        else if (button === 2) {
            setActions(opened)
        }
    }
    interactiveRef.current = {active: phase === 'interactive', onPick: pick}

    // The arrow keys move the robot while interactive (unless typing somewhere)
    useEffect(() => {
        if (phase !== 'interactive') {
            return
        }

        const directions = {ArrowUp: 'n', ArrowRight: 'e', ArrowDown: 's', ArrowLeft: 'w'}
        const onKey = e => {
            const direction = directions[e.key]
            if (!direction || e.ctrlKey || e.metaKey || e.altKey || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
                return
            }
            e.preventDefault()

            // A held key repeats, but not faster than the robot can step
            if (e.repeat && manualRef.current?.busy) {
                return
            }
            perform('move', [direction])
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [phase])

    // Starts the level over and runs the program on it from the start: at full speed, or (when
    // `stepping`) paused with just the first tick allowed, for Step to carry on from
    const startProgram = async stepping => {
        stopInteractive()
        const run = createRun()
        runRef.current = run
        resetClock(clock)
        setTicks(0)
        setLine(null)
        setOutput([])
        setPhase(stepping ? 'paused' : 'running')

        // Python is loaded the first time it is needed, before the game starts counting
        if (!isBrythonReady()) {
            log('info', 'Loading Python...')
            try {
                await loadBrython()
            }
            catch (err) {
                log('error', err.message)
                if (runRef.current === run) {
                    runRef.current = null
                    setPhase('finished')
                }
                return
            }
        }

        await reloadLevel(run)

        if (!run.stopped) {
            clock.counting = true
            clock.mode = stepping ? 'step' : 'live'
            clock.budget = stepping ? TICK_SECONDS : 0
            await runPython(code, () => stateRef.current(), log, run, clock, lineNumber => {
                if (runRef.current === run) {
                    setLine(lineNumber)
                }
            })
        }

        // The program is over (unless a restart already ended this run): time stops being counted and the
        // scene carries on at normal speed
        if (runRef.current === run) {
            runRef.current = null
            clock.counting = false
            clock.mode = 'live'
            clock.budget = 0
            setLine(null)
            setPhase('finished')
        }
    }

    const run = () => {
        if (phase === 'paused') {
            clock.mode = 'live'
            clock.budget = 0
            setPhase('running')
        }
        else if (phase !== 'running') {
            startProgram(false)
        }
    }

    // One more tick. Running programs are paused by it, and from the start it begins one paused.
    const step = () => {
        if (phase === 'paused') {
            clock.budget += TICK_SECONDS
        }
        else if (phase === 'running') {
            clock.mode = 'step'
            clock.budget = TICK_SECONDS
            setPhase('paused')
        }
        else {
            startProgram(true)
        }
    }

    // Ends the program and puts the level back how it started
    const restart = () => {
        runRef.current?.stop()
        runRef.current = null
        stopInteractive()
        clock.counting = false
        resetClock(clock)
        setTicks(0)
        setLine(null)
        setPhase('idle')
        setOutput([])
        setResets(count => count + 1)
    }

    // A program belongs to the level it started on, so changing the level ends it
    const changeLevel = id => {
        restart()
        setLevelId(id)
    }

    return (
        <div className="relative">
            <Scene
                level={level} resets={resets} stateRef={stateRef} clock={clock} interactive={interactiveRef}
                onStatus={setStatus} onNearby={setNearby} onTicks={setTicks} showToast={showToast}
            />
            <LevelPanel levelId={levelId} onLevel={changeLevel} level={level} status={status} />
            <GameWindow phase={phase} ticks={ticks} line={line} onRun={run} onStep={step} onRestart={restart} onInteractive={interactive} />
            <CodeWindow
                programs={store.programs} currentId={program.id} onSelect={selectProgram} onNew={newProgram}
                code={code} onCode={setCode} onRun={run} currentLine={line} output={output} />
            <ManualWindow />
            <NearbyWindow items={nearby} />
            {info && <ItemInfoWindow key={info.key} info={info.data} at={info.at} onClose={() => setInfo(null)} />}
            {actions &&
            <ItemActionsWindow
                key={actions.key} info={actions.data} at={actions.at} busy={busy}
                onAct={(call, args) => {
                    perform(call, args)
                    setActions(null)
                }}
                onClose={() => setActions(null)}
            />
            }
        </div>
    )
}

export const Hackman = props => {
    const {showToast} = props

    return (
        <Routes>
            <Route path="*" element={<Game showToast={showToast} />} />
        </Routes>
    )
}
