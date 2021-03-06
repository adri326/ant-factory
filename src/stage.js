import {TILE_SIZE, ease_function} from "./renderer.js";
import {Ant} from "./ant.js";
import {Pheromone} from "./pheromone.js";
import {
    Spike,
    LaserMachine,
    Mirror,
    AntLasered,
    LASER_DIRECTION,
    LASER_TEXTURES,
    MIRROR_BOUNCE
} from "./tile.js";
import tile from "./tile.js";
import {Network} from "./network.js";

const ANIMATION_LENGTH = 250;
export const NO_HUD = 0;
export const PHEROMONE_HUD = 1;

export class Grid {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.tiles = new Array(width * height).fill(null).map(_ => []);
    }

    get(x, y) {
        if (valid_coordinates(x, y, this.width, this.height)) {
            return this.tiles[x + y * this.width] ?? [];
        } else {
            return [];
        }
    }

    set(x, y, tile) {
        if (valid_coordinates(x, y, this.width, this.height)) {
            this.tiles[x + y * this.width] = tile;
            return true;
        } else {
            return false;
        }
    }
}

export class PheromoneGrid {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.tiles = new Array(width * height).fill(null).map(_ => new Pheromone());
    }

    get(x, y) {
        if (valid_coordinates(x, y, this.width, this.height)) {
            return this.tiles[x + y * this.width];
        } else {
            return null;
        }
    }

    set(x, y, pheromone) {
        if (valid_coordinates(x, y, this.width, this.height)) {
            this.tiles[x + y * this.width] = pheromone;
            return true;
        } else {
            return false;
        }
    }
}

const NO_LASER = 0;
const LASER_RIGHT = 1;
const LASER_LEFT = 2;
const LASER_DOWN = 4;
const LASER_UP = 8;

export class LaserGrid {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.tiles = new Array(width * height).fill(NO_LASER);
    }

    get(x, y) {
        if (valid_coordinates(x, y, this.width, this.height)) {
            return this.tiles[x + y * this.width];
        } else {
            return NO_LASER;
        }
    }

    set(x, y, state) {
        if (valid_coordinates(x, y, this.width, this.height)) {
            this.tiles[x + y * this.width] = state;
            return true;
        } else {
            return false;
        }
    }

    reset() {
        this.tiles.fill(NO_LASER);
    }
}

export class Stage {
    constructor(tilemap, width, height) {
        this.tiles = new Grid(width, height);
        this.ants = [];

        this.width = width;
        this.height = height;

        this.cx = 0;
        this.cy = 0;
        this.zoom = 2;
        this.tilemap = tilemap;

        this.networks = [];
        this.player_index = 0;
        this.animation = 0.0;
        this.animation_stress = 1.0;
        this.last_tick = Date.now();

        this.pheromone = new PheromoneGrid(width, height);
        this.laser = new LaserGrid(width, height);
        this.previous_laser = new LaserGrid(width, height);

        this.warps = [];

        this.hud = NO_HUD;
    }

    draw(ctx, width, height, manager) {
        let dt = Date.now() - this.last_tick;
        this.last_tick += dt;

        // TODO: make this dt-independent (with a o(dt^2) margin)
        let n_updates = Math.max(manager.updates.length, 1);
        if (n_updates > this.animation_stress) {
            this.animation_stress = (n_updates + this.animation_stress * 3) / 4.0;
        } else {
            this.animation_stress = (n_updates + this.animation_stress * 15) / 16.0;
        }

        if (manager.updates.length > 0) {
            this.animation += dt * Math.pow(this.animation_stress, 2) / ANIMATION_LENGTH;
            if (this.animation >= 1.0) {
                this.animation %= 1.0;
                manager.pop_update();
            }
        }

        let animation = manager.updates.length > 0 ? ease_function(this.animation) : 0.0;

        ctx.fillStyle = "#080808";
        ctx.fillRect(0, 0, width, height);
        let tile_size = TILE_SIZE * Math.ceil(Math.pow(2, this.zoom));

        const get_vx = (x) => {
            return x * tile_size - this.width * tile_size / 2 + this.cx + width / 2;;
        };

        const get_vy = (y) => {
            return y * tile_size - this.height * tile_size / 2 + this.cy + height / 2;
        };

        for (let y = 0; y < this.height; y++) {
            let vy = get_vy(y);
            for (let x = 0; x < this.width; x++) {
                let vx = get_vx(x);

                let stack = this.tiles.get(x, y);
                for (let tile of stack) {
                    tile.draw(ctx, this.tilemap, vx, vy, tile_size, animation, this.last_tick);
                }
            }
        }

        for (let index = 0; index < this.ants.length; index++) {
            let ant = this.ants[index];

            let vx = get_vx(ant.x);
            let vy = get_vy(ant.y);

            ant.draw(ctx, this.tilemap, vx, vy, tile_size, index === this.player_index, animation);
        }

        for (let y = 0; y < this.height; y++) {
            let vy = get_vy(y);
            for (let x = 0; x < this.width; x++) {
                let vx = get_vx(x);

                let stack = this.tiles.get(x, y);
                for (let tile of stack) {
                    tile.draw_overlay(ctx, this.tilemap, vx, vy, tile_size, animation, this.last_tick);
                }

                let laser = this.laser.get(x, y);
                if (laser !== NO_LASER) {
                    let step = Math.floor(animation * 5);
                    if (step > 2) step = 4 - step;

                    if (step > 0) {
                        for (let n = 0; n < 4; n++) {
                            if (laser & (1 << n)) {
                                this.tilemap.draw(ctx, LASER_TEXTURES[n + 4 * (step - 1)], vx, vy, tile_size);
                            }
                        }
                    }
                }

                let pheromone = this.pheromone.get(x, y);

                if (pheromone) {
                    pheromone.draw(ctx, this.tilemap, vx, vy, tile_size, this.hud === PHEROMONE_HUD);
                }
            }
        }
    }

    on_click(x, y, width, height, manager) {
        const update = (beforeupdate = (() => {})) => {
            manager.push_update(() => {
                this.kill_ants();
                beforeupdate();
                this.update();

                return () => this.cleanup();
            });
        };

        let tile_size = TILE_SIZE * Math.ceil(Math.pow(2, this.zoom));

        const get_vx = (x) => {
            return x * tile_size - this.width * tile_size / 2 + this.cx + width / 2;;
        };

        const get_vy = (y) => {
            return y * tile_size - this.height * tile_size / 2 + this.cy + height / 2;
        };

        let sx = get_vx(0);
        let sy = get_vy(0);

        let fx = Math.floor((x - sx) / tile_size);
        let fy = Math.floor((y - sy) / tile_size);

        if (fx >= 0 && fy >= 0 && fx < this.width && fy < this.height) {
            for (let n = 0; n < this.ants.length; n++) {
                let ant = this.ants[n];
                if (ant.x === fx && ant.y === fy) {
                    update(() => this.player_index = n);
                    break;
                }
            }
        }
    }

    kill_ants() {
        for (let ant of this.ants) {
            let tiles = this.tiles.get(ant.x, ant.y);
            for (let tile of tiles) {
                if (tile instanceof Spike && !tile.jammed) {
                    ant.spiked = true;
                }
            }
            if (ant.spiked) continue;

            let laser = this.previous_laser.get(ant.x, ant.y);
            if (laser) {
                ant.laser = true;
            }
        }
    }

    update() {
        for (let index = 0; index < this.ants.length; index++) {
            if (index === this.player_index) continue;
            this.ants[index].ai(this, index);
        }

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                let stack = this.tiles.get(x, y);
                let index = 0;
                for (let tile of stack) {
                    tile.update(this, x, y, index);
                    index++;
                }
            }
        }

        for (let network of this.networks) {
            network.update();
        }

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                for (let tile of this.tiles.get(x, y)) {
                    if (tile instanceof LaserMachine && tile.network_active) {
                        this.send_laser(x, y, tile.orientation);
                    }
                }
            }
        }
    }

    cleanup() {
        for (let ant of this.ants) {
            if (ant.spiked || ant.laser) {
                let tiles = this.tiles.get(ant.x, ant.y);
                if (ant.spiked) {
                    for (let tile of tiles) {
                        if (tile instanceof Spike) {
                            tile.jammed = true;
                        }
                    }
                } else if (ant.laser) {
                    tiles.push(new AntLasered());
                }

                let index = this.ants.indexOf(ant);
                if (this.current_ant() === ant) {
                    this.swap_ant();
                }
                this.ants.splice(index, 1);
                if (this.player_index > index) {
                    this.player_index--;
                }
            }
        }

        while (this.player_index >= this.ants.length) this.player_index--;

        for (let ant of this.ants) {
            ant.moving = false;
        }

        let tmp = this.laser;
        this.laser = this.previous_laser;
        this.previous_laser = tmp;

        this.laser.reset();

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                let stack = this.tiles.get(x, y);
                for (let z = 0; z < stack.length; z++) {
                    stack[z].cleanup(stage, x, y, z);
                }
            }
        }
    }

    is_passable(x, y) {
        if (!valid_coordinates(x, y, this.width, this.height)) return false;

        let passable = false;
        for (let tile of this.tiles.get(x, y)) {
            passable = tile.is_passable(passable);
        }

        return passable;
    }

    current_ant() {
        return this.ants[this.player_index];
    }

    swap_ant() {
        let current_ant = this.ants[this.player_index];

        function distance(ant) {
            return Math.abs(ant.x - current_ant.x) + Math.abs(ant.y - current_ant.y);
        }

        let closest_ant = [...this.ants.entries()].filter(([i, _]) => i != this.player_index).sort(([_ia, a], [_ib, b]) => distance(a) - distance(b));
        if (closest_ant.length) {
            this.player_index = closest_ant[0][0];
        }
    }

    toggle_hud(hud) {
        if (hud === this.hud) this.hud = NO_HUD;
        else this.hud = hud;
    }

    send_laser(x, y, orientation) {
        let n = 0;

        while (n++ < 100 && x >= 0 && y >= 0 && x < this.width && y < this.height) {
            let [dx, dy] = LASER_DIRECTION[orientation];
            x += dx;
            y += dy;
            let place_laser = true;

            for (let tile of this.tiles.get(x, y)) {
                let res = tile.handle_laser(orientation);
                orientation = res[0];
                place_laser = place_laser && res[1];
            }

            if (orientation === -1) break;

            if (place_laser) this.laser.set(x, y, this.laser.get(x, y) | (1 << orientation));
        }
    }

    active_warp() {
        let player = this.current_ant();
        if (!player) return null;

        for (let [x, y, level, tx, ty] of this.warps) {
            if (x === player.x && y === player.y) return [level, tx, ty];
        }

        return null;
    }

    reset() {
        return Stage.from_desc(this.tilemap, this.description);
    }

    static from_desc(tilemap, description) {
        let lines = description.split("\n");
        let [width, height] = lines.shift().split("x").map(x => +x);
        if (!Number.isInteger(width)) throw new Error("Invalid width!");
        if (!Number.isInteger(height)) throw new Error("Invalid height!");

        let res = new Stage(tilemap, width, height);
        res.description = description;

        function parse_number(str) {
            let match = /^0b([01]+)$/.exec(str);
            if (match) {
                return Number.parseInt(match[1], 2);
            }
            match = /^0x([0-9a-fA-F]+)$/.exec(str);
            if (match) {
                return Number.parseInt(match[1], 16);
            }
            match = /^[0-9]+(?:\.[0-9]+)?$/.exec(str);
            if (match) {
                return Number.parseFloat(match[0]);
            }
            match = /^\((?:[udlr]+|_)\)$/i.exec(str);
            if (match) {
                let letters = match[0].toLowerCase().split("");
                let up = letters.includes("u");
                let down = letters.includes("d");
                let left = letters.includes("l");
                let right = letters.includes("r");

                return up | (right << 1) | (down << 2) | (left << 3);
            }
            return str;
        }

        function set(x, y, name, ...args) {
            x = +x;
            y = +y;
            let tiles = res.tiles.get(x, y);
            if (tiles) {
                tiles.push(tile(name, ...args.map(parse_number)));
            }
        }

        function row(y, name, ...args) {
            y = +y;
            for (let x = 0; x < width; x++) {
                let tiles = res.tiles.get(x, y);
                if (tiles) tiles.push(tile(name, ...args.map(parse_number)));
            }
        }

        function fill(x, y, name, ...args) {
            x = x.split("..").map(str => +str);
            y = y.split("..").map(str => +str);

            if (x.length === 1) x.push(x[0] + 1);
            if (y.length === 1) y.push(y[0] + 1);

            for (let y2 = y[0]; y2 < y[1]; y2++) {
                for (let x2 = x[0]; x2 < x[1]; x2++) {
                    let tiles = res.tiles.get(x2, y2);
                    if (tiles) tiles.push(tile(name, ...args.map(parse_number)));
                }
            }
        }

        function network(x, y, z = null) {
            x = +x;
            y = +y;
            if (z === null) {
                z = (res.tiles.get(x, y)?.length ?? 1) - 1;
            } else {
                z = +z;
            }
            res.networks.push(Network.from(res, x, y, z));
        }

        function ant(player, x, y, item = null) {
            if (player) {
                res.player_index = res.ants.length;
            }

            res.ants.push(new Ant(+x, +y, res, item));
        }

        function warp(x, y, level, tx = null, ty = null) {
            res.warps.push([+x, +y, level, tx === null ? null : +tx, ty === null ? null : +ty]);
        }

        function item(x, y, name) {
            x = +x;
            y = +y;
            for (let tile of res.tiles.get(x, y)) {
                if (tile.item === null) {
                    tile.item = name;
                    break;
                }
            }
        }

        for (let line of lines) {
            let args = line.split("\"").map((part, i) => i % 2 === 0 ? part.split(" ") : part.replace(/\\n/g, "\n")).flat().filter(Boolean);
            if (!args.length) continue;

            switch (args[0].toLowerCase()) {
                case "set":
                    set(...args.slice(1));
                    break;

                case "row":
                    row(...args.slice(1));
                    break;

                case "network":
                    network(...args.slice(1));
                    break;

                case "ant":
                    ant(false, ...args.slice(1));
                    break;

                case "player":
                    ant(true, ...args.slice(1));
                    break;

                case "fill":
                    fill(...args.slice(1));
                    break;

                case "warp":
                    warp(...args.slice(1));
                    break;

                case "item":
                    item(...args.slice(1));
                    break;
            }
        }

        return res;
    }

    static from_url(tilemap, url) {
        return fetch(url).then(res => res.text()).then(raw => Stage.from_desc(tilemap, raw));
    }
}

export function valid_coordinates(x, y, width, height) {
    return (
        Number.isInteger(x) && Number.isInteger(y)
        && x >= 0 && x < width
        && y >= 0 && y < height
    );
}
