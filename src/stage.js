import {TILE_SIZE} from "./renderer.js";
// import {Ant} from "./ant.js";
import {Pheromone} from "./pheromone.js";
import {Spike} from "./tile.js";

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
                let pheromone = this.pheromone.get(x, y);

                if (pheromone) {
                let vx = get_vx(x);
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
    }

    cleanup() {
        for (let ant of this.ants) {
            if (ant.spiked) {
                let tiles = this.tiles.get(ant.x, ant.y);
                for (let tile of tiles) {
                    if (tile instanceof Spike) {
                        tile.jammed = true;
                    }
                }
                this.ants.splice(this.ants.indexOf(ant), 1);
            }
        }

        for (let ant of this.ants) {
            ant.moving = false;
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
