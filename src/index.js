import {CanvasManager, Tilemap} from "./renderer.js";
import {Stage} from "./stage.js";
import tile from "./tile.js";
import {Ant, register_ant_textures} from "./ant.js";
import {Network} from "./network.js";

const manager = new CanvasManager(document.getElementById("canvas"));
window.manager = manager;

const tilemap = await Tilemap.from_url("resources/sprites.png");
window.tilemap = tilemap;

register_ant_textures(tilemap);
tile.register_tile_textures(tilemap);

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
    place(x, 2, tile("edge"));
}

place(2, 0, tile("door_blue", 0b0100));
place(2, 1, tile("cable_blue", 0b0101));

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

stage.ants.push(new Ant(1, 1, stage));
stage.ants.push(new Ant(3, 1, stage));
stage.ants.push(new Ant(4, 1, stage));

let network = Network.from(stage, 4, 6, 1);
stage.networks.push(network);

let update_scheduled = false;
function update() {
    stage.update();
    manager.scheduleDraw();

    if (!update_scheduled) {
        setTimeout(() => {
            update();
            update_scheduled = false;
        }, 1000);
        update_scheduled = true;
    }
}

window.addEventListener("keydown", (event) => {
    let player = stage.current_ant();

    if (event.key === "ArrowUp") {
        player.move(0, -1);
        update();
    } else if (event.key === "ArrowDown") {
        player.move(0, 1);
        update();
    } else if (event.key === "ArrowLeft") {
        player.move(-1, 0);
        update();
    } else if (event.key === "ArrowRight") {
        player.move(1, 0);
        update();
    } else if (event.key === " ") {
        stage.swap_ant();
    }
});

manager.currentDrawMethod = stage.draw.bind(stage);
