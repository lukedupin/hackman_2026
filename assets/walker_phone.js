import {person} from './person.js'

// Someone mid-stride with their eyes on their phone, on the ground
export const asset = {
    label: 'Person walking with a phone',
    footprint: [1, 1],
    build: options => person('walking', 'phone', options),
}
