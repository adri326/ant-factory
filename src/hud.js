import {valid_coordinates} from "./stage.js";
import {TILE_SIZE} from "./renderer.js";
import {DIRECTION_NAMES} from "./pheromone.js";

export function register_hud_textures(tilemap) {
    let y = 0;
    for (let state of ["off", "on"]) {
        tilemap.add_texture(`hud_left_${state}`, {x: 10, y});
        tilemap.add_texture(`hud_corner_${state}`, {x: 11, y});
        tilemap.add_texture(`hud_top_${state}`, {x: 12, y});
        tilemap.add_texture(`hud_middle_${state}`, {x: 13, y});

        y++;
    }

    tilemap.add_texture(`hud_pheromone`, {x: 12, y: 2});

    for (let n = 0; n < 4; n++) {
        tilemap.add_texture(`hud_pheromone_${DIRECTION_NAMES[n]}`, {x: 12, y: 3 + n});
    }

    tilemap.add_texture("hud_pheromone_auto", {x: 12, y: 7});
    tilemap.add_texture("hud_pheromone_remove", {x: 11, y: 7});
}

const ZOOM = Math.pow(2, 2);

export class Hud {
    constructor(tilemap, width, height) {
        this.active = true;
        this.tilemap = tilemap;
        this.components = new Array(width * height).fill(null).map(_ => ["", () => {}, false, ""]);
        this.width = width;
        this.height = height;
    }

    set_component(x, y, texture, onclick, text, active = false) {
        if (valid_coordinates(x, y, this.width, this.height)) {
            this.components[x + y * this.width] = [texture, onclick, active, text];
        }
    }

    draw(ctx, corner_x, corner_y, mouse_x, mouse_y) {
        let tile_size = TILE_SIZE * ZOOM;
        const get_visual_pos = (x, y) => {
            return [
                corner_x - (this.width - x) * tile_size,
                corner_y - (this.height - y) * tile_size,
            ];
        }

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                let [vx, vy] = get_visual_pos(x, y);
                let hovered = mouse_x >= vx && mouse_y >= vy && mouse_x < vx + tile_size && mouse_y < vy + tile_size;
                let [texture, cb, state, text] = this.components[x + y * this.width];

                if (hovered && text.length) {
                    ctx.fillStyle = "#d0d0d0";
                    ctx.textAlign = "right";
                    ctx.textBaseline = "bottom";
                    ctx.font = `${tile_size / 2}px monospace`;
                    let [tx, ty] = get_visual_pos(0, y + 1)
                    ctx.fillText(text, tx - tile_size / 4, ty - tile_size / 8);
                }

                let side;
                if (y === 0) {
                    side = x === 0 ? "corner" : "top";
                } else {
                    side = x === 0 ? "left" : "middle";
                }

                if (typeof state === "function") state = !!state();

                tilemap.draw(ctx, `hud_${side}_${state || hovered ? "on" : "off"}`, vx, vy, tile_size);
                tilemap.draw(ctx, texture, vx, vy, tile_size);
            }
        }

        return get_visual_pos(0, 0);
    }
}
