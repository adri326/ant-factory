import {TILE_SIZE} from "./renderer.js";
// import {Ant} from "./ant.js";

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
    }

    draw(ctx, width, height) {
        ctx.fillStyle = "#080808";
        ctx.fillRect(0, 0, width, height);
        let tile_size = TILE_SIZE * Math.ceil(Math.pow(2, this.zoom));
        for (let y = 0; y < this.height; y++) {
            let vy = y * tile_size - this.height * tile_size / 2 + this.cy + height / 2;
            for (let x = 0; x < this.width; x++) {
                let vx = x * tile_size - this.width * tile_size / 2 + this.cx + width / 2;

                let stack = this.tiles.get(x, y);
                for (let tile of stack) {
                    for (let texture of tile.get_textures()) {
                        this.tilemap.draw(ctx, texture, vx, vy, tile_size);
                    }
                }
            }

            let index = 0;
            for (let ant of this.ants) {
                if (ant.y === y) {
                    let vx = ant.x * tile_size - this.width * tile_size / 2 + this.cx + width / 2;
                    ant.draw(ctx, this.tilemap, vx, vy, tile_size, index === this.player_index);
                }
                index++;
            }
        }
    }

    update() {
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
}

export function valid_coordinates(x, y, width, height) {
    return (
        Number.isInteger(x) && Number.isInteger(y)
        && x >= 0 && x < width
        && y >= 0 && y < height
    );
}
