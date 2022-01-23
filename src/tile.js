const PASSABLE_IGNORE = 0;
const PASSABLE_TRUE = 1;
const PASSABLE_FALSE = -1;

export class Tile {
    constructor(texture_name, passable = PASSABLE_IGNORE) {
        this.texture_name = texture_name;
        this.passable = passable;
    }

    get_textures() {
        return [this.texture_name];
    }

    update(stage, x, y, index) {}

    is_passable(was_passable) {
        if (this.passable === PASSABLE_TRUE) {
            return true;
        } else if (this.passable === PASSABLE_FALSE) {
            return false;
        } else {
            return was_passable;
        }
    }
}

export class Connected extends Tile {
    constructor(texture_name_on, texture_name_off, parts, connections, cables_underneath = true) {
        super(texture_name_on);

        this.texture_name_off = texture_name_off;
        this.texture_name_on = texture_name_on;

        this.network = null;
        this.active = false;
        this.parts = parts;
        this.connections = connections;
        this.cables_underneath = cables_underneath;
    }

    get_parts_textures() {
        let res = [];

        let bit = 1;
        let parts = this.network_active ? this.parts.slice(4, 8) : this.parts.slice(0, 4);
        for (let part of parts) {
            if (this.connections & bit) {
                res.push(part);
            }
            bit <<= 1;
        }

        return res;
    }

    get_textures() {
        let res = this.get_parts_textures();

        let texture_name = this.network_active ? this.texture_name_on : this.texture_name_off;
        if (this.cables_underneath) {
            res.push(texture_name);
        } else {
            res.unshift(texture_name);
        }

        return res;
    }

    get network_active() {
        return this.network?.active ?? false;
    }

    get is_input() {
        return false;
    }

    get is_output() {
        return false;
    }

    static from(template, connections = template.state) {
        return new Connected(
            template.texture_name_on,
            template.texture_name_off,
            template.parts,
            connections,
            template.cables_underneath
        );
    }
}

export class Button extends Connected {
    constructor(parts, connections) {
        super("button_down", "button_up", parts, connections);
    }

    get is_input() {
        return true;
    }

    update(stage, x, y) {
        this.active = false;
        for (let ant of stage.ants) {
            if (ant.x === x && ant.y === y) {
                this.active = true;
            }
        }
    }
}

export class Door extends Connected {
    constructor(parts, connections) {
        super("door_open", "door_closed", parts, connections);
    }

    get is_output() {
        return true;
    }

    is_passable(was_passable) {
        return this.network_active;
    }
}

const SPIKE_TEXTURES = [
    "spike_0",
    "spike_1",
    "spike_2"
];

export class Spike extends Tile {
    constructor(jammed = false) {
        super("spike", PASSABLE_TRUE);

        this.jammed = jammed;
    }

    get_textures(animation) {
        let res = ["spike"];
        if (animation >= 0.5) animation = 1.0 - animation;
        animation *= 2.0;

        let step = Math.ceil(animation * 4 - 2);
        if (this.jammed) step = Math.min(step, 0);

        if (step >= 0) {
            res.push(SPIKE_TEXTURES[step]);
        }

        if (this.jammed) res.push("spike_jam");

        return res;
    }
}

export function register_tile_textures(tilemap) {
    tilemap.add_texture("wall", {
        x: 0, y: 0,
        height: 3,
        dy: -2,
    });

    tilemap.add_texture("ground", {x: 2, y: 1});
    tilemap.add_texture("edge", {x: 2, y: 2});

    for (let dy = 0; dy <= 1; dy++) {
        let suffix = dy === 0 ? "" : "_on";
        tilemap.add_texture("cable_blue" + suffix, {x: 0, y: 14 + dy});
        tilemap.add_texture("cable_blue_up" + suffix, {x: 1, y: 14 + dy});
        tilemap.add_texture("cable_blue_right" + suffix, {x: 2, y: 14 + dy});
        tilemap.add_texture("cable_blue_down" + suffix, {x: 3, y: 14 + dy});
        tilemap.add_texture("cable_blue_left" + suffix, {x: 4, y: 14 + dy});
    }

    tilemap.add_texture("button_up", {x: 0, y: 5});
    tilemap.add_texture("button_down", {x: 1, y: 5});

    tilemap.add_texture("door_open", {x: 0, y: 3});
    tilemap.add_texture("door_closed", {x: 1, y: 3});

    tilemap.add_texture("spike", {x: 2, y: 5});
    tilemap.add_texture("spike_jam", {x: 6, y: 5});
    for (let n = 0; n < 3; n++) {
        tilemap.add_texture("spike_" + n, {x: 3 + n, y: 5});
    }
}

export const CABLE_BLUE = [
    "cable_blue_up",
    "cable_blue_right",
    "cable_blue_down",
    "cable_blue_left",
    "cable_blue_up_on",
    "cable_blue_right_on",
    "cable_blue_down_on",
    "cable_blue_left_on"
];

export const TILE_CABLE_BLUE = new Connected("cable_blue_on", "cable_blue", CABLE_BLUE, 0, false, false);

export const TILE_WALL = new Tile("wall", PASSABLE_FALSE);
export const TILE_EDGE = new Tile("edge", PASSABLE_FALSE);
export const TILE_GROUND = new Tile("ground", PASSABLE_TRUE);

export const TILES = new Map();

function tile_singleton(name, instance) {
    TILES.set(name, () => instance);
}

function tile_component(name, tile_class, parts) {
    TILES.set(name, (connections) => new tile_class(parts, connections));
}

tile_singleton("wall", TILE_WALL);
tile_singleton("edge", TILE_EDGE);
tile_singleton("ground", TILE_GROUND);

tile_component("button_blue", Button, CABLE_BLUE);
tile_component("door_blue", Door, CABLE_BLUE);

TILES.set("cable_blue", (connections) => Connected.from(TILE_CABLE_BLUE, connections));
TILES.set("spike", (jammed = false) => new Spike(jammed));

export default function tile(name, ...data) {
    if (TILES.has(name)) {
        return TILES.get(name)(...data);
    } else {
        return null;
    }
}

tile.register_tile_textures = register_tile_textures;
