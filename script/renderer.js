"use strict";

const ParticlesRenderer = function(canvas, config) {

  const FLOAT_BYTES = 4;
  const PARTICLE_FLOATS = 4; // position(x,y) , speed(x,y)
  const PARTICLE_BYTES = PARTICLE_FLOATS * FLOAT_BYTES;

  let gl;
  let vaos = [], vbos = [];
  let bufferIndex = 0;

  let renderProgram, transformProgram;
  let transformFeedback;
  let lastTick = 0;

  let particleCount = 0;

  let uniformUpdates = {};

  function setup() {
    gl = canvas.getContext("webgl2");
    if (!gl) {
      throw "No webgl 2";
    }

    const shaderUtils = new ShaderUtils(gl);

    renderProgram = shaderUtils.createProgram('render-vs', 'render-fs');
    renderProgram.use();
    gl.uniform1f(renderProgram.uniforms.maxSpeed, config.maxSpeed);

    transformProgram = shaderUtils.createProgram('update-vs', 'dummy-fs', [ 'outputPosition', 'outputSpeed' ]);
    transformProgram.use();
    gl.uniform1f(transformProgram.uniforms.maxSpeed, config.maxSpeed);
    gl.uniform1f(transformProgram.uniforms.acceleration, config.acceleration);

    createBuffer(config.maxParticles);
    createBuffer(config.maxParticles);

    switchBuffer(0);

    transformFeedback = gl.createTransformFeedback();

    setParticleCount(config.particleCount);
  }

  function createBuffer(maxParticles) {
    let vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    let vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, maxParticles * 4 * 4, gl.DYNAMIC_COPY);

    const postion = 0;
    gl.enableVertexAttribArray(postion);
    gl.vertexAttribPointer(postion, 2, gl.FLOAT, false, 4 * 4, 0);

    const speed = 1;
    gl.enableVertexAttribArray(speed);
    gl.vertexAttribPointer(speed, 2, gl.FLOAT, false, 4 * 4, 2 * 4);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);

    vaos.push(vao);
    vbos.push(vbo);
  }

  function switchBuffer(index) {
    gl.bindBuffer(gl.ARRAY_BUFFER, vbos[index]);
    gl.bindVertexArray(vaos[index]);
    bufferIndex = index;
  }

  function createParticles(count) {
    let res = new Float32Array(count * 4);
    let range = Math.sqrt(config.maxSpeed * 2);
    let halfRange = range / 2;
    let target = 0;
    for (let i = 0; i < count; i++) {
      // position
      res[target++] = Math.random() * 2 - 1;
      res[target++] = Math.random() * 2 - 1;

      // velocity
      res[target++] = Math.random() * range - halfRange;
      res[target++] = Math.random() * range - halfRange;
    }
    return res;
  }

  function setParticleCount(count) {
    count = Math.max(0, Math.min(count, config.maxParticles));
    if (count > particleCount) {
      let newParticles = createParticles(count - particleCount);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbos[0]);
      gl.bufferSubData(gl.ARRAY_BUFFER, particleCount * 4 * 4, newParticles, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
    particleCount = count;
    return particleCount;
  }

  function update(ts) {
    transformProgram.use();

    if ('mode' in uniformUpdates) {
      gl.uniform1i(transformProgram.uniforms.mode, uniformUpdates.mode);
    }
    if ('target' in uniformUpdates) {
      gl.uniform2f(transformProgram.uniforms.target, uniformUpdates.target.x, uniformUpdates.target.y);
    }
    if ('maxSpeed' in uniformUpdates) {
      gl.uniform1f(transformProgram.uniforms.maxSpeed, uniformUpdates.maxSpeed);
    }
    if ('acceleration' in uniformUpdates) {
      gl.uniform1f(transformProgram.uniforms.acceleration, uniformUpdates.acceleration);
    }

    let elapsed = (ts - lastTick) / 1000;
    lastTick = ts;
    gl.uniform1f(transformProgram.uniforms.elapsed, elapsed);

    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, transformFeedback);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, vbos[bufferIndex == 0 ? 1 : 0]);

    gl.enable(gl.RASTERIZER_DISCARD);

    gl.beginTransformFeedback(gl.POINTS);
    gl.drawArrays(gl.POINTS, 0, particleCount);
    gl.endTransformFeedback();
    // gl.flush();

    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    gl.disable(gl.RASTERIZER_DISCARD);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    switchBuffer(bufferIndex == 0 ? 1 : 0);
  }

  function draw() {
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    renderProgram.use();
    if ('maxSpeed' in uniformUpdates) {
      gl.uniform1f(renderProgram.uniforms.maxSpeed, uniformUpdates.maxSpeed);
    }
    gl.drawArrays(gl.POINTS, 0, particleCount);
  }

  setup();

  Object.assign(this, {
    render : function(ts) {
      update(ts);
      draw();
      uniformUpdates = {};
    },
    resize : function() {
      const width = gl.canvas.clientWidth | 0;
      const height = gl.canvas.clientHeight | 0;
      if (gl.canvas.width !== width || gl.canvas.height !== height) {
        gl.canvas.width = width;
        gl.canvas.height = height;
      }
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    },
    resume : function() {
      lastTick = performance.now();
    },
    setParticleCount : setParticleCount,
    updateMode : function(mode) {
      uniformUpdates.mode = mode;
    },
    updateTarget : function(x, y) {
      uniformUpdates.target = {
        x : x,
        y : y
      };
    },
    updateMaxSpeed : function(maxSpeed) {
      uniformUpdates.maxSpeed = maxSpeed;
    },
    updateAcceleration : function(acceleration) {
      uniformUpdates.acceleration = acceleration;
    }
  });
}