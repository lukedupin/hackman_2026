import {speak} from './speech.js'
import {sendAway} from './leaving.js'

// What people do when something happens to them. The logic itself is in the level: each person lists
// `rules` (see levels/index.js), and the game only says when an event has happened.
//
//   rules: [{when: 'spoken_to', say: ['Hello!', 'Hi.'], leave: true}, ...]
//
// `when` is one of EVENTS below. `say` is a line, or a list to pick one from at random, shown in a speech
// bubble over their head. `leave` makes them get up (if they are sitting) and walk out of the level by its
// exit. A person with no rule for an event does nothing about it.
export const EVENTS = {
    spoken_to: 'the robot said something to them',
    splashed: 'the robot spilled a drink next to them',
    item_grabbed: 'the robot tried to take something of theirs while they were right there',
}

// Checks a level item's rules, throwing a message that says what is wrong with them
export const checkRules = (levelId, itemId, rules) => {
    const where = `Level '${levelId}', item '${itemId}'`
    if (!Array.isArray(rules)) {
        throw new Error(`${where}: rules has to be a list`)
    }
    for (const rule of rules) {
        if (!(rule.when in EVENTS)) {
            throw new Error(`${where}: unknown rule event '${rule.when}'. Known events: ${Object.keys(EVENTS).join(', ')}`)
        }
        const lines = [].concat(rule.say ?? [])
        if (lines.some(line => typeof line !== 'string')) {
            throw new Error(`${where}: the 'say' of the '${rule.when}' rule has to be text, or a list of text`)
        }
    }
}

// Runs the person's rule for an event. Gives back null if they have none, or {said, left}: the line they
// said (or null), and whether they are now leaving.
export const fire = (state, person, event) => {
    if (person.gone) {
        return null
    }
    const rule = person.rules.find(candidate => candidate.when === event)
    if (!rule) {
        return null
    }

    const lines = [].concat(rule.say ?? [])
    const said = lines.length > 0 ? lines[Math.floor(Math.random() * lines.length)] : null

    let left = false
    if (rule.leave) {
        left = sendAway(state, person, said)
    }
    if (said !== null && !left) {
        speak(state, person, said)
    }
    return {said, left}
}
