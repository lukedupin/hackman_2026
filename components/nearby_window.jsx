import React from 'react'
import {FloatingWindow} from './floating_window.jsx'
import {ITEM_TYPES} from '../game/items.js'
import {NEARBY_RADIUS} from '../game/level_runner.js'

// A window listing every game item within NEARBY_RADIUS blocks of the player, nearest first.
// `items` is [{id, type, on, distance}] from nearbyItems() in game/level_runner.js.
export const NearbyWindow = props => {
    const {items} = props

    return (
        <FloatingWindow
            title="Nearby"
            subtitle={`within ${NEARBY_RADIUS} blocks`}
            place={{right: 16, bottom: 16, width: 300, height: 300}}
        >
            <div className="min-w-0 flex-1 overflow-y-auto">
                {items.length === 0 &&
                <p className="p-3 text-sm text-white/50">Nothing within {NEARBY_RADIUS} blocks.</p>
                }

                <ul className="divide-y divide-white/5">
                    {items.map(item => (
                        <li key={item.id} className="flex items-baseline justify-between gap-3 px-3 py-1.5 text-sm">
                            <span className="min-w-0 truncate">
                                {ITEM_TYPES[item.type].label}
                                {item.on && <span className="text-white/40"> on {ITEM_TYPES[item.on].label.toLowerCase()}</span>}
                            </span>
                            <span className="shrink-0 font-mono text-xs text-white/50">{item.distance.toFixed(1)}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </FloatingWindow>
    )
}
