import {CanvasManager, Tilemap} from "./renderer.js";
import {Stage, Tile, Connected} from "./stage.js";
import {Ant, register_ant_textures} from "./ant.js";

const manager = new CanvasManager(document.getElementById("canvas"));
window.manager = manager;

const tilemap = await Tilemap.from_url("resources/sprites.png");
window.tilemap = tilemap;

register_ant_textures(tilemap);

tilemap.add_texture("wall", {
    x: 0, y: 0,
    height: 3,
    dy: -2,
});

tilemap.add_texture("ground", {x: 2, y: 1});
tilemap.add_texture("edge", {x: 2, y: 2});

const TILE_WALL = new Tile("wall");
const TILE_EDGE = new Tile("edge");
const TILE_GROUND = new Tile("ground");

tilemap.add_texture("cable_blue", {x: 2, y: 5});
tilemap.add_texture("cable_blue_up", {x: 3, y: 5});
tilemap.add_texture("cable_blue_right", {x: 4, y: 5});
tilemap.add_texture("cable_blue_down", {x: 5, y: 5});
tilemap.add_texture("cable_blue_left", {x: 6, y: 5});

const TILES_CABLE_BLUE = [
    "cable_blue_up",
    "cable_blue_right",
    "cable_blue_down",
    "cable_blue_left"
];
const TILE_CABLE = new Connected("cable_blue", TILES_CABLE_BLUE, 0, false);

tilemap.add_texture("button_up", {x: 0, y: 5});
tilemap.add_texture("button_down", {x: 1, y: 5});
class Button extends Connected {
    constructor(parts, connected) {
        super("button_up", parts, connected, false);

        this.pressed = false;
    }

    get_textures() {
        let res = this.get_parts_textures();

        if (this.pressed) {
            res.push("button_down");
        } else {
            res.push("button_up");
        }

        return res;
    }

    static from(template, connections) {
        return new Button(template.parts, connections);
    }
}
const TILE_BUTTON = new Connected("button_up", TILES_CABLE_BLUE, 0);

tilemap.add_texture("door_open", {x: 0, y: 3});
tilemap.add_texture("door_closed", {x: 1, y: 3});
const TILE_DOOR = new Connected("door_closed", TILES_CABLE_BLUE, 0);

const stage = new Stage(tilemap, 8, 8);
for (let x = 0; x < 8; x++) {
    stage.tiles.set(x, 0, [TILE_WALL]);
    stage.tiles.set(x, 1, [TILE_GROUND]);
    stage.tiles.set(x, 2, [TILE_EDGE]);
}

stage.tiles.get(2, 0).push(Connected.from(TILE_DOOR));
stage.tiles.get(2, 1).push(Connected.from(TILE_CABLE, 1 | 4));
stage.tiles.set(2, 2, [TILE_GROUND, Connected.from(TILE_CABLE, 1 | 4)]);
stage.tiles.set(2, 3, [TILE_GROUND, Connected.from(TILE_CABLE, 1 | 4)]);
stage.tiles.set(2, 4, [TILE_GROUND, Connected.from(TILE_CABLE, 1 | 2)]);
stage.tiles.set(2, 5, [TILE_EDGE]);
stage.tiles.set(3, 4, [TILE_GROUND, Connected.from(TILE_CABLE, 2 | 8)]);
stage.tiles.set(3, 5, [TILE_EDGE]);
stage.tiles.set(4, 4, [TILE_GROUND, Connected.from(TILE_CABLE, 4 | 8)]);
stage.tiles.set(4, 5, [TILE_GROUND, Connected.from(TILE_CABLE, 1 | 4)]);
stage.tiles.set(4, 6, [TILE_GROUND, Button.from(TILE_BUTTON, 1)]);
stage.tiles.set(4, 7, [TILE_EDGE]);

stage.ants.push(new Ant(1, 1));

manager.currentDrawMethod = stage.draw.bind(stage);
