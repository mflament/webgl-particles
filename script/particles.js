"use strict";

(function() {

  function queryParam(key) {
    const regex = new RegExp('[?&]' + key + '=([^&]+)');
    let match = window.location.search.match(regex);
    return match && unescape(match[1]);
  }

  const MAX_PARTICLES = 2000000;

  const MODE_ATTRACT = 0;
  const MODE_REPULSE = 1;
  const MODE_RELAX = 2;

  // the GL context
  let gl;

  let particleCount = 0;

  // shader uniforms
  let maxSpeed = parseFloat(queryParam('s')) || 1.2;
  let acceleration = parseFloat(queryParam('a')) || 2;
  let mode = MODE_ATTRACT;
  let target = {
    x : 0,
    y : 0
  };
  let uniformUpdates = {};

  let vaos, vbos;
  let bufferIndex = 0;

  let renderProgram, transformProgram;
  let transformFeedback;
  let lastTick = 0;

  let fpsSpan;
  let frames = 0;
  let fpsStart;
  let hudInputs;

  function reportError(msg) {
    console.error(msg);
  }

  function loop(ts) {
    update(ts);
    render();
    uniformUpdates = {};
    frames++;
    window.requestAnimationFrame(loop);
  }

  function update(ts) {
    transformProgram.use();

    if (uniformUpdates.mode) {
      gl.uniform1i(transformProgram.uniforms.mode, mode);
    }
    if (uniformUpdates.target) {
      gl.uniform2f(transformProgram.uniforms.target, target.x, target.y);
    }
    if (uniformUpdates.maxSpeed) {
      gl.uniform1f(transformProgram.uniforms.maxSpeed, maxSpeed);
    }
    if (uniformUpdates.acceleration) {
      gl.uniform1f(transformProgram.uniforms.acceleration, acceleration);
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

  function render(ts) {
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    renderProgram.use();
    if (uniformUpdates.maxSpeed) {
      gl.uniform1f(renderProgram.uniforms.maxSpeed, maxSpeed);
    }
    gl.drawArrays(gl.POINTS, 0, particleCount);
  }

  function switchBuffer(index) {
    gl.bindBuffer(gl.ARRAY_BUFFER, vbos[index]);
    gl.bindVertexArray(vaos[index]);
    bufferIndex = index;
  }

  function onresize() {
    const width = gl.canvas.clientWidth | 0;
    const height = gl.canvas.clientHeight | 0;
    if (gl.canvas.width !== width || gl.canvas.height !== height) {
      gl.canvas.width = width;
      gl.canvas.height = height;
    }
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
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
      const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
      let uniforms = {};
      for (let i = 0; i < numUniforms; ++i) {
        const info = gl.getActiveUniform(program, i);
        uniforms[info.name] = gl.getUniformLocation(program, info.name);
      }
      return {
        uniforms : uniforms,
        use : function() {
          gl.useProgram(program);
        }
      };
    }

    let log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw "Error linking program " + log;
  }

  function shaderSource(name) {
    return document.getElementById(name).text.trim();
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

  function createVBO() {
    let res = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, res);
    gl.bufferData(gl.ARRAY_BUFFER, MAX_PARTICLES * 4 * 4, gl.DYNAMIC_COPY);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return res;
  }

  function bindAttributes(index) {
    gl.bindBuffer(gl.ARRAY_BUFFER, vbos[index]);
    gl.bindVertexArray(vaos[index]);

    const postion = 0;
    gl.enableVertexAttribArray(postion);
    gl.vertexAttribPointer(postion, 2, gl.FLOAT, false, 4 * 4, 0);

    const speed = 1;
    gl.enableVertexAttribArray(speed);
    gl.vertexAttribPointer(speed, 2, gl.FLOAT, false, 4 * 4, 2 * 4);

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  function setParticleCount(count) {
    count = Math.min(count, MAX_PARTICLES);
    if (count > particleCount) {
      let newParticles = createParticles(count - particleCount);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbos[0]);
      gl.bufferSubData(gl.ARRAY_BUFFER, particleCount * 4 * 4, newParticles, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
    particleCount = count;
  }

  function createParticles(count) {
    let res = new Float32Array(count * 4);
    let range = Math.sqrt(maxSpeed * 2);
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

  function setMode(m) {
    mode = m;
    uniformUpdates.mode = true;
  }

  function setTarget(screenX, screenY) {
    target.x = (screenX / gl.canvas.width) * 2 - 1;
    target.y = (1 - (screenY / gl.canvas.height)) * 2 - 1;
    uniformUpdates.target = true;
  }

  function updateFps() {
    let elapsed = (performance.now() - fpsStart) / 1000;
    fpsSpan.textContent = Math.round(frames / elapsed);
    frames = 0;
    fpsStart = performance.now();
    setTimeout(updateFps, 1000);
  }

  function hideInputs() {
    hudInputs.className = 'hidden';
    hudInputs.style.height = hudInputs.style.width = '0';
  }

  function showInputs() {
    hudInputs.style.width = hudInputs.scrollWidth + 'px';
    hudInputs.style.height = hudInputs.scrollHeight + 'px';
    hudInputs.className = null;
  }

  function setup() {
    let canvas = document.getElementById("canvas");
    fpsSpan = document.getElementById("fps-value");
    gl = canvas.getContext("webgl2");
    if (!gl) {
      reportError("No webgl 2");
      return;
    }

    renderProgram = createProgram('render-vs', 'render-fs');
    renderProgram.use();
    gl.uniform1f(renderProgram.uniforms.maxSpeed, maxSpeed);

    transformProgram = createProgram('update-vs', 'dummy-fs', [ 'outputPosition', 'outputSpeed' ]);
    transformProgram.use();
    gl.uniform1f(transformProgram.uniforms.maxSpeed, maxSpeed);
    gl.uniform1f(transformProgram.uniforms.acceleration, acceleration);

    vbos = [ createVBO(), createVBO() ];
    let count = Math.min(parseInt(queryParam('p')) || 100000, MAX_PARTICLES)
    setParticleCount(count);

    vaos = [ gl.createVertexArray(), gl.createVertexArray() ];

    bindAttributes(0);
    bindAttributes(1);

    transformFeedback = gl.createTransformFeedback();

    switchBuffer(0);

    window.onresize = onresize;
    onresize();

    canvas.ontouchstart = function(event) {
      event.preventDefault();
      setTarget(event.touches[0].clientX, event.touches[0].clientY);
      setMode(MODE_REPULSE);
    }

    canvas.ontouchmove = function(event) {
      event.preventDefault();
      setTarget(event.touches[0].clientX, event.touches[0].clientY);
      if (mode == MODE_REPULSE)
        setMode(MODE_ATTRACT);
    }

    canvas.ontouchend = function(event) {
      event.preventDefault();
      setMode(MODE_ATTRACT);
    }

    canvas.onmousemove = function(event) {
      setTarget(event.clientX, event.clientY);
    }

    canvas.onmousedown = function(e) {
      mode = e.button == 0 ? MODE_REPULSE : e.button == 2 ? MODE_RELAX : MODE_ATTRACT;
      uniformUpdates.mode = true;
      setTarget(event.clientX, event.clientY);
    };

    canvas.onmouseup = function(e) {
      mode = MODE_ATTRACT;
      uniformUpdates.mode = true;
    };

    document.onmouseleave = function(e) {
      target.x = target.y = 0;
      uniformUpdates.target = true;
    }

    document.oncontextmenu = function() {
      return false;
    }

    document.onvisibilitychange = function() {
      // simulate a pause in the rendering
      if (!document.hidden) {
        lastTick = performance.now();
      }
    };

    let hudTrigger = document.getElementById("hud-trigger");
    hudInputs = document.getElementById("hud-inputs");

    hudTrigger.onclick = function(e) {
      if (hudInputs.className == 'hidden') {
        showInputs();
      } else {
        hideInputs();
      }
    }

    let particlesInput = document.getElementById('particles');
    particlesInput.value = particleCount;
    particlesInput.onchange = function(e) {
      setParticleCount(parseInt(particlesInput.value));
    };

    let maxSpeedInput = document.getElementById('max-speed');
    maxSpeedInput.value = maxSpeed;
    maxSpeedInput.onchange = function(e) {
      maxSpeed = parseFloat(maxSpeedInput.value);
      uniformUpdates.maxSpeed = true;
    };

    let accelerationInput = document.getElementById('acceleration');
    accelerationInput.value = acceleration;
    accelerationInput.onchange = function(e) {
      acceleration = parseFloat(accelerationInput.value);
      uniformUpdates.acceleration = true;
    };

    fpsStart = performance.now();
    updateFps();
  }

  setup();
  window.requestAnimationFrame(loop);
})();