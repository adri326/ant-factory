export const TILE_SIZE = 16;

export class CanvasManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.ctx.imageSmoothingEnabled = false;
        window.addEventListener("resize", this.resize.bind(this));
        this.resize();
        this.scheduled_draw = false;

        this._animations = true;
        this.windowblurred = false;

        window.addEventListener("blur", () => {
            this.windowblurred = true;
        });

        window.addEventListener("focus", () => {
            this.windowblurred = false;
        });

        // Works like a mutex:
        // push_update() is equivalent to P(mutex) and pop_update() is equivalent to V(mutex)
        // updates contains an array of functions: the first element is the update that just happened and that is currently being played on screen
        // The other elements are updates that have been queued.
        // Before the update is played on the screen, it is first applied (the function is called), and its result is stored in its place
        // Once the animation is finished, the cleanup function (returned by the update function) is called, if any, and the process repeats
        //
        // This can be schematized as:
        // In CanvasManager::push_update():
        //      P(mutex)
        //      update()
        // In CanvasManager::pop_update():
        //      V(mutex)
        //      cleanup()
        this.updates = [];

        this.currentDrawMethod = (ctx, width, height, manager) => {};
    }

    get animations() {
        return !this.windowblurred && this._animations;
    }

    set animations(value) {
        this._animations = value;
        return !this.windowblurred && this._animations;
    }

    resize() {
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
        this.ctx.imageSmoothingEnabled = false;
        this.scheduleDraw();
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        this.currentDrawMethod(this.ctx, this.width, this.height, this);

        this.scheduleDraw();
    }

    pop_update() {
        if (this.updates.length > 0) {
            if (typeof this.updates[0] === "function") this.updates[0]();
            this.updates.shift();
            if (this.updates.length > 0) {
                this.updates[0] = this.updates[0]();
            }
        }
    }

    push_update(update) {
        if (!this.animations) {
            let cb = update() || (() => {});
            cb();
            return;
        }

        if (this.updates.length === 0 || !this.animations) {
            this.updates.push(update());
        } else {
            this.updates.push(update);
        }
    }

    scheduleDraw() {
        if (!this.scheduled_draw) {
            this.scheduled_draw = true;
            window.requestAnimationFrame(() => {
                this.scheduled_draw = false;
                this.draw();
            });
        }
    }

    get width() {
        return this.canvas.width;
    }

    get height() {
        return this.canvas.height;
    }
}

export class Tilemap {
    constructor(image, textures = new Map()) {
        this.image = image;
        this.textures = textures;
    }

    add_texture(name, options) {
        this.textures.set(name, {
            width: 1,
            height: 1,
            dx: 0,
            dy: 0,
            ...options
        });
    }

    draw(ctx, texture_name, x, y, tile_size) {
        let options = this.textures.get(texture_name);

        if (!options) return;

        let from_x = x + options.dx * tile_size;
        let from_y = y + options.dy * tile_size;
        let to_x = from_x + options.width * tile_size;
        let to_y = from_y + options.height * tile_size;
        ctx.drawImage(
            this.image,
            options.x * TILE_SIZE,
            options.y * TILE_SIZE,
            options.width * TILE_SIZE,
            options.height * TILE_SIZE,
            Math.round(from_x),
            Math.round(from_y),
            Math.round(to_x) - Math.round(from_x),
            Math.round(to_y) - Math.round(from_y),
        );
    }

    static from_url(url, textures = new Map()) {
        return new Promise((resolve, reject) => {
            let image = document.createElement("img");
            image.onload = () => resolve(new Tilemap(image, textures));
            image.onerror = (err) => reject(err);
            image.src = url;
        });
    }
}
