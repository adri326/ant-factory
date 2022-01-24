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

let level_promises = [];
function load_level(name) {
    level_promises.push(Stage.from_url(tilemap, "levels/" + name + ".txt").then(stage => [name, stage]));
}

load_level("0-1");
load_level("0-2");
load_level("0-3");

const LEVELS = window.LEVELS = new Map(await Promise.all(level_promises));

const stage = window.stage = LEVELS.get("0-3");

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

let autoplay = false;

function update(beforeupdate = () => {}) {
    manager.push_update(() => {
        stage.kill_ants();
        beforeupdate();
        stage.update();
        return stage.cleanup.bind(stage);
    });

    if (autoplay) scheduleUpdate();
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
    } else if (event.key === ".") {
        update();
    }
});

manager.currentDrawMethod = stage.draw.bind(stage);

let main_hud = new Hud(tilemap, 5, 1);
main_hud.set_component(2, 0, "hud_pheromone", toggle_pheromone, "Toggles the Pheromone overlay", () => stage.hud === PHEROMONE_HUD);
main_hud.set_component(0, 0, () => autoplay ? "hud_autoplay_pause" : "hud_autoplay_play", () => {
    autoplay = !autoplay;
    if (autoplay) scheduleUpdate();
}, "Let the simulation run without your input", () => autoplay);
main_hud.set_component(1, 0, "hud_wait", () => update(), "Wait one turn", false);

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
