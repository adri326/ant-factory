

export const ITEM_TEXTURES = new Map();

export function register_item_textures(tilemap) {
    let positions = {
        "item_pipe": [15, 8],
        "item_spring": [15, 9],
        "item_gear": [15, 10],
        "item_gearbox": [15, 11],
        "item_circuit": [15, 12],
        "item_lens": [15, 13],
        "item_sensor": [15, 14],
        "item_processor": [15, 15],
        "item_piston": [14, 13],
        "item_motor": [13, 13],
        "item_ant_head": [12, 13],
        "item_ant_back": [11, 13],
        "item_ant_middle": [10, 13],
        "item_ant": [9, 13],
    };

    for (let name in positions) {
        tilemap.add_texture(name, {x: positions[name][0], y: positions[name][1]});

        ITEM_TEXTURES.set(name.slice(5), name);
    }
}
