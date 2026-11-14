import {person} from './person.js'

// Someone sitting with both hands out, typing. Put them `on` a chair or stool, facing the same way,
// with a laptop turned toward them on the table or bar in front.
export const asset = {
    label: 'Person sitting typing',
    footprint: [1, 1],
    placement: 'surface',
    build: options => person('sitting', 'typing', options),
}
