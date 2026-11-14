// A world is a named set of levels with a look. The file name is the world's id (snake_case).
export const world = {
    id: 'tutorial',
    name: 'Tutorial',

    // How the scene looks while one of this world's levels is open
    theme: {
        background: '#10151c',
        tiles: ['#9fb4c7', '#8499ad'],
    },

    // Level ids (levels/), in the order they're played
    levels: ['first_steps', 'wall_maze'],
}
