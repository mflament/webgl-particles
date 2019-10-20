"use strict";

const ShaderUtils = function(gl) {
  
  class Program {
    constructor(program) {
      this.program = program;
      this.uniforms = {};
      const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < numUniforms; ++i) {
        const info = gl.getActiveUniform(program, i);
        this.uniforms[info.name] = gl.getUniformLocation(program, info.name);
      }
    }

    use() {
      gl.useProgram(this.program);
    }
  }

  function createShader(type, source) {
    let shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      return shader;
    }

    let log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw "Error creating shader " + source + "\n" + log;
  }

  function shaderSource(name) {
    return document.getElementById(name).text.trim();
  }

  function createProgram(vsName, fsName, varyings) {
    let vs = createShader(gl.VERTEX_SHADER, shaderSource(vsName));
    let fs = createShader(gl.FRAGMENT_SHADER, shaderSource(fsName));
    let program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    if (varyings) {
      gl.transformFeedbackVaryings(program, varyings, gl.INTERLEAVED_ATTRIBS);
    }
    gl.linkProgram(program);

    gl.deleteShader(vs);
    gl.deleteShader(fs);

    if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
      return new Program(program);
    }

    let log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw "Error linking program " + log;      
  }

  this.createProgram = createProgram;
}