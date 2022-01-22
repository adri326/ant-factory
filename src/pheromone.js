import {TILE_SIZE} from "./renderer.js";

export const DIRECTION_NAMES = [
    "up",
    "right",
    "down",
    "left"
];

export const N_PHEROMONES = 8;
export const PHEROMONE_FREQ = 1/8000;
export const PHEROMONE_AMP = 4;

const PERLIN_COS = Math.random();
const PERLIN_SIN = 2 + Math.random();

const HUD_FREQ = 4 * Math.PI;
const HUD_AMP = 0.5;

export function register_pheromone_textures(tilemap) {
    for (let n = 0; n < N_PHEROMONES; n++) {
        tilemap.add_texture("pheromone_" + n, {x: 15, y: n});
    }

    for (let n = 0; n < 4; n++) {
        tilemap.add_texture(`pheromone_${DIRECTION_NAMES[n]}`, {x: 14, y: 2 + n});
        tilemap.add_texture(`pheromone_${DIRECTION_NAMES[n]}_small`, {x: 13, y: 2 + n});
    }

    tilemap.add_texture("pheromone_overlay_a", {x: 14, y: 0});
    tilemap.add_texture("pheromone_overlay_b", {x: 14, y: 1});
    tilemap.add_texture("pheromone_wait", {x: 14, y: 6});
}

export class Pheromone {
    constructor(direction = -1, wait = false) {
        this.direction = direction;
        this.wait = wait;

        this.offsets = [];
        this.amplitudes = [];
        this.frequencies = [];
        this.textures = [];

        let textures = new Array(N_PHEROMONES).fill(0).map((_, i) => i);

        for (let n = 0; n < 3; n++) {
            let index = Math.floor(Math.random() * textures.length);
            this.textures.push("pheromone_" + textures[index]);
            let angle = Math.random() * 2 * Math.PI;
            this.amplitudes.push([Math.cos(angle), Math.sin(angle)]);
            this.frequencies.push((1 + Math.random()) * 2 * Math.PI);
            this.offsets.push(Math.random() * this.frequencies[n]);

            textures.splice(index, 1);
        }
    }

    draw(ctx, tilemap, vx, vy, tile_size, hud = false) {
        function random(x, t, a, o = 0.0) {
            return Math.round(perlin.get(x + o, (t + o) * PHEROMONE_FREQ) * a * PHEROMONE_AMP) / TILE_SIZE * tile_size;
        }

        if (this.direction === -1) return;
        let t = Date.now();

        if (hud) {
            let dx1 = random(PERLIN_COS, t * HUD_FREQ, HUD_AMP, this.offsets[0] ?? 0.0);
            let dx2 = random(PERLIN_SIN, t * HUD_FREQ, HUD_AMP, this.offsets[1] ?? 0.0);
            tilemap.draw(ctx, "pheromone_overlay_a", vx + dx1, vy, tile_size);
            tilemap.draw(ctx, "pheromone_overlay_b", vx + dx2, vy, tile_size);

            if (this.direction >= 0) {
                if (this.wait) {
                    tilemap.draw(ctx, `pheromone_${DIRECTION_NAMES[this.direction]}_small`, vx, vy, tile_size);
                    tilemap.draw(ctx, `pheromone_wait`, vx, vy, tile_size)
                } else {
                    tilemap.draw(ctx, `pheromone_${DIRECTION_NAMES[this.direction]}`, vx, vy, tile_size);
                }
            }
        } else {
            for (let n = 0; n < this.textures.length; n++) {
                let [ax, ay] = this.amplitudes[n];
                let dx = random(PERLIN_COS, t * this.frequencies[n], ax, this.offsets[n]);
                let dy = random(PERLIN_SIN, t * this.frequencies[n], ay, this.offsets[n]);
                tilemap.draw(ctx, this.textures[n], vx + dx, vy + dy, tile_size);
            }
        }
    }
}
