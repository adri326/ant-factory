export const TILE_SIZE = 16;

export const FADEOUT_DURATION = 250;
export const FADEIN_DURATION = 250;

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

        this.current_draw_method = (ctx, width, height, manager) => {};
        this.current_click_method = (x, y, width, height, manager) => {};

        this.huds = [];
        this.mouse_x = 0;
        this.mouse_y = 0;

        this.canvas.addEventListener("mousemove", (event) => {
            this.mouse_x = event.clientX;
            this.mouse_y = event.clientY;
        });

        this.canvas.addEventListener("mousedown", (event) => {
            this.mouse_x = event.clientX;
            this.mouse_y = event.clientY;
            this.on_click();
        });

        this.fade_callback = null;
        this.fade = 0;
        this.fadein = false;
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

        this.current_draw_method(this.ctx, this.width, this.height, this);

        if (Date.now() - this.fade < FADEOUT_DURATION) {
            let alpha = (Date.now() - this.fade) / FADEOUT_DURATION;
            if (this.fadein) alpha = 1 - alpha;
            alpha = ease_function(alpha);

            this.ctx.fillStyle = `rgba(8, 8, 8, ${alpha})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        } else if (typeof this.fade_callback === "function") {
            if (!this.fadein) {
                this.ctx.fillStyle = `#080808`;
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            }
            let callback = this.fade_callback;
            this.fade_callback = null;
            callback(this);
        }

        let y = this.canvas.height;
        for (let n = 0; n < this.huds.length; n++) {
            if (!this.huds[n].active) continue;
            let res = this.huds[n].draw(this.ctx, this.canvas.width, y, this.mouse_x, this.mouse_y);
            y = res[1];
        }

        this.scheduleDraw();
    }

    on_click() {
        let y = this.canvas.height;
        for (let n = 0; n < this.huds.length; n++) {
            if (!this.huds[n].active) continue;
            let res = this.huds[n].on_click(this.canvas.width, y, this.mouse_x, this.mouse_y);
            y = res[1];
        }
        this.current_click_method(this.mouse_x, this.mouse_y, this.width, this.height, this);
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

    fade_out(callback = (() => {})) {
        this.fade_callback = callback;
        this.fade = Date.now();
        this.fadein = false;
    }

    fade_in(callback = (() => {})) {
        this.fade_callback = callback;
        this.fade = Date.now();
        this.fadein = true;
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


export function ease_function(x, alpha = 1.5) {
    let xa = Math.pow(x, alpha);
    let x2a = Math.pow(1.0 - x, alpha);
    return xa / (xa + x2a);
}
