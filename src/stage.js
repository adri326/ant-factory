import {TILE_SIZE} from "./renderer.js";
// import {Ant} from "./ant.js";

export class Tile {
    constructor(texture_name) {
        this.texture_name = texture_name;
    }

    get_textures() {
        return [this.texture_name];
    }
}

export class Connected extends Tile {
    constructor(texture_name, parts, connections, cables_underneath = true) {
        super(texture_name);

        this.parts = parts;
        this.connections = connections;
        this.cables_underneath = cables_underneath;
    }

    get_parts_textures() {
        let res = [];

        let bit = 1;
        for (let part of this.parts) {
            if (this.connections & bit) {
                res.push(part);
            }
            bit <<= 1;
        }

        return res;
    }

    get_textures() {
        let res = this.get_parts_textures();

        if (this.cables_underneath) {
            res.push(this.texture_name);
        } else {
            res.unshift(this.texture_name);
        }

        return res;
    }

    static from(template, connections) {
        return new Connected(template.texture_name, template.parts, connections, template.cables_underneath);
    }
}

export const TILE_VOID = new Tile(2, 3);

export class Grid {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.tiles = new Array(width * height).fill(null);
    }

    get(x, y) {
        if (validCoordinates(x, y, this.width, this.height)) {
            return this.tiles[x + y * this.width] ?? [];
        } else {
            return [];
        }
    }

    set(x, y, tile) {
        if (validCoordinates(x, y, this.width, this.height)) {
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

            for (let ant of this.ants) {
                if (ant.y === y) {
                    let vx = ant.x * tile_size - this.width * tile_size / 2 + this.cx + width / 2;
                    ant.draw(ctx, this.tilemap, vx, vy, tile_size);
                }
            }
        }
    }
}

function validCoordinates(x, y, width, height) {
    return (
        Number.isInteger(x) && Number.isInteger(y)
        && x >= 0 && x < width
        && y >= 0 && y < height
    );
}
