export const TILE_SIZE = 16;

export class CanvasManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.ctx.imageSmoothingEnabled = false;
        window.addEventListener("resize", this.resize.bind(this));
        this.resize();
        this.scheduledDraw = false;

        this.currentDrawMethod = (ctx, width, height, manager) => {};
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

    scheduleDraw() {
        if (!this.scheduledDraw) {
            this.scheduledDraw = true;
            window.requestAnimationFrame(() => {
                this.scheduledDraw = false;
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
