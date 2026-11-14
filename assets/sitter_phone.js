import {person} from './person.js'

// Someone sitting, looking at their phone. Put them `on` a chair or stool, facing the same way.
// Look is set on the level's item: {skin, shirt, pants, hair}.
export const asset = {
    label: 'Person sitting with a phone',
    footprint: [1, 1],
    placement: 'surface',
    build: options => person('sitting', 'phone', options),
}
