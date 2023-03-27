import {createTexture} from "webgl-support";

export class ParticlesTextures {
    readonly textureSize: number[];
    // 2 (for swap), RG: pos ; BA: velocity
    private readonly textures: [WebGLTexture, WebGLTexture];

    constructor(readonly gl: WebGL2RenderingContext, textureSize: number[]) {
        this.textureSize = textureSize;
        this.textures = [this.createDataTexture(), this.createDataTexture()];
    }

    get width() {
        return this.textureSize[0];
    }

    get height() {
        return this.textureSize[1];
    }

    get particlesCount() {
        return this.textureSize[0] * this.textureSize[1];
    }

    bind() {
        const {gl, textures} = this;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, textures[0]);
    }

    attach() {
        const {gl, textures} = this;
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures[1], 0);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    }

    private createDataTexture(): WebGLTexture {
        const {gl, width, height} = this;
        const posVelocity = {
            internal: gl.RGBA32F, format: gl.RGBA, type: gl.FLOAT,
            width, height,
            filter: gl.NEAREST, wrap: gl.CLAMP_TO_EDGE
        }
        return createTexture(gl, posVelocity).texture;
    }

    get t0() {
        return this.textures[0];
    }

    get t1() {
        return this.textures[1];
    }

    swap() {
        const textures = this.textures;
        const temp = textures[0];
        textures[0] = textures[1];
        textures[1] = temp;
    }

    delete() {
        const gl = this.gl;
        this.textures.forEach(t => gl.deleteTexture(t));
    }
}