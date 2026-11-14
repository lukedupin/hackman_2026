import * as THREE from 'three'
import {box, cylinder, sphere, assemble} from './parts.js'

// The player: a dilapidated android, hunched and tilted, one eye dead and the other flickering, an
// arm broken off at the elbow, the chest hatch hanging open on its wires, an antenna bent over, and
// a clown mask dangling from one corner of its face. It smokes from its head and chest.
//
// It faces +z at rotate 0. The mesh has `userData.animate(time)` (see updateLevel): the smoke rises
// in puffs, the eye flickers, the head twitches and the loose parts sway.
const METAL = '#7d8791'
const DARK_METAL = '#4a4f55'
const BLACK = '#1b1c1f'
const RUST = '#8a4b2a'

const STEP_SECONDS = 0.75   // how long one of the robot's steps takes (TICK_SECONDS in game/robot.js)

// Emissive material on a mesh, so an eye or lamp glows
const glow = (mesh, color, intensity = 1) => {
    mesh.material.emissive = new THREE.Color(color)
    mesh.material.emissiveIntensity = intensity
    return mesh
}

// A thin wire (or rod) standing from a point, then tipped over: `rx` / `rz` turn it about its middle
const wire = (color, length, x, y, z, rx = 0, rz = 0) => {
    const mesh = cylinder(0.009, 0.009, length, color, x, y, z, 6)
    mesh.rotation.set(rx, 0, rz)
    return mesh
}

// A group at (x, y, z) turned by (rx, ry, rz), so what is added to it swings from that point
const pivot = (x, y, z, rx = 0, ry = 0, rz = 0) => {
    const group = new THREE.Group()
    group.position.set(x, y, z)
    group.rotation.set(rx, ry, rz)
    return group
}

// The clown mask. Its origin is the corner it is still fixed by; the rest hangs down and to the
// right of that, so it dangles diamond-wise with its lower end swung out from the face.
const buildMask = () => {
    const mask = pivot(0, 0, 0)
    const eye = x => {
        const diamond = box(0.05, 0.05, 0.006, '#1d3a8a', x, -0.125, 0.0125)
        diamond.rotation.z = Math.PI / 4
        return diamond
    }

    mask.add(
        box(0.26, 0.3, 0.025, '#f2efe6', 0.13, -0.3),
        eye(0.07), eye(0.19),
        sphere(0.036, '#d6211f', 0.13, -0.205, 0.03),
        box(0.14, 0.03, 0.006, '#c0172b', 0.13, -0.27, 0.0125),
        sphere(0.05, '#e8641e', 0.27, -0.12),
        sphere(0.045, '#e8641e', -0.02, -0.22),
        box(0.035, 0.035, 0.035, BLACK, 0, -0.02, 0),
    )
    return mask
}

// Puffs of smoke from one point: each rises, grows and fades, one after another
const buildSmoke = (count, x, y, z, rise, drift) => {
    const group = pivot(x, y, z)
    const puffs = []
    for (let i = 0; i < count; i++) {
        const puff = new THREE.Mesh(
            new THREE.SphereGeometry(0.06, 10, 8),
            new THREE.MeshStandardMaterial({color: '#4a4a4e', roughness: 1, transparent: true, depthWrite: false}),
        )
        group.add(puff)
        puffs.push(puff)
    }

    // `rate` is how many puffs' worth of the loop go by per second
    const update = (t, rate) => {
        puffs.forEach((puff, i) => {
            const age = (t * rate + i / count) % 1
            puff.position.set(Math.sin(i * 2.1 + age * 3) * 0.05 * age + drift * age, age * rise, Math.cos(i * 1.7) * 0.04 * age)
            puff.scale.setScalar(0.5 + age * 2.2)
            puff.material.opacity = 0.55 * (1 - age) * Math.min(1, age * 6)
        })
    }
    return {group, update}
}

export const asset = {
    label: 'Player (android)',
    footprint: [1, 1],
    build: () => {
        // Legs: one whole, one with a bent, rusted lower half
        // Each leg hangs from a hip pivot (y 0.76 above the ground) so it can swing when walking
        const rightHip = pivot(0.1, 0.76, 0)
        rightHip.add(
            box(0.12, 0.3, 0.12, METAL, 0, -0.3),
            box(0.14, 0.14, 0.14, DARK_METAL, 0, -0.42),
            box(0.11, 0.3, 0.11, METAL, 0, -0.7),
            box(0.15, 0.06, 0.24, BLACK, 0, -0.76, 0.04),
        )
        const leftHip = pivot(-0.1, 0.76, 0)
        const leftLeg = pivot(0, -0.3, 0, 0, 0, 0.2)
        leftLeg.add(
            box(0.11, 0.4, 0.11, RUST, 0, -0.4),
            box(0.15, 0.06, 0.24, BLACK, 0, -0.46, 0.04),
            wire('#d9b43a', 0.14, 0.06, -0.12, 0.05, 0.3, 0.2),
        )
        leftHip.add(box(0.12, 0.3, 0.12, METAL, 0, -0.3), leftLeg)

        // Everything above the hips leans forward a little, as if hunched
        const upper = pivot(0, 0.76, 0, 0.12, 0, 0.05)

        upper.add(
            box(0.42, 0.5, 0.26, METAL),
            box(0.1, 0.1, 0.012, RUST, 0.1, 0.3, 0.131),
            box(0.14, 0.06, 0.012, RUST, -0.12, 0.4, 0.131),
            box(0.22, 0.24, 0.01, BLACK, -0.04, 0.08, 0.131),
            cylinder(0.05, 0.05, 0.1, DARK_METAL, 0, 0.5),
            wire('#d33a2f', 0.2, -0.08, 0.14, 0.2, 1.1, 0.2),
            wire('#3a7bd9', 0.18, 0.0, 0.1, 0.2, 1.0, -0.3),
            wire('#d9b43a', 0.22, 0.05, 0.16, 0.2, 1.3, 0.1),
        )

        // The chest hatch, swung open on its left edge
        const hatch = pivot(-0.15, 0, 0.135, 0, -1.0, 0)
        hatch.add(box(0.22, 0.24, 0.02, DARK_METAL, 0.11, -0.04))
        hatch.position.y = 0.2
        upper.add(hatch)

        // The right arm is whole; the left breaks off below the elbow, wires hanging from the stump
        const rightArm = pivot(0.3, 0.45, 0, -0.2)
        rightArm.add(
            sphere(0.07, DARK_METAL, 0, -0.07),
            box(0.09, 0.28, 0.09, METAL, 0, -0.28),
        )
        const rightElbow = pivot(0, -0.28, 0, -0.4)
        rightElbow.add(
            box(0.08, 0.26, 0.08, METAL, 0, -0.26),
            box(0.1, 0.07, 0.05, BLACK, 0, -0.33),
        )
        rightArm.add(rightElbow)

        const leftArm = pivot(-0.3, 0.45, 0, 0.1, 0, 0.3)
        leftArm.add(
            sphere(0.07, DARK_METAL, 0, -0.07),
            box(0.09, 0.28, 0.09, RUST, 0, -0.28),
            cylinder(0.035, 0.03, 0.08, BLACK, 0, -0.36),
            wire('#d33a2f', 0.2, 0.01, -0.45, 0, 0, 0.15),
            wire('#d9b43a', 0.16, -0.02, -0.42, 0.01, 0, -0.2),
        )
        upper.add(rightArm, leftArm)

        // The head tilts on its neck. One eye glows, one is dead.
        const head = pivot(0, 0.6, 0.02, 0, 0, 0.18)
        const eye = glow(sphere(0.04, '#ffb13b', 0.08, 0.13, 0.14), '#ff9a1f')
        head.add(
            box(0.3, 0.28, 0.27, '#8a949e'),
            box(0.07, 0.04, 0.05, BLACK, -0.05, 0.28, 0),
            box(0.04, 0.12, 0.012, RUST, 0.15, 0.1, 0.05),
            eye,
            sphere(0.036, BLACK, -0.08, 0.13, 0.14),
        )

        // The antenna is bent over, its tip a lamp that fails now and then
        const antenna = pivot(0.1, 0.28, 0, 0, 0, -0.9)
        antenna.add(cylinder(0.01, 0.01, 0.2, '#aab0b6', 0, 0, 0, 6))
        const lamp = glow(sphere(0.022, '#d6211f', 0, 0.2), '#ff2a1f')
        antenna.add(lamp)
        head.add(antenna)

        // The mask hangs by its top-left corner, off the front of the face
        const mask = buildMask()
        mask.position.set(-0.14, 0.27, 0.14)
        head.add(mask)
        upper.add(head)

        // Smoke is in the world, not in the leaning body, so it goes straight up
        const headSmoke = buildSmoke(6, -0.03, 1.58, 0.02, 0.9, 0.12)
        const chestSmoke = buildSmoke(5, -0.04, 1.0, 0.16, 0.7, 0.1)

        const group = assemble(rightHip, leftHip, upper, headSmoke.group, chestSmoke.group)

        // How much it is walking, from 0 (standing) to 1, eased so the stride starts and stops smoothly
        let walking = 0
        let lastT = 0

        group.userData.animate = (t, moving = false) => {
            const dt = Math.max(0, Math.min(t - lastT, 0.1))
            lastT = t
            walking += ((moving ? 1 : 0) - walking) * Math.min(1, dt * (moving ? 10 : 5))

            // One step is 0.75 seconds, so a full stride (two steps) is a second and a half: a half turn
            // of the sine for each step. The arms swing against the legs, and the body leans into it.
            const stride = Math.sin(t * Math.PI / STEP_SECONDS) * walking
            rightHip.rotation.x = -0.5 * stride
            leftHip.rotation.x = 0.5 * stride
            rightArm.rotation.x = -0.2 + 0.45 * stride
            leftArm.rotation.x = 0.1 - 0.35 * stride
            rightElbow.rotation.x = -0.4 - 0.2 * walking * (1 + Math.sin(t * Math.PI / STEP_SECONDS))

            headSmoke.update(t, 0.35)
            chestSmoke.update(t + 0.5, 0.28)

            // Twitches in short bursts, and the live eye drops out for a moment now and then
            const burst = Math.max(0, Math.sin(t * 0.8)) ** 20
            head.rotation.y = 0.15 * burst * Math.sin(t * 40)
            head.rotation.z = 0.18 + 0.03 * Math.sin(t * 1.3)
            eye.material.emissiveIntensity = Math.sin(t * 7.3) * Math.sin(t * 2.9) > 0.75 ? 0.05 : 1.2
            lamp.material.emissiveIntensity = Math.sin(t * 3) > 0 ? 1.5 : 0.1

            // Loose parts sway
            mask.rotation.set(-0.55 + 0.05 * Math.sin(t * 2.3 + 1), 0, -0.7 + 0.05 * Math.sin(t * 1.9))
            leftArm.rotation.z = 0.3 + 0.04 * Math.sin(t * 1.7)
            hatch.rotation.y = -1.0 + 0.06 * Math.sin(t * 2.1)
            upper.rotation.x = 0.12 + 0.1 * walking + 0.012 * Math.sin(t * 1.1)
        }
        group.userData.animate(0)

        return group
    },
}
