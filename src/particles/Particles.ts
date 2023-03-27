import {
    check,
    checkFrameBufferStatus,
    createProgram,
    LoadedProgram,
    QUAD_VS,
    QuadBuffer,
    Renderer, RendererFactory,
    RenderState
} from "webgl-support";
import {ParticlesTextures} from "./ParticlesTextures";

const MAX_SPEED = 2;
const ACCELERATION = 3;

export class Particles implements Renderer {
    static factory(textureSize: number[]): RendererFactory<Particles> {
        return gl => new Particles(gl, textureSize)
    }

    readonly canvas: HTMLCanvasElement;
    readonly fb: WebGLFramebuffer;
    readonly quad: QuadBuffer;
    readonly renderProgram: WebGLProgram;
    private updateProgram: LoadedProgram<typeof updateUniforms>;
    readonly particlesTextures: ParticlesTextures;
    readonly mousePos = [0, 0];
    mode = 0;

    constructor(readonly gl: WebGL2RenderingContext, textureSize: number[] = [512, 512]) {
        const canvas = this.canvas = gl.canvas as HTMLCanvasElement;
        this.fb = check(gl, gl.createFramebuffer);
        this.quad = new QuadBuffer(gl);
        gl.getExtension("EXT_color_buffer_float");
        this.particlesTextures = new ParticlesTextures(gl, textureSize);
        this.renderProgram = this.createRenderProgram(this.particlesTextures);
        this.updateProgram = this.createUpdateProgram();
        this.generateParticles();
        gl.clearColor(0, 0, 0, 1);

        const mp = this.mousePos;
        const updateMousePos = (e: MouseEvent) => {
            mp[0] = (e.clientX / canvas.width) * 2 - 1;
            mp[1] = (1.0 - (e.clientY / canvas.height)) * 2 - 1;
        }
        const centerMouse = () => {
            mp[0] = mp[1] = 0;
        }

        const toggleMode = (e: MouseEvent) => {
            if (e.type === 'mousedown') {
                if (e.button === 0) this.mode = 1;
                if (e.button === 2) this.mode = 2;
            } else if (e.type === 'mouseup')
                this.mode = 0;
        }

        canvas.addEventListener('mousemove', updateMousePos);
        canvas.addEventListener('mousedown', toggleMode);
        canvas.addEventListener('mouseup', toggleMode);
        canvas.addEventListener('contextmenu', e => !e.shiftKey && e.preventDefault());
        canvas.addEventListener('mouseleave', centerMouse);
    }

    render(state: Readonly<RenderState>): void {
        const {gl, renderProgram, particlesTextures, canvas} = this;

        this.updateParticles(state);

        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.useProgram(renderProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, particlesTextures.t0);
        gl.drawArrays(gl.POINTS, 0, particlesTextures.particlesCount);
    }

    onResize(width: number, height: number): void {
    }

    get particlesCount() {
        return this.particlesTextures.particlesCount;
    }

    get textureSize() {
        return this.particlesTextures.textureSize;
    }

    private generateParticles() {
        const {gl, particlesTextures} = this;
        const size = particlesTextures.width * particlesTextures.height;
        const data = new Float32Array(size * 4);
        const random = Math.random;
        for (let i = 0; i < particlesTextures.particlesCount; i++) {
            data[i * 4] = random() * 2 - 1;
            data[i * 4 + 1] = random() * 2 - 1;
            const angle = (random() * 2 - 1) * Math.PI;
            const speed = random() * MAX_SPEED;
            data[i * 4 + 2] = Math.cos(angle) * speed;
            data[i * 4 + 3] = Math.sin(angle) * speed;
        }
        gl.bindTexture(gl.TEXTURE_2D, particlesTextures.t0);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, particlesTextures.width, particlesTextures.height, gl.RGBA, gl.FLOAT, data);
    }

    private updateParticles(rs: Readonly<RenderState>) {
        const {gl, particlesTextures, updateProgram, quad, fb, mousePos, mode} = this;
        const {program, uniformLocations} = updateProgram;

        gl.useProgram(program);
        // xy: mouse pos [-1,1], z: mode: 0: attract, 1: repulse, w: delta time
        gl.uniform4f(uniformLocations.uState, mousePos[0], mousePos[1], mode, rs.dt);

        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, particlesTextures.t1, 0);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0]);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, particlesTextures.t0);

        gl.viewport(0, 0, particlesTextures.width, particlesTextures.height);
        quad.bind();
        quad.draw();

        checkFrameBufferStatus(gl);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        particlesTextures.swap();
    }

    private createRenderProgram(particlesTextures: ParticlesTextures) {
        const gl = this.gl;
        const {program, uniformLocations} = createProgram(gl, RENDER_VS, RENDER_FS, renderUniforms);
        gl.useProgram(program);
        gl.uniform1i(uniformLocations.uParticles, 0);
        gl.uniform1i(uniformLocations.uTextureWidth, particlesTextures.width);
        gl.uniform2f(uniformLocations.uConfig, MAX_SPEED, ACCELERATION);

        return program;
    }

    private createUpdateProgram() {
        const {gl, particlesTextures} = this;
        const lp = createProgram(gl, QUAD_VS, UPDATE_FS, updateUniforms);
        const {program, uniformLocations} = lp;
        gl.useProgram(program);
        gl.uniform2f(uniformLocations.uConfig, MAX_SPEED, ACCELERATION);
        return lp;
    }

}

const renderUniforms = {uTextureWidth: null, uConfig: null, uParticles: null};

//language=glsl
const RENDER_VS = `#version 300 es
precision highp float;

uniform int uTextureWidth;
uniform vec2 uConfig;//x : max speed, y : acceleration
uniform sampler2D uParticles;

out float normalizedSpeed;

void main() {
    ivec2 particleCoord = ivec2(gl_VertexID % uTextureWidth, gl_VertexID / uTextureWidth);
    vec4 particle = texelFetch(uParticles, particleCoord, 0);
    gl_Position = vec4(particle.xy, 0.0, 1.0);
    gl_PointSize = 1.0;
    float maxSpeed = uConfig.x;
    normalizedSpeed = length(particle.zw) / maxSpeed;
}
`

//language=glsl
const RENDER_FS = `#version 300 es
precision highp float;

in float normalizedSpeed;
out vec4 fragColor;

void main() {
    fragColor = vec4(1.0 - normalizedSpeed, normalizedSpeed, 0.0, 1.0);
}
`
const updateUniforms = {uConfig: null, uState: null};

//language=glsl
const UPDATE_FS = `#version 300 es
precision highp float;

uniform vec2 uConfig;//x : max speed, y : acceleration
uniform sampler2D uParticles;
uniform vec4 uState;// xy: mouse pos [-1,1], z: mode: 0: attract, 1: repulse, w: delta time 

out vec4 fragColor;

void main() {
    float maxSpeed = uConfig.x;
    float acceleration = uConfig.y;
    vec2 target = uState.xy;
    float mode = uState.z;
    float dt = uState.w;
    ivec2 coord = ivec2(gl_FragCoord.xy);
    vec4 particle = texelFetch(uParticles, coord, 0);
    vec2 pos = particle.xy;
    vec2 vel = particle.zw;

    vec2 dir;
    if (mode == 0.0) dir = normalize(target - pos);
    else if (mode == 1.0) dir = normalize(pos - target);
    else dir = normalize(vel);

    vel = vel + dir * acceleration * dt;
    float speed = length(vel);
    if (speed > maxSpeed) vel = vel / speed * maxSpeed;
    pos = pos + vel * dt;

    fragColor = vec4(pos, vel);
}
`