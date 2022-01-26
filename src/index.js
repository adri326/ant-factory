import {CanvasManager, Tilemap} from "./renderer.js";
import {Stage, PHEROMONE_HUD} from "./stage.js";
import tile from "./tile.js";
import {register_tile_textures} from "./tile.js";
import {Ant, register_ant_textures} from "./ant.js";
import {Network} from "./network.js";
import {Pheromone, register_pheromone_textures} from "./pheromone.js";
import {register_hud_textures, Hud} from "./hud.js";
import {register_item_textures} from "./item.js";

const manager = new CanvasManager(document.getElementById("canvas"));
window.manager = manager;

const tilemap = await Tilemap.from_url("resources/sprites.png");
window.tilemap = tilemap;

register_ant_textures(tilemap);
register_tile_textures(tilemap);
register_pheromone_textures(tilemap);
register_hud_textures(tilemap);
register_item_textures(tilemap);

let level_promises = [];
function load_level(name) {
    level_promises.push(Stage.from_url(tilemap, "levels/" + name + ".txt").then(stage => [name, stage]));
}

load_level("0-1");
load_level("0-2");
load_level("0-3");
load_level("0-4");

const LEVELS = window.LEVELS = new Map(await Promise.all(level_promises));

let stage = window.stage = LEVELS.get("0-4");

manager.current_draw_method = stage.draw.bind(stage);
manager.current_click_method = stage.on_click.bind(stage);
manager.fade_in();

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

let auto_pheromone = false;
let auto_play = false;
let push_ants = false;

let block_update = false;
function update(beforeupdate = () => {}) {
    if (block_update) return;
    manager.push_update(() => {
        stage.kill_ants();
        beforeupdate();
        stage.update();

        return function cleanup() {
            stage.cleanup();

            // Check if the player is on a warp
            let warp = stage.active_warp();
            if (warp) {
                let [level, tx, ty] = warp;

                // Initiate warp:
                block_update = true;
                // Clear the update buffer ~ sounds scary but it *should* be okay
                manager.updates = [];
                manager.fade_out(() => {
                    let previous_stage = stage;
                    stage = LEVELS.get(level);
                    let player = stage.current_ant();
                    if (tx !== null && ty !== null && player) {
                        player.x = tx;
                        player.y = ty;
                        player.direction = previous_stage.current_ant()?.direction ?? 0;
                    }
                    manager.current_draw_method = stage.draw.bind(stage);
                    manager.current_click_method = stage.on_click.bind(stage);

                    manager.fade_in(() => block_update = false);
                });
            }
        };
    });

    if (auto_play) scheduleUpdate();
}


window.addEventListener("keydown", (event) => {
    let player = stage.current_ant();

    function set_pheromone(direction) {
        let pheromone = stage.pheromone.get(player.x, player.y);
        if (pheromone) pheromone.direction = direction;
    }

    if (event.code === "ArrowUp" || event.code === "KeyW") {
        if (pheromone_hud.active && event.shiftKey) {
            update(() => set_pheromone(0));
        } else {
            update(() => {
                if (auto_pheromone && pheromone_hud.active) set_pheromone(0);
                player.move(0, -1, !push_ants);
            });
        }
    } else if (event.code === "ArrowDown" || event.code === "KeyS") {
        if (pheromone_hud.active && event.shiftKey) {
            update(() => set_pheromone(2));
        } else {
            update(() => {
                if (auto_pheromone && pheromone_hud.active) set_pheromone(2);
                player.move(0, 1, !push_ants);
            });
        }
    } else if (event.code === "ArrowLeft" || event.code === "KeyA") {
        if (pheromone_hud.active && event.shiftKey) {
            update(() => set_pheromone(3));
        } else {
            update(() => {
                if (auto_pheromone && pheromone_hud.active) set_pheromone(3);
                player.move(-1, 0, !push_ants);
            });
        }
    } else if (event.code === "ArrowRight" || event.code === "KeyD") {
        if (pheromone_hud.active && event.shiftKey) {
            update(() => set_pheromone(1));
        } else {
            update(() => {
                if (auto_pheromone && pheromone_hud.active) set_pheromone(1);
                player.move(1, 0, !push_ants);
            });
        }
    } else if (event.code === "Space") {
        stage.swap_ant();
    } else if (event.code === "KeyP") {
        toggle_pheromone();
    } else if (event.code === "KeyY") {
        push_ants = !push_ants;
    } else if (event.code === "Semicolon") {
        auto_play = !auto_play;
        if (auto_play) scheduleUpdate();
        else if (update_timeout) {
            clearTimeout(update_timeout);
            update_timeout = null;
        }
    } else if (event.code === "Period") {
        update();
    } else if (event.code === "KeyX" && pheromone_hud.active) {
        update(() => set_pheromone(-1));
    } else if (event.code === "KeyQ" && pheromone_hud.active) {
        auto_pheromone = !auto_pheromone;
    } else if (event.code === "KeyT" && pheromone_hud.active) {
        update(() => {
            let pheromone = stage.pheromone.get(player.x, player.y);
            if (!pheromone) return;
            pheromone.wait = !pheromone.wait;
            if (pheromone.wait && pheromone.direction === -1) pheromone.direction = 0;
        });
    }
});


let main_hud = new Hud(tilemap, 5, 1);
main_hud.set_component(0, 0, () => auto_play ? "hud_autoplay_pause" : "hud_autoplay_play", () => {
    auto_play = !auto_play;
    if (auto_play) scheduleUpdate();
    else if (update_timeout) {
        clearTimeout(update_timeout);
        update_timeout = null;
    }
}, "Let the simulation run without your input", () => auto_play);
main_hud.set_component(1, 0, "hud_wait", () => update(), "Wait one turn", false);
main_hud.set_component(2, 0, "hud_pheromone", toggle_pheromone, "Toggles the Pheromone overlay", () => stage.hud === PHEROMONE_HUD);
main_hud.set_component(3, 0, () => push_ants ? "hud_push_on" : "hud_push_off", () => push_ants = !push_ants, "Toggles pushing other ants", () => push_ants);

let pheromone_hud = new Hud(tilemap, 3, 3);
pheromone_hud.active = false;

function set_pheromone_dir(direction) {
    return () => {
        auto_pheromone = false;
        let player = stage.current_ant();
        if (!player) return;
        update(() => {
            let pheromone = stage.pheromone.get(player.x, player.y);
            if (!pheromone) return;
            pheromone.direction = direction
        });
    };
}

function pheromone_has_dir(direction) {
    return () => {
        let player = stage.current_ant();
        if (!player) return false;

        let pheromone = stage.pheromone.get(player.x, player.y);
        if (!pheromone) return false;

        return pheromone.direction === direction;
    };
}

pheromone_hud.set_component(1, 0, "hud_pheromone_up", set_pheromone_dir(0), "Set pheromone to up", pheromone_has_dir(0));
pheromone_hud.set_component(1, 2, "hud_pheromone_down", set_pheromone_dir(2), "Set pheromone to down", pheromone_has_dir(2));
pheromone_hud.set_component(0, 1, "hud_pheromone_left", set_pheromone_dir(3), "Set pheromone to left", pheromone_has_dir(3));
pheromone_hud.set_component(2, 1, "hud_pheromone_right", set_pheromone_dir(1), "Set pheromone to right", pheromone_has_dir(1));
pheromone_hud.set_component(1, 1, "hud_pheromone_auto", () => auto_pheromone = !auto_pheromone, "Set pheromone to your movement", () => auto_pheromone);
pheromone_hud.set_component(0, 0, "hud_pheromone_remove", set_pheromone_dir(-1), "Remove any pheromone");
pheromone_hud.set_component(0, 2, "hud_pheromone_wait", () => {
    let player = stage.current_ant();
    if (!player) return;
    update(() => {
        let pheromone = stage.pheromone.get(player.x, player.y);
        if (!pheromone) return;
        pheromone.wait = !pheromone.wait;
        if (pheromone.wait && pheromone.direction === -1) pheromone.direction = 0;
    });
}, "Set the instruction to wait on that tile for a turn", () => {
    let player = stage.current_ant();
    if (!player) return false;

    let pheromone = stage.pheromone.get(player.x, player.y);
    if (!pheromone) return false;

    return pheromone.wait;
});

function toggle_pheromone() {
    stage.toggle_hud(PHEROMONE_HUD);
    pheromone_hud.active = stage.hud === PHEROMONE_HUD;
}

manager.huds.push(main_hud);
manager.huds.push(pheromone_hud);
