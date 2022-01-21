// import {Tile} from "./tile.js";
import {valid_coordinates} from "./stage.js";

export function register_ant_textures(tilemap) {
    tilemap.add_texture("ant_shadow_player", {x: 5, y: 0});
    tilemap.add_texture("ant_shadow", {x: 5, y: 1});
    tilemap.add_texture("ant", {x: 6, y: 1});
}

export class Ant {
    constructor(x, y, stage = null) {
        this.x = x;
        this.y = y;

        this.stage = stage;
    }

    draw(ctx, tilemap, vx, vy, tile_size, player) {
        tilemap.draw(ctx, player ? "ant_shadow_player" : "ant_shadow", vx, vy, tile_size);
        tilemap.draw(ctx, "ant", vx, vy, tile_size);
    }

    move(dx, dy) {
        if (!this.stage) return;
        if (this.stage.is_passable(this.x + dx, this.y + dy)) {
            let swap_ant = this.stage.ants.find(ant => ant.x === this.x + dx && ant.y === this.y + dy);
            if (swap_ant) {
                swap_ant.x = this.x;
                swap_ant.y = this.y;
            }
            this.x += dx;
            this.y += dy;
        }
    }
}
