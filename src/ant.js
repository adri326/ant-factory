import {Tile} from "./stage.js";

export function register_ant_textures(tilemap) {
    tilemap.add_texture("ant_shadow", {x: 5, y: 1});
    tilemap.add_texture("ant", {x: 6, y: 1});
}

export class Ant {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    draw(ctx, tilemap, vx, vy, tile_size) {
        tilemap.draw(ctx, "ant_shadow", vx, vy, tile_size);
        tilemap.draw(ctx, "ant", vx, vy, tile_size);
    }
}
