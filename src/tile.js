import {ITEM_TEXTURES} from "./item.js";

const PASSABLE_IGNORE = 0;
const PASSABLE_TRUE = 1;
const PASSABLE_FALSE = -1;

export const DIRECTION_NAMES = [
    "up",
    "right",
    "down",
    "left"
];

export const DIRECTIONS = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0]
];

export class Tile {
    constructor(texture_name, passable = PASSABLE_IGNORE) {
        this.texture_name = texture_name;
        this.passable = passable;
    }

    get_textures() {
        return [this.texture_name];
    }

    draw(ctx, tilemap, vx, vy, tile_size, animation, last_tick) {
        for (let texture of this.get_textures(animation, last_tick)) {
            tilemap.draw(ctx, texture, vx, vy, tile_size, animation);
        }
    }

    get_overlay_textures() {
        return [];
    }

    draw_overlay(ctx, tilemap, vx, vy, tile_size, animation, last_tick) {
        for (let texture of this.get_overlay_textures(animation, last_tick)) {
            tilemap.draw(ctx, texture, vx, vy, tile_size, animation);
        }
    }

    update(stage, x, y, index) {}

    cleanup(stage, x, y, index) {}

    is_passable(was_passable) {
        if (this.passable === PASSABLE_TRUE) {
            return true;
        } else if (this.passable === PASSABLE_FALSE) {
            return false;
        } else {
            return was_passable;
        }
    }

    handle_laser(orientation) {
        return [orientation, true];
    }

    accepts_item(dx, dy) {
        return false;
    }

    give_item(item, dx, dy) {}
}

export class LaserBlocker extends Tile {
    handle_laser(orientation) {
        return [-1, false];
    }
}

export class Connected extends Tile {
    constructor(texture_name_on, texture_name_off, parts, connections, cables_underneath = true, passable = PASSABLE_IGNORE) {
        super(texture_name_on, passable);

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
            template.cables_underneath,
            template.passable
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

export class Passage extends Tile {
    constructor(open) {
        super("passage_closed");
        this._open = open;
    }

    get open() {
        let open = this._open;
        if (typeof this._open === "string") {
            let [level, x, y] = this._open.split("/");

            // This is bad but ssshhh
            let stage = window.LEVELS.get(level);
            if (stage) {
                open = true;
                for (let tile of stage.tiles.get(+x, +y)) {
                    open = tile.is_passable(open);
                }
            } else {
                open = false;
            }
        }
        return open;
    }

    get_textures() {
        if (this.open) {
            return ["passage", "passage_open"];
        } else {
            return ["passage", "passage_closed"];
        }
    }

    is_passable(was_passable) {
        if (this.open) return was_passable;
        else return false;
    }
}

export class And extends Connected {
    constructor(parts, connections) {
        super("and_on", "and_off", parts, connections);
    }

    get is_input() {
        return true;
    }

    update(stage, x, y) {
        this.active = true;
        for (let tile of stage.tiles.get(x, y)) {
            if (tile === this) continue;
            if (tile instanceof Connected) {
                this.active = this.active && tile.network_active;
            }
        }
    }
}

export class RSLatch extends Connected {
    constructor(parts, connections, state = false) {
        super("rs_on", "rs_off", parts, connections);
        this.active = state;
    }

    get is_input() {
        return true;
    }

    update(stage, x, y) {
        for (let tile of stage.tiles.get(x, y)) {
            if (tile === this) continue;
            if (tile instanceof Connected && tile.network_active) {
                console.log(tile);
                if (tile.connections & 0b1000) this.active = false; // R
                if (tile.connections & 0b0010) this.active = true; // S
            }
        }
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

const LASER_MACHINE = [
    "laser_machine_right",
    "laser_machine_left",
    "laser_machine_down",
    "laser_machine_right_on",
    "laser_machine_left_on",
    "laser_machine_down_on",
    "laser_machine_right_low",
    "laser_machine_left_low",
    "laser_machine_down_low",
    "laser_machine_right_high",
    "laser_machine_left_high",
    "laser_machine_down_high",
];

export const LASER_DIRECTION = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
];

export const LASER_TEXTURES = [
    "laser_horizontal_low",
    "laser_horizontal_low",
    "laser_vertical_low",
    "laser_vertical_low",
    "laser_horizontal_high",
    "laser_horizontal_high",
    "laser_vertical_high",
    "laser_vertical_high"
];

export const LASER_MIRROR_TEXTURES = [
    "laser_mirror_0_low",
    "laser_mirror_1_low",
    "laser_mirror_1_low",
    "laser_mirror_0_low",
    "laser_mirror_3_low",
    "laser_mirror_2_low",
    "laser_mirror_3_low",
    "laser_mirror_2_low",

    "laser_mirror_0_high",
    "laser_mirror_1_high",
    "laser_mirror_1_high",
    "laser_mirror_0_high",
    "laser_mirror_3_high",
    "laser_mirror_2_high",
    "laser_mirror_3_high",
    "laser_mirror_2_high",
];

export const MIRROR_TEXTURES = [
    "mirror_0",
    "mirror_1",
    "mirror_2",
    "mirror_3",
];

export const MIRROR_BOUNCE = [
    2,
    3,
    0,
    1,
    3,
    2,
    1,
    0
];

export const ANT_LASERED_TEXTURES = [];
for (let strength of ["low", "high"]) {
    for (let direction = 0; direction < 4; direction++) {
        ANT_LASERED_TEXTURES.push(`ant_lasered_${direction}_${strength}`);
    }
}

export class LaserMachine extends Connected {
    constructor(parts, connections, orientation = 0) {
        super(LASER_MACHINE[orientation], LASER_MACHINE[orientation], parts, connections, true, PASSABLE_FALSE);

        this.orientation = orientation;
    }

    get is_output() {
        return true;
    }

    get_textures(animation) {
        let res = [LASER_MACHINE[this.orientation]];
        if (this.network_active) {
            res.push(LASER_MACHINE[this.orientation + 3]);

            let step = Math.floor(animation * 5);
            if (step > 2) step = 4 - step;

            if (step > 0) {
                res.push(LASER_MACHINE[this.orientation + 3 * (step + 1)]);
            }
        }
        return res;
    }
}

export class Mirror extends Connected {
    constructor(parts, connections, orientation = false) {
        let texture = `mirror_${orientation ? 0 : 3}`;
        super(texture, texture, parts, connections, true, PASSABLE_FALSE);

        this.orientation = !!orientation;
        this.laser = 0;
    }

    get is_output() {
        return true;
    }

    get laser_offset() {
        return !!this.orientation == !!this.network_active ? 0 : 4;
    }

    get_textures(animation) {
        let orientation = !!this.orientation == !!this.network_active ? 0 : 3;
        let res = ["mirror_turntable", MIRROR_TEXTURES[orientation]];

        let step = Math.floor(animation * 5);
        if (step > 2) step = 4 - step;

        if (step > 0 && this.laser) {
            for (let n = 0; n < 4; n++) {
                if (this.laser & (1 << n)) {
                    res.push(LASER_MIRROR_TEXTURES[n + 8 * (step - 1) + this.laser_offset]);
                }
            }
        }

        return res;
    }

    handle_laser(orientation) {
        this.laser |= (1 << orientation);
        return [MIRROR_BOUNCE[orientation + this.laser_offset], false];
    }

    cleanup() {
        this.laser = 0;
    }
}

export class AntLasered extends Tile {
    constructor() {
        super("ant_lasered", PASSABLE_FALSE);
        this.laser = 0;
    }

    get_textures(animation) {
        let step = Math.floor(animation * 5);
        if (step > 2) step = 4 - step;

        let res = ["ant_lasered"];

        if (step > 0 && this.laser) {
            for (let n = 0; n < 4; n++) {
                if (this.laser & (1 << n)) {
                    res.push(ANT_LASERED_TEXTURES[n + 4 * (step - 1)]);
                }
            }
        }

        return res;
    }

    handle_laser(orientation) {
        this.laser |= (1 << orientation);
        return [-1, false];
    }

    cleanup() {
        this.laser = 0;
    }
}

export const BELT_TEXTURES = [];
for (let dir = 0; dir < 4; dir++) {
    BELT_TEXTURES.push(`belt_${DIRECTION_NAMES[dir]}`);
    for (let step = 0; step < 3; step++) {
        BELT_TEXTURES.push(`belt_${DIRECTION_NAMES[dir]}_${step}`);
    }
}

export const BELT_ENDS = DIRECTION_NAMES.map(dir => `belt_end_${dir}`);

export const BELT_SPEED = 125;

export class Belt extends Tile {
    constructor(direction, ends = 0) {
        super(BELT_TEXTURES[direction * 4]);
        this.direction = direction;
        this.ends = ends;

        this.item = null;

        this.item_move = [0, 0];
    }

    accepts_item(dx, dy) {
        return this.item === null;
    }

    get_textures(animation, last_tick) {
        let res = [BELT_TEXTURES[this.direction * 4]];

        let step = Math.floor(last_tick / BELT_SPEED) % 4;

        if (step > 0) {
            res.push(BELT_TEXTURES[this.direction * 4 + step]);
        }

        if (this.direction % 2 === 1) {
            if (this.ends & 0b0010) { // Right end isn't connected
                res.push(BELT_ENDS[1]);
            } else if (this.ends & 0b1000) { // Left end isn't connected
                res.push(BELT_ENDS[3]);
            }
        } else {
            if (this.ends & 0b0001) { // Top end isn't connected
                res.push(BELT_ENDS[0]);
            } else if (this.ends & 0b0100) { // Bottom end isn't connected
                res.push(BELT_ENDS[2]);
            }
        }

        return res;
    }

    draw(ctx, tilemap, vx, vy, tile_size, animation, last_tick) {
        for (let texture of this.get_textures(animation, last_tick)) {
            tilemap.draw(ctx, texture, vx, vy, tile_size, animation);
        }
    }

    draw_overlay(ctx, tilemap, vx, vy, tile_size, animation, last_tick) {
        if (this.item !== null) {
            let vx2 = vx;
            let vy2 = vy - tile_size * 2/16;
            let [dx, dy] = this.item_move;

            if (dx !== 0 || dy !== 0) {
                vx2 -= Math.round(dx * tile_size * (1 - animation));
                vy2 -= Math.round(dy * tile_size * (1 - animation));
            }

            tilemap.draw(ctx, ITEM_TEXTURES.get(this.item), vx2, vy2, tile_size, animation);
        }
    }

    update(stage, x, y) {
        let [dx, dy] = DIRECTIONS[this.direction];

        let ant = stage.ants.find(ant => ant.x === x && ant.y === y);
        if (ant && ant.can_move) {
            ant.move(dx, dy, false);
        }

        if (this.item !== null && this.item_move[0] === 0 && this.item_move[1] === 0) {
            for (let tile of stage.tiles.get(x + dx, y + dy)) {
                if (tile.accepts_item(dx, dy)) {
                    tile.give_item(this.item, dx, dy);
                    this.item = null;
                    break;
                }
            }
        }
    }

    cleanup() {
        this.item_move = [0, 0];
    }

    give_item(item, dx, dy) {
        this.item = item;
        this.item_move = [dx, dy];
    }
}

export const CLOCK_TEXTURES = ["clock"];
for (let n = 1; n < 6; n++) {
    CLOCK_TEXTURES.push(`clock_${n}`);
}

export class Clock extends Connected {
    constructor(parts, connections, phase, frequency) {
        super("clock", "clock", parts, connections);
        this.phase = phase;
        this.frequency = frequency;
        this.active = this.phase === 0;
    }

    get is_input() {
        return true;
    }

    get_textures() {
        let res = this.get_parts_textures();

        let step = Math.round(this.phase * 6 / this.frequency);

        res.push("clock");

        if (step > 0) {
            res.push(CLOCK_TEXTURES[step]);
        }

        return res;
    }

    update(stage, x, y) {
        this.phase = (this.phase + 1) % this.frequency;
        this.active = this.phase === 0;
    }
}

export const CRANE_TEXTURES = [0, 1, 2, 3].map(x => `crane_${x}`);
export const CRANE_OFFSET = [
    [-29, -5],
    [-25, -3],
    [ -7, -3],
    [ -3, -5]
].map(([x, y]) => [x / 16 + 1, y / 16]);

export class Crane extends Connected {
    constructor(parts, connections, direction) {
        super("crane_base_on", "crane_base_off", parts, connections, true, PASSABLE_FALSE);

        this.direction = !!direction;
        this.state = !!direction;
        this.item = null;
    }

    get is_output() {
        return true;
    }

    get_textures(animation) {
        let res = this.get_parts_textures();

        res.push("crane_base_off");

        if (this.network_active) {
            res.push("crane_base_on");
        }

        return res;
    }

    get_step(animation) {
        let res = 0;

        if (this.should_rotate && animation > 0.0) res = Math.floor(animation * 3) + 1;

        res = Math.max(Math.min(res, 3), 0);

        if (this.state) {
            res = 3 - res;
        }

        return res;
    }

    get_overlay_textures(animation) {
        let res = [];

        let step = this.get_step(animation);

        res.push(CRANE_TEXTURES[step]);

        return res;
    }

    draw_overlay(ctx, tilemap, vx, vy, tile_size, animation, last_tick) {
        if (this.item !== null) {
            let step = this.get_step(animation);
            let vx2 = vx + CRANE_OFFSET[step][0] * tile_size;
            let vy2 = vy + CRANE_OFFSET[step][1] * tile_size;

            tilemap.draw(ctx, ITEM_TEXTURES.get(this.item), vx2, vy2, tile_size, animation);
        }

        for (let texture of this.get_overlay_textures(animation, last_tick)) {
            tilemap.draw(ctx, texture, vx, vy, tile_size, animation);
        }
    }

    update(stage, x, y, index) {
        if (this.state != this.direction && this.item !== null) {
            let dx = this.state ? 1 : -1;
            let dy = 0;

            for (let ant of stage.ants) {
                if (
                    ant.x - ant.moving * DIRECTIONS[ant.direction][0] === x + dx
                    && ant.y - ant.moving * DIRECTIONS[ant.direction][1] === y + dy
                    && ant.item === null
                ) {
                    ant.item = this.item;
                    this.item = null;
                    return;
                }
            }

            for (let tile of stage.tiles.get(x + dx, y + dy)) {
                if (tile.accepts_item(dx, dy)) {
                    tile.give_item(this.item, 0, 0);
                    this.item = null;
                    break;
                }
            }
        } else if (this.network_active && this.state == this.direction && this.item === null) {
            let dx = this.state ? 1 : -1;
            let dy = 0;

            for (let ant of stage.ants) {
                if (ant.x === x + dx && ant.y === y + dy && ant.item !== null && !ant.moving) {
                    this.item = ant.item;
                    ant.item = null;
                    return;
                }
            }

            for (let tile of stage.tiles.get(x + dx, y + dy)) {
                if (tile.item) {
                    this.item = tile.item;
                    tile.item = null;
                    break;
                }
            }
        }
    }

    get should_rotate() {
        return (this.state == this.direction) == !!this.item;
    }

    cleanup() {
        if (this.should_rotate) {
            this.state = !this.state;
        }
    }
}

export const DISTRIBUTOR_TEXTURES = DIRECTION_NAMES.map(x => `distributor_${x}`);

export class Distributor extends Connected {
    constructor(parts, connections, direction, item) {
        let texture = `distributor_${DIRECTION_NAMES[direction]}`;
        super(texture, texture, parts, connections);
        this.direction = direction;
        this.item = item;
    }

    get is_output() {
        return true;
    }

    get_textures() {
        return [];
    }

    get_overlay_textures(animation) {
        return [DISTRIBUTOR_TEXTURES[this.direction]];
    }

    update(stage, x, y) {
        if (this.network_active) {
            for (let tile of stage.tiles.get(x, y)) {
                if (tile.accepts_item(0, 0)) {
                    tile.give_item(this.item, ...DIRECTIONS[this.direction].map(v => 0.2 * v));
                }
            }
        }
    }
}

export class Collector extends Connected {
    constructor(parts, connections, direction, target_item = null) {
        let texture = `distributor_${DIRECTION_NAMES[direction]}`;
        super(texture, texture, parts, connections);
        this.direction = direction;
        this.target_item = target_item;
        this.active = false;
    }

    get is_input() {
        return true;
    }

    get_textures(animation) {
        return [DISTRIBUTOR_TEXTURES[this.direction]];
    }

    update(stage, x, y) {
        for (let tile of stage.tiles.get(x, y)) {
            if (!tile.item) continue;
            if (this.target_item === null || tile.item === this.target_item) {
                this.active = true;
            }
            tile.item = null;
        }
    }

    cleanup() {
        if (this.active) this.active = false;
    }
}

export class WallCollector extends Collector {
    constructor(parts, connections, target_item = null) {
        super(parts, connections, 0, target_item);
    }

    get_textures(animation) {
        return this.get_parts_textures();
    }

    get_overlay_textures(animation) {
        return ["wall_distributor"];
    }

    is_passable(was_passable) {
        return false;
    }
}

export const MACHINE_SMOKE = [
    "machine_smoke_0",
    "machine_smoke_1",
    "machine_smoke_2",
];

// This thing is quite hacky when it comes to rendering, but it looks soooo smooth :>
export class Machine extends Connected {
    constructor(parts, connections, target_item) {
        super("machine_off", "machine_off", parts, connections, true, PASSABLE_FALSE);
        this.left_item = null;
        this.right_item = null;
        this.item_move = [false, false];
        this.target_item = target_item;
        this.processed = false;
    }

    draw(ctx, tilemap, vx, vy, tile_size, animation, last_tick) {
        if (this.item_move[0]) {
            let vx2 = vx;
            let vy2 = vy - tile_size * 2/16;
            let dx = 1;

            vx2 -= Math.round(dx * tile_size * (1 - animation));

            tilemap.draw(ctx, ITEM_TEXTURES.get(this.left_item), vx2, vy2, tile_size, animation);
        }
    }

    get_overlay_textures(animation) {
        let res = ["machine_off"];

        if (this.network_active) {
            res.push("machine_on");
            let smoke = Math.floor(animation * 4);
            if (smoke < 3 && this.left_item && this.right_item && !this.processed) {
                res.push(MACHINE_SMOKE[2 - smoke]);
            }
        }

        return res;
    }

    draw_overlay(ctx, tilemap, vx, vy, tile_size, animation, last_tick) {
        if (this.item_move[1]) {
            let vx2 = vx;
            let vy2 = vy - tile_size * 2/16;
            let dx = -1;

            vx2 -= Math.round(dx * tile_size * (1 - animation));

            tilemap.draw(ctx, ITEM_TEXTURES.get(this.right_item), vx2, vy2, tile_size, animation);
        }

        for (let texture of this.get_overlay_textures(animation, last_tick)) {
            tilemap.draw(ctx, texture, vx, vy, tile_size, animation);
        }
    }

    update(stage, x, y) {
        if (this.processed) {
            for (let tile of stage.tiles.get(x, y - 1)) {
                if (tile.accepts_item(0, -1)) {
                    tile.give_item(this.target_item, 0, -1);
                    this.left_item = null;
                    this.right_item = null;
                    this.processed = false;
                }
            }
        }
    }

    cleanup() {
        if (this.network_active && this.left_item && this.right_item) this.processed = true;
        this.item_move = [false, false];
    }
}

export class MachineCollector extends Collector {
    draw() {}

    draw_overlay(ctx, tilemap, vx, vy, tile_size, animation, last_tick) {
        super.draw(ctx, tilemap, vx, vy, tile_size, animation, last_tick);
    }

    update(stage, x, y) {
        if (this.direction === 1) {
            let machine = stage.tiles.get(x - 1, y).find(tile => tile instanceof Machine);
            if (!machine || machine.right_item) return;

            for (let tile of stage.tiles.get(x, y)) {
                if (!tile.item || tile.item_move?.[0] || tile.item_move?.[1]) continue;
                if (this.target_item === null || tile.item === this.target_item) {
                    this.active = true;
                    machine.right_item = tile.item;
                    machine.item_move[1] = true;
                }
                tile.item = null;
            }
        } else {
            let machine = stage.tiles.get(x + 1, y).find(tile => tile instanceof Machine);
            if (!machine || machine.left_item) return;

            for (let tile of stage.tiles.get(x, y)) {
                if (!tile.item || tile.item_move?.[0] || tile.item_move?.[1]) continue;
                if (this.target_item === null || tile.item === this.target_item) {
                    this.active = true;
                    machine.left_item = tile.item;
                    machine.item_move[0] = true;
                }
                tile.item = null;
            }
        }
    }
}

export class Help extends Tile {
    constructor(message, active = false) {
        super("help", PASSABLE_IGNORE);
        this.message = message;
        this.active = !!active;
    }

    draw(ctx, tilemap, vx, vy, tile_size, animation, last_tick) {
        for (let texture of this.get_textures(animation, last_tick)) {
            tilemap.draw(ctx, texture, vx, vy, tile_size, animation);
        }

        if (this.active) {
            ctx.fillStyle = "#d0d0d0";
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            ctx.font = "16px monospace";
            let y = 8;
            for (let line of this.message.split("\n")) {
                ctx.fillText(line, 8, y);
                y += 20;
            }
        }
    }

    update(stage, x, y) {
        this.active = false;
        let player = stage.current_ant();
        if (!player) return;

        if (player.x === x && player.y === y) {
            this.active = true;
        }
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
    tilemap.add_texture("void", {x: 2, y: 3});
    tilemap.add_texture("empty", {x: 2, y: 0});
    tilemap.add_texture("help", {x: 3, y: 4});

    for (let dx = 0; dx < 3; dx++) {
        let color = CABLE_NAMES[dx];
        for (let dy = 0; dy <= 1; dy++) {
            let suffix = dy === 0 ? "" : "_on";
            tilemap.add_texture(`cable_${color}${suffix}`, {x: 0 + 5 * dx, y: 14 + dy});
            tilemap.add_texture(`cable_${color}_up${suffix}`, {x: 1 + 5 * dx, y: 14 + dy});
            tilemap.add_texture(`cable_${color}_right${suffix}`, {x: 2 + 5 * dx, y: 14 + dy});
            tilemap.add_texture(`cable_${color}_down${suffix}`, {x: 3 + 5 * dx, y: 14 + dy});
            tilemap.add_texture(`cable_${color}_left${suffix}`, {x: 4 + 5 * dx, y: 14 + dy});
        }
    }

    tilemap.add_texture("button_up", {x: 0, y: 5});
    tilemap.add_texture("button_down", {x: 1, y: 5});

    tilemap.add_texture("door_open", {x: 0, y: 3});
    tilemap.add_texture("door_closed", {x: 1, y: 3});

    tilemap.add_texture("passage_open", {x: 0, y: 4});
    tilemap.add_texture("passage", {x: 1, y: 4});
    tilemap.add_texture("passage_closed", {x: 2, y: 4});

    tilemap.add_texture("and_off", {x: 0, y: 6});
    tilemap.add_texture("and_on", {x: 1, y: 6});
    tilemap.add_texture("rs_off", {x: 0, y: 7});
    tilemap.add_texture("rs_on", {x: 1, y: 7});

    tilemap.add_texture("fence", {x: 0, y: 13});
    tilemap.add_texture("fence_up", {x: 1, y: 13});
    tilemap.add_texture("fence_right", {x: 2, y: 13});
    tilemap.add_texture("fence_down", {x: 3, y: 13});
    tilemap.add_texture("fence_left", {x: 4, y: 13});

    tilemap.add_texture("spike", {x: 2, y: 5});
    tilemap.add_texture("spike_jam", {x: 6, y: 5});
    for (let n = 0; n < 3; n++) {
        tilemap.add_texture("spike_" + n, {x: 3 + n, y: 5});
    }

    for (let dy = 0; dy < 4; dy++) {
        let suffix = ["", "_on", "_low", "_high"][dy];
        tilemap.add_texture("laser_machine_right" + suffix, {x: 2, y: 6 + dy});
        tilemap.add_texture("laser_machine_left" + suffix, {x: 3, y: 6 + dy});
        tilemap.add_texture("laser_machine_down" + suffix, {x: 4, y: 6 + dy});
    }

    for (let dx = 0; dx < 2; dx++) {
        let suffix = dx === 0 ? "low" : "high";
        tilemap.add_texture("laser_horizontal_" + suffix, {x: 5 + 2 * dx, y: 7});
        tilemap.add_texture("laser_vertical_" + suffix, {x: 6 + 2 * dx, y: 7});
    }

    for (let dy = 0; dy < 2; dy++) {
        let suffix = dy === 0 ? "low" : "high";
        for (let dx = 0; dx < 4; dx++) {
            tilemap.add_texture(`laser_mirror_${dx}_${suffix}`, {x: 5 + dx, y: 9 + dy});
        }
    }

    tilemap.add_texture("mirror_turntable", {x: 5, y: 6});
    for (let dx = 0; dx < 4; dx++) {
        tilemap.add_texture(`mirror_${dx}`, {x: 5 + dx, y: 8});
    }

    tilemap.add_texture("ant_lasered", {x: 6, y: 6});
    let ant_lasered = [
        [9, 7],
        [10, 7],
        [9, 9],
        [10, 9],
    ];
    for (let dy = 0; dy < 2; dy++) {
        for (let [direction, [x, y]] of ant_lasered.entries()) {
            tilemap.add_texture(`ant_lasered_${direction}_${dy === 0 ? "low" : "high"}`, {x, y: y + dy});
        }
    }

    for (let dx = 0; dx < 4; dx++) {
        let end = ["left", "right", "down", "up"][dx];
        tilemap.add_texture(`belt_end_${end}`, {x: 11 + dx, y: 8});
        let dir = [1, 3, 2, 0][dx];

        for (let dy = 0; dy < 4; dy++) {
            if (dy === 0) {
                tilemap.add_texture(`belt_${DIRECTION_NAMES[dir]}`, {x: 11 + dx, y: 9});
            } else {
                tilemap.add_texture(`belt_${DIRECTION_NAMES[dir]}_${dy - 1}`, {x: 11 + dx, y: 9 + dy});
            }
        }
    }

    for (let dx = 0; dx < 6; dx++) {
        if (dx === 0) {
            tilemap.add_texture(`clock`, {x: 5, y: 11});
        } else {
            tilemap.add_texture(`clock_${dx}`, {x: 5 + dx, y: 11});
        }
    }

    tilemap.add_texture(`crane_base_off`, {x: 9, y: 12});
    tilemap.add_texture(`crane_base_on`, {x: 10, y: 12});

    tilemap.add_texture(`crane_0`, {x: 5, y: 12, width: 2, dx: -0.5, dy: -4/16});
    tilemap.add_texture(`crane_1`, {x: 5, y: 13, width: 2, dx: -0.5, dy: -4/16});
    tilemap.add_texture(`crane_2`, {x: 7, y: 13, width: 2, dx: -0.5, dy: -4/16});
    tilemap.add_texture(`crane_3`, {x: 7, y: 12, width: 2, dx: -0.5, dy: -4/16});

    tilemap.add_texture(`wall_distributor`, {x: 0, y: 12});
    for (let dx = 0; dx < 4; dx++) {
        tilemap.add_texture(`distributor_${DIRECTION_NAMES[dx]}`, {x: 1 + dx, y: 12});
    }

    tilemap.add_texture("machine_off", {x: 3, y: 10, height: 2, dy: -1});
    tilemap.add_texture("machine_on", {x: 4, y: 11});
    for (let dx = 0; dx < 3; dx++) {
        tilemap.add_texture(`machine_smoke_${dx}`, {x: dx, y: 10, dy: -1});
    }
}

export const CABLES = [];
export const CABLE_NAMES = ["blue", "green", "red"];

for (let color = 0; color < 3; color++) {
     CABLES.push([
        `cable_${CABLE_NAMES[color]}_up`,
        `cable_${CABLE_NAMES[color]}_right`,
        `cable_${CABLE_NAMES[color]}_down`,
        `cable_${CABLE_NAMES[color]}_left`,
        `cable_${CABLE_NAMES[color]}_up_on`,
        `cable_${CABLE_NAMES[color]}_right_on`,
        `cable_${CABLE_NAMES[color]}_down_on`,
        `cable_${CABLE_NAMES[color]}_left_on`
    ]);
}

export const CABLE_BLUE = CABLES[0];

export const CABLE_GREEN = CABLES[1];

export const FENCE = [
    "fence_up",
    "fence_right",
    "fence_down",
    "fence_left",
    "fence_up",
    "fence_right",
    "fence_down",
    "fence_left"
];

export const TILE_CABLES = CABLES.map((c, i) => new Connected(`cable_${CABLE_NAMES[i]}_on`, `cable_${CABLE_NAMES[i]}`, c, 0, false));
export const TILE_CABLES_MAP = new Map(TILE_CABLES.map((t, i) => [CABLE_NAMES[i], t]));

export const TILE_WALL = new LaserBlocker("wall", PASSABLE_FALSE);
export const TILE_LASER_BLOCKER = new LaserBlocker("", PASSABLE_FALSE);
export const TILE_EDGE = new Tile("edge", PASSABLE_FALSE);
export const TILE_GROUND = new Tile("ground", PASSABLE_TRUE);
export const TILE_FENCE = new Connected("fence", "fence", FENCE, 0, false, PASSABLE_FALSE);

export const TILES = new Map();

export const CABLE_MAP = new Map(CABLES.map((c, i) => [CABLE_NAMES[i], c]));

function tile_singleton(name, instance) {
    TILES.set(name, () => instance);
}

function tile_component(name, tile_class) {
    TILES.set(name, (color, connections) => new tile_class(CABLE_MAP.get(color), connections));
}

tile_singleton("wall", TILE_WALL);
tile_singleton("laser_blocker", TILE_LASER_BLOCKER);
tile_singleton("edge", TILE_EDGE);
tile_singleton("ground", TILE_GROUND);

tile_component("button", Button);
tile_component("door", Door);

TILES.set("passage", (open) => new Passage(open));

TILES.set("cable", (color, connections) => Connected.from(TILE_CABLES_MAP.get(color), connections));
TILES.set("and", (color, connections) => new And(CABLE_MAP.get(color), connections));
TILES.set("rs", (color, connections, state = false) => new RSLatch(CABLE_MAP.get(color), connections, state));

TILES.set("fence", (connections) => Connected.from(TILE_FENCE, connections));
TILES.set("spike", (jammed = false) => new Spike(jammed));

TILES.set("laser", (color, connections, orientation = 0) => new LaserMachine(CABLE_MAP.get(color), connections, orientation));

TILES.set("mirror", (color, connections, orientation = false) => new Mirror(CABLE_MAP.get(color), connections, orientation));

TILES.set("ant_lasered", () => new AntLasered());

TILES.set("clock", (color, connections, phase, frequency) => new Clock(CABLE_MAP.get(color), connections, phase, frequency));

TILES.set("belt", (direction, connections) => new Belt(direction, connections));
TILES.set("crane", (color, connections, direction) => new Crane(CABLE_MAP.get(color), connections, direction));
TILES.set("distributor", (color, connections, direction, item) => new Distributor(CABLE_MAP.get(color), connections, direction, item));
TILES.set("collector", (color, connections, direction, item = null) => new Collector(CABLE_MAP.get(color), connections, direction, item));
TILES.set("wall_collector", (color, connections, item = null) => new WallCollector(CABLE_MAP.get(color), connections, item));
TILES.set("machine_collector", (color, connections, direction, item = null) => new MachineCollector(CABLE_MAP.get(color), connections, direction, item));

TILES.set("machine", (color, connections, target_item) => new Machine(CABLE_MAP.get(color), connections, target_item));

TILES.set("help", (message, active = false) => new Help(message, active));

export default function tile(name, ...data) {
    if (TILES.has(name)) {
        return TILES.get(name)(...data);
    } else {
        return null;
    }
}

tile.register_tile_textures = register_tile_textures;
