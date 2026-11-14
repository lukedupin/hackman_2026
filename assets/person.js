import * as THREE from 'three'
import {box, sphere, assemble} from './parts.js'

// Builds the people assets (sitter_phone, walker, barista, ...) so they share one body. Not an asset
// itself. A person faces +z at rotate 0, is about 1.6 tall standing, and is built from:
//
//   pose      'sitting' (bottom of the build is the seat, put the person `on` a chair or stool),
//             'standing' or 'walking' (bottom of the build is the floor)
//   activity  what the arms are doing: 'none', 'phone' (right hand holds a phone up), 'typing'
//             (both hands out in front, for a laptop) or 'working' (both hands out, apron on)
//   options   how this one looks, from the level's item: {skin, shirt, pants, hair}, all optional
//
// Everyone is white by default. The mesh has `userData.animate(time)`, which poses the person for
// that many seconds into their loop: legs and arms swinging for a walker, hands tapping for a typist,
// head glancing around for a barista. updateLevel() calls it every frame.
const DEFAULTS = {skin: '#f4f4f4', shirt: '#fbfbfb', pants: '#e6e6e8', hair: '#cfcfd4', apron: '#c4c8ce'}
const SHOES = '#bdbdc4'
const PHONE = '#15151a'

const GAIT = 5   // radians per second of a walker's stride, which suits the default walking speed

// A group that sits at (x, y, z) and turns about x, so whatever hangs below it swings. A negative
// angle swings it forward (+z), a positive one back.
const pivot = (x, y, z, angle = 0) => {
    const group = new THREE.Group()
    group.position.set(x, y, z)
    group.rotation.x = angle
    return group
}

// An arm hanging from the shoulder. `upper` is how far the upper arm swings from straight down and
// `fore` how much more the forearm bends at the elbow, both as in pivot(). The shoulder keeps its
// elbow in userData so the arm can be posed later with poseArm().
const arm = (colors, x, y, z, phone = false) => {
    const shoulder = pivot(x, y, z)
    shoulder.add(box(0.09, 0.3, 0.09, colors.shirt, 0, -0.3))

    const elbow = pivot(0, -0.3, 0)
    elbow.add(box(0.08, 0.28, 0.08, colors.skin, 0, -0.28))
    elbow.add(sphere(0.045, colors.skin, 0, -0.33))
    if (phone) {
        elbow.add(box(0.07, 0.12, 0.012, PHONE, 0, -0.36, 0.05))
    }

    shoulder.add(elbow)
    shoulder.userData.elbow = elbow
    return shoulder
}

const poseArm = (shoulder, upper, fore) => {
    shoulder.rotation.x = upper
    shoulder.userData.elbow.rotation.x = fore
}

// A leg that swings from the hip, `top` high above the floor
const leg = (colors, x, top) => {
    const hip = pivot(x, top, 0)
    hip.add(box(0.12, top, 0.12, colors.pants, 0, -top))
    hip.add(box(0.13, 0.06, 0.2, SHOES, 0, -top, 0.04))
    return hip
}

// [upper, fore] angles where an arm rests for this pose and activity
const armAngles = (pose, activity) => {
    if (activity === 'typing') {
        return {left: [-0.55, -1.2], right: [-0.55, -1.2]}
    }
    if (activity === 'working') {
        return {left: [-0.6, -0.7], right: [-0.6, -0.7]}
    }

    const rest = {sitting: [-0.5, -1.0], standing: [0.05, -0.15], walking: [0, -0.2]}[pose]
    return {left: rest, right: activity === 'phone' ? [-0.9, -1.2] : rest}
}

export const person = (pose, activity, options = {}) => {
    const colors = {...DEFAULTS, ...options}
    const body = new THREE.Group()
    const parts = []
    const legs = []
    let shoulderY, shoulderZ, headBottom

    if (pose === 'sitting') {
        for (const side of [-1, 1]) {
            parts.push(
                box(0.12, 0.13, 0.4, colors.pants, side * 0.09, 0, 0.18),
                box(0.11, 0.63, 0.11, colors.pants, side * 0.09, -0.5, 0.33),
                box(0.13, 0.06, 0.2, SHOES, side * 0.09, -0.5, 0.37),
            )
        }
        parts.push(box(0.36, 0.52, 0.2, colors.shirt, 0, 0.05, -0.05))
        shoulderY = 0.52
        shoulderZ = -0.05
        headBottom = 0.6
    }
    else {
        legs.push(leg(colors, -0.09, 0.8), leg(colors, 0.09, 0.8))
        parts.push(...legs, box(0.36, 0.55, 0.2, colors.shirt, 0, 0.8))
        shoulderY = 1.3
        shoulderZ = 0
        headBottom = 1.4
    }

    // The head turns and nods about the neck, so it is a group whose origin is there
    const neckY = headBottom - 0.05
    const head = pivot(0, neckY, 0)
    head.add(
        sphere(0.11, colors.skin, 0, 0.05),
        sphere(0.118, colors.hair, 0, 0.07, -0.025),
    )
    parts.push(box(0.07, 0.08, 0.07, colors.skin, 0, neckY), head)

    if (activity === 'working') {
        parts.push(box(0.37, 0.4, 0.012, colors.apron, 0, neckY - 0.5, shoulderZ + 0.106))
    }

    const left = arm(colors, -0.23, shoulderY, shoulderZ)
    const right = arm(colors, 0.23, shoulderY, shoulderZ, activity === 'phone')
    parts.push(left, right)

    body.add(...parts)

    // Poses everything for a moment `t` seconds into the loop
    const rest = armAngles(pose, activity)
    const animate = t => {
        let [leftUpper, leftFore] = rest.left
        let [rightUpper, rightFore] = rest.right
        let nod = 0
        let turn = 0

        if (pose === 'walking') {
            const stride = Math.sin(t * GAIT)
            legs[0].rotation.x = -0.4 * stride
            legs[1].rotation.x = 0.4 * stride
            leftUpper = 0.45 * stride
            if (activity !== 'phone') {
                rightUpper = -0.45 * stride
            }
            body.position.y = 0.025 * Math.abs(Math.cos(t * GAIT))   // up and down a little with each step
            nod = activity === 'phone' ? 0.3 : 0
        }
        else if (activity === 'phone') {
            // Head down at the screen, now and then a look up around the room, a thumb scrolling
            nod = 0.3 - 0.25 * Math.max(0, Math.sin(t * 0.35)) ** 3
            turn = 0.4 * Math.sin(t * 0.35) * Math.max(0, Math.sin(t * 0.35))
            rightFore += 0.08 * Math.sin(t * 2.2)
        }
        else if (activity === 'typing') {
            // Both hands going, taking turns
            nod = 0.25
            leftFore += 0.1 * Math.sin(t * 9)
            rightFore += 0.1 * Math.sin(t * 9 + Math.PI)
            leftUpper += 0.04 * Math.sin(t * 9)
            rightUpper += 0.04 * Math.sin(t * 9 + Math.PI)
            turn = 0.15 * Math.sin(t * 0.3)
        }
        else if (activity === 'working') {
            // Reaching about the bar, looking toward the customers and back
            leftUpper += 0.25 * Math.sin(t * 1.3)
            leftFore += 0.2 * Math.sin(t * 1.3 + 1)
            rightUpper += 0.25 * Math.sin(t * 1.3 + Math.PI)
            rightFore += 0.2 * Math.sin(t * 1.3 + 1 + Math.PI)
            turn = 0.5 * Math.sin(t * 0.7)
            nod = 0.15
        }

        poseArm(left, leftUpper, leftFore)
        poseArm(right, rightUpper, rightFore)
        head.rotation.x = nod
        head.rotation.y = turn
    }

    const group = assemble(body)
    group.userData.animate = animate
    animate(0)
    return group
}
