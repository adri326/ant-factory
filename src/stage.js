import {TILE_SIZE} from "./renderer.js";
// import {Ant} from "./ant.js";
import {Pheromone} from "./pheromone.js";
import {Spike, LaserMachine, Mirror, LASER_DIRECTION, LASER_TEXTURES, MIRROR_BOUNCE, TILE_ANT_LASERED} from "./tile.js";

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
                    for (let texture of tile.get_textures(animation)) {
                        this.tilemap.draw(ctx, texture, vx, vy, tile_size, animation);
                    }
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
                    tiles.push(TILE_ANT_LASERED);
                }
                let index = this.ants.indexOf(ant);
                this.ants.splice(index, 1);
                if (this.current_ant() === ant) {
                    this.swap_ant();
                } else if (this.player_index > index) {
                    this.player_index--;
                }
            }
        }

        for (let ant of this.ants) {
            ant.moving = false;
        }

        let tmp = this.laser;
        this.laser = this.previous_laser;
        this.previous_laser = tmp;

        this.laser.reset();

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                for (let tile of this.tiles.get(x, y)) {
                    if (tile instanceof Mirror) {
                        tile.laser = 0;
                    }
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

        let [dx, dy] = LASER_DIRECTION[orientation];
        while (n++ < 100 && x >= 0 && y >= 0 && x < this.width && y < this.height) {
            x += dx;
            y += dy;
            let mirror = null;

            for (let tile of this.tiles.get(x, y)) {
                if (tile instanceof Mirror) {
                    mirror = tile;
                    break;
                }
            }

            if (mirror) {
                mirror.laser |= (1 << orientation);
                orientation = MIRROR_BOUNCE[orientation + mirror.laser_offset];
                dx = LASER_DIRECTION[orientation][0];
                dy = LASER_DIRECTION[orientation][1];
            } else {
                this.laser.set(x, y, this.laser.get(x, y) | (1 << orientation));
            }
        }
    }
}

export function valid_coordinates(x, y, width, height) {
    return (
        Number.isInteger(x) && Number.isInteger(y)
        && x >= 0 && x < width
        && y >= 0 && y < height
    );
}

export function ease_function(x) {
    const ALPHA = 1.5;
    let xa = Math.pow(x, ALPHA);
    let x2a = Math.pow(1.0 - x, ALPHA);
    return xa / (xa + x2a);
}
