import {DIRECTION_NAMES, DIRECTIONS} from "./tile.js";
import {valid_coordinates} from "./stage.js";
import {TILE_SIZE} from "./renderer.js";

export function register_ant_textures(tilemap) {
    tilemap.add_texture("ant_shadow", {x: 4, y: 0});
    tilemap.add_texture("ant_shadow_player", {x: 5, y: 0});

    for (let n = 0; n < 3; n++) {
        tilemap.add_texture("ant_up_" + n, {x: 4, y: 1 + n});
        tilemap.add_texture("ant_right_" + n, {x: 5, y: 1 + n});
        tilemap.add_texture("ant_down_" + n, {x: 6, y: 1 + n});
        tilemap.add_texture("ant_left_" + n, {x: 7, y: 1 + n});
        tilemap.add_texture("ant_spiked_" + n, {x: 8, y: 1 + n});
        tilemap.add_texture("ant_laser_" + n, {x: 9, y: 1 + n});
    }
}

const WALK_ANIMATION = [1, 0, 2, 0];
const ANIMATION_FWD_MOD = 2;
const ANIMATION_STEP = 1.0 / 8 / 2;
const FWD_DISTANCE = 1/8;

const ANT_WALK_STEPS = 3;
let ANT_WALK_TEXTURES = [];
let ANT_SPIKED_TEXTURES = [];
let ANT_LASER_TEXTURES = [];

for (let dir = 0; dir < DIRECTION_NAMES.length; dir++) {
    for (let step = 0; step < ANT_WALK_STEPS; step++) {
        ANT_WALK_TEXTURES.push(`ant_${DIRECTION_NAMES[dir]}_${step}`);
    }
}

for (let n = 0; n < 3; n++) {
    ANT_SPIKED_TEXTURES.push(`ant_spiked_${n}`);
    ANT_LASER_TEXTURES.push(`ant_laser_${n}`);
}

function get_walk_texture(direction, step) {
    return ANT_WALK_TEXTURES[direction * ANT_WALK_STEPS + step];
}

export class Ant {
    constructor(x, y, stage = null) {
        this.x = x;
        this.y = y;
        this.direction = 0;
        this.moving = false;
        this.spiked = false;

        this.stage = stage;
    }

    draw(ctx, tilemap, vx, vy, tile_size, player, animation) {
        if (this.moving && animation > 0.0) {
            let step = Math.floor(animation / ANIMATION_STEP);
            let forward_ant = Math.floor((step + 1) / ANIMATION_FWD_MOD) * FWD_DISTANCE;
            let forward_shadow = (step + 1) * ANIMATION_STEP;
            let [dx, dy] = DIRECTIONS[this.direction];

            dx *= tile_size;
            dy *= tile_size;

            tilemap.draw(
                ctx,
                player ? "ant_shadow_player" : "ant_shadow",
                vx + dx * (forward_shadow - 1.0),
                vy + dy * (forward_shadow - 1.0),
                tile_size
            );
            tilemap.draw(
                ctx,
                get_walk_texture(this.direction, WALK_ANIMATION[step % WALK_ANIMATION.length]),
                vx + dx * (forward_ant - 1.0),
                vy + dy * (forward_ant - 1.0),
                tile_size
            );
        } else if (this.spiked && animation > 0.0) {
            let step = Math.floor(animation * 4);
            if (step === 0) {
                tilemap.draw(ctx, "ant_up_0", vx, vy, tile_size);
            } else {
                step = Math.min(step - 1, 2);
                tilemap.draw(ctx, ANT_SPIKED_TEXTURES[step], vx, vy, tile_size);
            }
        } else if (this.laser && animation > 0.0) {
            let step = Math.floor(animation * 4);
            if (step === 0) {
                tilemap.draw(ctx, "ant_up_0", vx, vy, tile_size);
            } else {
                step = Math.min(step - 1, 2);
                tilemap.draw(ctx, ANT_LASER_TEXTURES[step], vx, vy, tile_size);
            }
        } else {
            tilemap.draw(ctx, player ? "ant_shadow_player" : "ant_shadow", vx, vy, tile_size);
            tilemap.draw(ctx, get_walk_texture(this.direction, 0), vx, vy, tile_size);
        }
    }

    get can_move() {
        return !this.spiked && !this.laser && !this.moving;
    }

    move(dx, dy, swap = true) {
        if (!this.can_move) return;

        if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0) this.direction = 1;
            else this.direction = 3;
        } else {
            if (dy > 0) this.direction = 2;
            else this.direction = 0;
        }
        if (!this.stage) return;
        if (this.stage.is_passable(this.x + dx, this.y + dy)) {
            let swap_ant = this.stage.ants.find(ant => ant.x === this.x + dx && ant.y === this.y + dy);
            if (swap_ant && swap_ant.can_move) {
                if (swap) {
                    swap_ant.x = this.x;
                    swap_ant.y = this.y;
                    swap_ant.direction = (this.direction + 2) % 4;
                    swap_ant.moving = true;
                } else {
                    let x2 = this.x + dx * 2;
                    let y2 = this.y + dy * 2;
                    // Cannot push more than one ant
                    if (this.stage.ants.some(ant => ant.x === x2 && ant.y === y2)) return;
                    // Cannot push an ant onto an impassable space
                    if (!this.stage.is_passable(x2, y2)) return;

                    swap_ant.x = x2;
                    swap_ant.y = y2;
                    swap_ant.direction = this.direction;
                    swap_ant.moving = true;
                }
            } else if (swap_ant) {
                // Cannot push/swap with an ant that cannot move
                return;
            }
            this.x += dx;
            this.y += dy;
            this.moving = true;

        }
    }

    ai(stage, index) {
        let pheromone = stage.pheromone.get(this.x, this.y);
        if (!pheromone) return; // Do nothing

        if (pheromone.direction >= 0 && !this.moving) {
            this.move(...DIRECTIONS[pheromone.direction], false);
        }
    }
}
