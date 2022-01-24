import {valid_coordinates} from "./stage.js";
import {TILE_SIZE} from "./renderer.js";
import {DIRECTION_NAMES} from "./pheromone.js";

let HUD_BG = [];

export function register_hud_textures(tilemap) {
    let y = 0;
    for (let state of ["off", "on"]) {
        HUD_BG.push(`hud_left_${state}`);
        HUD_BG.push(`hud_corner_${state}`);
        HUD_BG.push(`hud_top_${state}`);
        HUD_BG.push(`hud_middle_${state}`);

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

    tilemap.add_texture("hud_autoplay_pause", {x: 10, y: 2});
    tilemap.add_texture("hud_autoplay_play", {x: 11, y: 2});

    tilemap.add_texture("hud_wait", {x: 10, y: 3});
}

const ZOOM = Math.pow(2, 2);

const SIDE_LEFT = 0;
const SIDE_CORNER = 1;
const SIDE_TOP = 2;
const SIDE_MIDDLE = 3;

function get_hud_texture(side, state) {
    return HUD_BG[side + state * 4];
}

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
        };

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
                    side = x === 0 ? SIDE_CORNER : SIDE_TOP;
                } else {
                    side = x === 0 ? SIDE_LEFT : SIDE_MIDDLE;
                }

                if (typeof state === "function") state = !!state();
                if (typeof texture === "function") texture = texture();

                tilemap.draw(ctx, get_hud_texture(side, state || hovered), vx, vy, tile_size);
                tilemap.draw(ctx, texture, vx, vy, tile_size);
            }
        }

        return get_visual_pos(0, 0);
    }

    on_click(corner_x, corner_y, mouse_x, mouse_y) {
        let tile_size = TILE_SIZE * ZOOM;
        const get_visual_pos = (x, y) => {
            return [
                corner_x - (this.width - x) * tile_size,
                corner_y - (this.height - y) * tile_size,
            ];
        };

        let [tx, ty] = get_visual_pos(0, 0);

        let x = Math.floor((mouse_x - tx) / tile_size);
        let y = Math.floor((mouse_y - ty) / tile_size);

        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            let [texture, cb, state, text] = this.components[x + y * this.width];
            cb(state);
        }

        return get_visual_pos(0, 0);
    }
}
