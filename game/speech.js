import * as THREE from 'three'

// Speech bubbles over people's heads. speak() puts one over an item, and updateBubbles() (called every
// frame by updateLevel) ages them and takes them down again. The bubbles live in `state.bubbles`.
const SHOW_SECONDS = 3.5
const FADE_SECONDS = 0.5
const PIXELS_PER_BLOCK = 220
const FONT = 'bold 28px sans-serif'
const MAX_LINE_WIDTH = 300
const LINE_HEIGHT = 36
const PADDING = 20
const TAIL = 16

// The bubble as a picture: a white rounded box with the text wrapped inside, and a tail underneath
const draw = text => {
    const canvas = document.createElement('canvas')
    let ctx = canvas.getContext('2d')
    ctx.font = FONT

    const lines = []
    let line = ''
    for (const word of text.split(' ')) {
        const attempt = line ? `${line} ${word}` : word
        if (line && ctx.measureText(attempt).width > MAX_LINE_WIDTH) {
            lines.push(line)
            line = word
        }
        else {
            line = attempt
        }
    }
    lines.push(line)

    const width = Math.ceil(Math.max(...lines.map(l => ctx.measureText(l).width))) + PADDING * 2
    const boxHeight = lines.length * LINE_HEIGHT + PADDING * 2
    canvas.width = width
    canvas.height = boxHeight + TAIL

    // Resizing the canvas clears its settings
    ctx = canvas.getContext('2d')
    ctx.font = FONT
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = '#1b1c1f'
    ctx.lineWidth = 4

    ctx.beginPath()
    ctx.roundRect(2, 2, width - 4, boxHeight - 4, 18)
    ctx.moveTo(width / 2 - 14, boxHeight - 4)
    ctx.lineTo(width / 2, boxHeight + TAIL - 2)
    ctx.lineTo(width / 2 + 14, boxHeight - 4)
    ctx.fill()
    ctx.stroke()

    // The join between the tail and the box
    ctx.fillRect(width / 2 - 12, boxHeight - 7, 24, 5)

    ctx.fillStyle = '#1b1c1f'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    lines.forEach((l, i) => ctx.fillText(l, width / 2, PADDING + LINE_HEIGHT * (i + 0.5)))

    return {canvas, width, height: canvas.height}
}

const remove = bubble => {
    bubble.sprite.parent?.remove(bubble.sprite)
    bubble.sprite.material.map.dispose()
    bubble.sprite.material.dispose()
}

// Puts a speech bubble saying `text` over `item` (replacing one it already has). Does nothing where
// there is no document to draw on, as when the game is tested without a browser.
export const speak = (state, item, text) => {
    if (typeof document === 'undefined') {
        return
    }

    for (const old of state.bubbles.filter(bubble => bubble.item === item)) {
        remove(old)
    }
    state.bubbles = state.bubbles.filter(bubble => bubble.item !== item)

    const {canvas, width, height} = draw(text)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace

    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map: texture, transparent: true, depthTest: false}))
    sprite.scale.set(width / PIXELS_PER_BLOCK, height / PIXELS_PER_BLOCK, 1)
    sprite.center.set(0.5, 0)       // the tail's tip is where it is placed
    sprite.renderOrder = 10

    // Just over the top of the item, wherever it stands or sits
    const top = new THREE.Box3().setFromObject(item.mesh).max.y - item.mesh.position.y
    sprite.position.set(0, top + 0.1, 0)
    item.mesh.add(sprite)

    state.bubbles.push({item, sprite, age: 0})
}

export const updateBubbles = (state, delta) => {
    state.bubbles = state.bubbles.filter(bubble => {
        bubble.age += delta
        const left = SHOW_SECONDS - bubble.age
        if (left <= 0) {
            remove(bubble)
            return false
        }
        bubble.sprite.material.opacity = Math.min(1, left / FADE_SECONDS)
        return true
    })
}
