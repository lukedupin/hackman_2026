import {person} from './person.js'

// Someone mid-stride, on the ground
export const asset = {
    label: 'Person walking',
    footprint: [1, 1],
    build: options => person('walking', 'none', options),
}
