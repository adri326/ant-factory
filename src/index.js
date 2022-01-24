import {CanvasManager, Tilemap} from "./renderer.js";
import {Stage, PHEROMONE_HUD} from "./stage.js";
import tile from "./tile.js";
import {Ant, register_ant_textures} from "./ant.js";
import {Network} from "./network.js";
import {Pheromone, register_pheromone_textures} from "./pheromone.js";
import {register_hud_textures, Hud} from "./hud.js";

const manager = new CanvasManager(document.getElementById("canvas"));
window.manager = manager;

const tilemap = await Tilemap.from_url("resources/sprites.png");
window.tilemap = tilemap;

register_ant_textures(tilemap);
tile.register_tile_textures(tilemap);
register_pheromone_textures(tilemap);
register_hud_textures(tilemap);

const stage = new Stage(tilemap, 8, 8);
window.stage = stage;

function place(x, y, tile) {
    let stack = stage.tiles.get(x, y);
    if (stack) {
        stack.push(tile);
    } else {
        throw new Error("Can't place tile at (" + x + ", " + y + ")!");
    }
}

place(0, 0, tile("wall"));

for (let x = 0; x < 8; x++) {
    place(x, 0, tile("wall"));
    place(x, 1, tile("ground"));
    place(x, 2, tile("ground"));
    place(x, 3, tile("ground"));
    place(x, 4, tile("ground"));
    place(x, 5, tile("edge"));
}

place(2, 0, tile("door_blue", 0b0100));
place(2, 1, tile("cable_blue", 0b0111));
place(3, 1, tile("laser_blue", 0b1000, 0));
place(7, 1, tile("mirror_blue", 0b0000, false));

place(2, 2, tile("ground"));
place(2, 2, tile("cable_blue", 0b0101));

place(2, 3, tile("ground"));
place(2, 3, tile("cable_blue", 0b0101));

place(2, 4, tile("ground"));
place(2, 4, tile("cable_blue", 0b0011));
place(2, 5, tile("edge"));

place(3, 4, tile("ground"));
place(3, 4, tile("cable_blue", 0b1010));
place(3, 5, tile("edge"));

place(4, 4, tile("ground"));
place(4, 4, tile("cable_blue", 0b1100));

place(4, 5, tile("ground"));
place(4, 5, tile("cable_blue", 0b0101));

place(4, 6, tile("ground"));
let button = tile("button_blue", 0b0001);
place(4, 6, button);
place(4, 7, tile("edge"));

place(3, 2, tile("ground"));
place(3, 3, tile("ground"));
place(4, 2, tile("spike", true));
place(4, 3, tile("spike"));

place(1, 4, tile("fence", 0b0101));
place(1, 3, tile("fence", 0b0110));
place(2, 3, tile("fence", 0b1010));
place(3, 3, tile("fence", 0b1000));

place(5, 3, tile("fence", 0b0010));
place(6, 3, tile("fence", 0b1100));
place(6, 4, tile("fence", 0b0001));


stage.ants.push(new Ant(0, 4, stage));
stage.ants.push(new Ant(3, 2, stage));
stage.ants.push(new Ant(5, 2, stage));

// stage.pheromone.get(2, 1).direction = 2;
// stage.pheromone.get(2, 2).direction = 2;
// stage.pheromone.get(2, 3).direction = 2;
// stage.pheromone.get(2, 4).direction = 1;
// stage.pheromone.get(3, 4).direction = 1;
// stage.pheromone.get(4, 4).direction = 2;
// stage.pheromone.get(4, 5).direction = 2;

let network = Network.from(stage, 4, 6, 1);
stage.networks.push(network);

let update_timeout = null;
function scheduleUpdate() {
    if (update_timeout) {
        clearTimeout(update_timeout);
    }

    update_timeout = setTimeout(() => {
        update_timeout = null;
        update();
    }, 1000);
}

function update(beforeupdate = () => {}) {
    manager.push_update(() => {
        stage.kill_ants();
        beforeupdate();
        stage.update();
        return stage.cleanup.bind(stage);
    });

    scheduleUpdate();
}


window.addEventListener("keydown", (event) => {
    let player = stage.current_ant();

    if (event.key === "ArrowUp") {
        update(() => player.move(0, -1));
    } else if (event.key === "ArrowDown") {
        update(() => player.move(0, 1));
    } else if (event.key === "ArrowLeft") {
        update(() => player.move(-1, 0));
    } else if (event.key === "ArrowRight") {
        update(() => player.move(1, 0));
    } else if (event.key === " ") {
        stage.swap_ant();
    } else if (event.key === "p") {
        toggle_pheromone();
    }
});

manager.currentDrawMethod = stage.draw.bind(stage);

let main_hud = new Hud(tilemap, 4, 1);
main_hud.set_component(1, 0, "hud_pheromone", toggle_pheromone, "Toggles the Pheromone overlay", () => stage.hud === PHEROMONE_HUD);

let pheromone_hud = new Hud(tilemap, 3, 3);
pheromone_hud.active = false;

function set_pheromone_dir(direction) {
    return () => {
        let player = stage.current_ant();
        let pheromone = stage.pheromone.get(player.x, player.y);
        if (!pheromone) return;
        update(() => pheromone.direction = direction);
    };
}

pheromone_hud.set_component(1, 0, "hud_pheromone_up", set_pheromone_dir(0), "Set pheromone to up");
pheromone_hud.set_component(1, 2, "hud_pheromone_down", set_pheromone_dir(2), "Set pheromone to down");
pheromone_hud.set_component(0, 1, "hud_pheromone_left", set_pheromone_dir(3), "Set pheromone to left");
pheromone_hud.set_component(2, 1, "hud_pheromone_right", set_pheromone_dir(1), "Set pheromone to right");
pheromone_hud.set_component(1, 1, "hud_pheromone_auto", () => {}, "Set pheromone to your movement");
pheromone_hud.set_component(0, 0, "hud_pheromone_remove", () => {}, "Remove any pheromone");

function toggle_pheromone() {
    stage.toggle_hud(PHEROMONE_HUD);
    pheromone_hud.active = stage.hud === PHEROMONE_HUD;
}

manager.huds.push(main_hud);
manager.huds.push(pheromone_hud);
