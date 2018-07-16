/**
 * This code simply creates a flat plane, which we render our shaders onto
 * The shaders are given:
 *   attribute vec* a_position: the position of the current pixel
 *   uniform float u_time: time since rendering started, in ms
 *   uniform vec2 u_resolution: the current canvas resolution
 *   uniform float u_scrolltop: scroll position from top of page
 *   uniform vec2 u_mousepos: mouse position on page
 */
console.log("%cCode was ran", "color:#aaa;text-decoration:underline");
const $canvas = document.getElementById("bg-canvas");
const $vertex = document.getElementById("shader-vertex");
const $fragment = document.getElementById("shader-fragment");

/**
 * Class that handles a vec2 which can't change abruptly
 * When new values are set, they are eased
 */
class EasedVec2 {
    constructor(x, y, t = 200) {
        this.vec = [x, y];
        this.t = t;

        this.start = [x, y]; // where we animate from
        this.target = [x, y]; // where we animate to
        this.progress = 0; // how far along we are

        this.animate = this.animate.bind(this);
    }

    set(x, y) {
        this.start = [...this.vec];
        this.target = [x, y];
        this.progress = 0;

        if (!this.animating) {
            this.animate();
        }
    }

    animate() {
        const t = Date.now();
        const delta = t - (this.lastT || t);
        this.lastT = t;
        this.animating = true;
        this.progress += (delta / this.t);
        this.progress = Math.min(1, this.progress);
        this.vec = [
            this.ease(this.start[0], this.target[0], this.progress),
            this.ease(this.start[1], this.target[1], this.progress),
        ];
        if (this.progress < 1) {
            requestAnimationFrame(this.animate);
        } else {
            this.animating = false;
            this.progress = 0;
        }
    }

    ease(a, b, t) {
        return a + (b - a) * t;
    }
}

const center = [window.innerWidth / 2, window.innerHeight / 2];
const mousePos = new EasedVec2(0, 0);
document.body.addEventListener("mousemove", e => {
    mousePos.set(e.clientX- center[0], e.clientY - center[1]);
});

/**
 * The main program
 */
class ShaderProgram {
    constructor(gl, vertex, fragment) {
        this.gl = gl;

        this.startTime = Date.now() - 6000;

        /* generate the shaders */
        this.vertex = this.createShader(vertex, gl.VERTEX_SHADER);
        this.fragment = this.createShader(fragment, gl.FRAGMENT_SHADER);

        /* generate the program */
        this.program = this.createProgram(this.vertex, this.fragment);

        /* grab where we store the GLSL variables */
        this.positions = {
            a_position: gl.getAttribLocation(this.program, "a_position"),
            u_time: gl.getUniformLocation(this.program, "u_time"),
            u_resolution: gl.getUniformLocation(this.program, "u_resolution"),
            u_scrolltop: gl.getUniformLocation(this.program, "u_scrolltop"),
            u_mousepos: gl.getUniformLocation(this.program, "u_mousepos"),
        };

        /* create the plane we will draw onto */
        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        const positions = [
            -1,  1,
            1,  1,
            -1, -1,
            1, -1,
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    }

    createProgram(vertex, fragment) {
        const gl = this.gl;
        const program = gl.createProgram();
        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error("Failed when creating program\n"+gl.getProgramInfoLog(program));
            return null;
        }
        return program;
    }

    createShader(source, type) {
        const gl = this.gl;
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error("Failed to compile shader\n"+this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    draw() {
        const gl = this.gl;
        /* clear the canvas */
        gl.clear(gl.COLOR_BUFFER_BIT);

        /* tell webgl to use the program, and allow the position attribute */
        gl.useProgram(this.program);
        gl.enableVertexAttribArray(this.positions.a_position);
        /* bind this.positionBuffer to ARRAY_BUFFER as points */
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(
            this.positions.a_position, // variable to bind into
            2, // number of values to pull per point
            gl.FLOAT, // type of values to pull
            false, // no effect anyway, since type = FLOAT
            0, // figure out stride from above values
            0, // no offset before values
        );

        /* also set our uniforms */
        gl.uniform1f(this.positions.u_time, Date.now() - this.startTime);
        gl.uniform2f(this.positions.u_resolution, gl.canvas.width, gl.canvas.height);
        gl.uniform1f(this.positions.u_scrolltop, window.pageYOffset);
        gl.uniform2f(this.positions.u_mousepos, mousePos.vec[0], mousePos.vec[1]);

        gl.drawArrays(
            gl.TRIANGLE_STRIP, // the type of geometry
            0, // no offset
            4, // 4 vertexes
        );

        /* draw again in a bit */
        if (this.awaitingDraw) { return; }
        this.awaitingDraw = true;
        requestAnimationFrame(()=>{
            this.awaitingDraw = false;
        this.draw();
    });
    }
}

const ctx = $canvas.getContext("webgl");
ctx.clearColor(0, 0, 0, 1);
const program = new ShaderProgram(ctx, $vertex.textContent, $fragment.textContent);

// Handle resizing
const onResize = () => {
    $canvas.width = window.innerWidth;
    $canvas.height = window.innerHeight;
    ctx.viewport(0, 0, $canvas.width, $canvas.height);
    ctx.clear(ctx.COLOR_BUFFER_BIT);
    program.draw();
};
onResize();
window.addEventListener("resize", onResize);