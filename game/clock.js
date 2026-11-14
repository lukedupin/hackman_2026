// The game's clock. Everything the program does is measured in ticks, and a tick is 0.75 seconds of game
// time: a step takes one tick, so does every other action, and wait(n) takes n.
//
// Game time normally runs along with real time. In `step` mode it only moves when it is given some
// (see `budget`), which is what the Step button does: it hands the game one more tick.
//
//   clock = {
//       time        seconds of game time since the program started
//       counting    whether time is being counted (while a program is running)
//       mode        'live' (time follows real time), 'step' (only moves as far as `budget` allows) or
//                   'fast' (runs ahead of real time to the next thing waited for, to catch up quickly)
//       budget      in step mode, the seconds of game time still to play
//       waiters     what is waiting on the clock: {at, resolve}
//   }
export const TICK_SECONDS = 0.75

const EPSILON = 1e-6   // so that adding up many small frame times still reaches a whole tick

export const createClock = () => ({time: 0, counting: false, mode: 'live', budget: 0, waiters: []})

// Back to the start: no time, nothing counting, nothing waiting
export const resetClock = clock => {
    clock.time = 0
    clock.counting = false
    clock.mode = 'live'
    clock.budget = 0
    clock.waiters = []
}

// The whole ticks the game has been running for
export const ticksOf = clock => Math.floor(clock.time / TICK_SECONDS + EPSILON)

// The most game time that fast mode plays in one frame
const FAST_FRAME_SECONDS = 3

// How much game time passes in a frame of `delta` real seconds: all of it, except in step mode where
// it is only what is left of the budget, and in fast mode where it is as far as the next thing the
// program is waiting for (real time is ignored). The program only acts when a wait ends, so going no
// further than that lets it act at the same game times as in real time, just sooner; with nothing being
// waited for, the game holds still until the program asks for something.
export const gameDeltaOf = (clock, delta) => {
    if (clock.mode === 'fast') {
        if (clock.waiters.length === 0) {
            return 0
        }
        const next = Math.min(...clock.waiters.map(waiter => waiter.at))
        return Math.min(Math.max(next - clock.time, 0), FAST_FRAME_SECONDS)
    }
    if (clock.mode !== 'step') {
        return delta
    }
    const played = Math.min(delta, clock.budget)
    clock.budget -= played
    return played
}

// Moves game time on, letting through whatever was waiting for it
export const advanceClock = (clock, delta) => {
    clock.time += delta

    const due = clock.waiters.filter(waiter => waiter.at <= clock.time + EPSILON)
    if (due.length > 0) {
        clock.waiters = clock.waiters.filter(waiter => !due.includes(waiter))
        due.forEach(waiter => waiter.resolve())
    }
}

// A promise for when `ticks` ticks of game time have gone by
export const waitTicks = (clock, ticks) => new Promise(resolve => {
    clock.waiters.push({at: clock.time + ticks * TICK_SECONDS, resolve})
})
