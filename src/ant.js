// import {Tile} from "./tile.js";
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
    }
}

const DIRECTION_NAMES = [
    "up",
    "right",
    "down",
    "left"
];

const DIRECTIONS = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0]
];

const WALK_ANIMATION = [1, 0, 2, 0];
const ANIMATION_FWD_MOD = 2;
const ANIMATION_STEP = 1.0 / 8 / 2;
const FWD_DISTANCE = 1/8;

export class Ant {
    constructor(x, y, stage = null) {
        this.x = x;
        this.y = y;
        this.direction = 0;
        this.moving = false;

        this.stage = stage;
    }

    draw(ctx, tilemap, vx, vy, tile_size, player, animation) {
        if (animation == 0.0 || !this.moving) {
            tilemap.draw(ctx, player ? "ant_shadow_player" : "ant_shadow", vx, vy, tile_size);
            tilemap.draw(ctx, `ant_${DIRECTION_NAMES[this.direction]}_0`, vx, vy, tile_size);
        } else {
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
                `ant_${DIRECTION_NAMES[this.direction]}_${WALK_ANIMATION[step % WALK_ANIMATION.length]}`,
                vx + dx * (forward_ant - 1.0),
                vy + dy * (forward_ant - 1.0),
                tile_size
            );
        }
    }

    move(dx, dy, swap = true) {
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
            if (swap_ant && swap) {
                swap_ant.x = this.x;
                swap_ant.y = this.y;
                swap_ant.direction = (this.direction + 2) % 4;
                swap_ant.moving = true;
            } else if (swap_ant) {
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
