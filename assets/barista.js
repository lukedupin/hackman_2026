import {person} from './person.js'

// Someone standing in an apron with both hands out, working at the bar
export const asset = {
    label: 'Barista',
    footprint: [1, 1],
    build: options => person('standing', 'working', options),
}
