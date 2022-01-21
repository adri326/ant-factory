import {valid_coordinates} from "./stage.js";

const DIRECTIONS = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0]
];

export class Network {
    constructor(tiles) {
        this.tiles = tiles;
        for (let tile of tiles) {
            tile.network = this;
        }
        this.active = false;
    }

    update() {
        this.active = false;
        for (let tile of this.tiles) {
            if (tile.is_input && tile.active) {
                this.active = true;
                break;
            }
        }
    }

    static from(stage, x, y, index) {
        // BFS search
        let res = [];
        let open = [[x, y, index]];
        let closed = new Set();

        function to_key(x, y, index) {
            return x + y * stage.width + index * stage.width * stage.height;
        }

        closed.add(to_key(x, y, index));

        while (open.length) {
            let [current_x, current_y, current_index] = open.shift();

            let current = stage.tiles.get(current_x, current_y)[current_index];
            res.push(current);

            let bit = 1;
            for (let n = 0; n < 4; n++) {
                if (current.connections & bit) {
                    let [dx, dy] = DIRECTIONS[n];
                    let index = 0;
                    for (let tile of stage.tiles.get(current_x + dx, current_y + dy) ?? []) {
                        let key = to_key(current_x + dx, current_y + dy, index);
                        if (
                            !closed.has(key)
                            && tile.parts === current.parts
                            && (tile.connections & (1 << ((n + 2) % 4)))
                        ) {
                            closed.add(key);
                            open.push([current_x + dx, current_y + dy, index]);
                            break;
                        }

                        index++;
                    }
                }
                bit <<= 1;
            }
        }

        return new Network(res);
    }
}
