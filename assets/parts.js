import * as THREE from 'three'

// The pieces assets are put together from. In all of them x / z is where the part's center is,
// measured from the middle of the asset's footprint, and y is where its bottom sits above the
// ground, so parts stack by adding heights.
export const material = color => new THREE.MeshStandardMaterial({color, roughness: 0.6})

export const box = (width, height, depth, color, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material(color))
    mesh.position.set(x, y + height / 2, z)
    return mesh
}

export const cylinder = (radiusTop, radiusBottom, height, color, x = 0, y = 0, z = 0, segments = 24) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material(color))
    mesh.position.set(x, y + height / 2, z)
    return mesh
}

export const sphere = (radius, color, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 14), material(color))
    mesh.position.set(x, y + radius, z)
    return mesh
}

// A ring (handles, glasses rims). Unlike the others, y is the ring's center. It is made standing
// up (a handle seen from the side); pass rotationX = Math.PI / 2 to lay it flat.
export const torus = (radius, tube, color, x = 0, y = 0, z = 0, rotationX = 0, rotationY = 0) => {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 10, 28), material(color))
    mesh.position.set(x, y, z)
    mesh.rotation.set(rotationX, rotationY, 0)
    return mesh
}

// Turns a part (or group of parts) around the up axis, in radians
export const yaw = (object, radians) => {
    object.rotation.y = radians
    return object
}

// Parts in one group, which is what an asset's build() returns
export const assemble = (...parts) => {
    const group = new THREE.Group()
    group.add(...parts)
    return group
}
