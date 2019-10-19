"use strict";

(function() {

  function Program(program) {
    var uniformLocations = {};

    this.use = function() {
      gl.useProgram(program);
    }

    this.uniformLocation = function(name) {
      if (!uniformLocations[name]) {
        uniformLocations[name] = gl.getUniformLocation(program, name);
      }
      return uniformLocations[name];
    }
  }

  function queryParam(key) {
    return unescape(window.location.search.replace(new RegExp("^(?:.*[&\\?]" + escape(key).replace(/[\.\+\*]/g, "\\$&")
        + "(?:\\=([^&]*))?)?.*$", "i"), "$1"));
  }

  var canvas;
  var gl;

  var particleCount = queryParam('n') || 100000;
  var maxSpeed = 1.2;
  var acceleration = 2;

  var vaos = [];
  var vbos = [];
  var bufferIndex = 0;

  var renderProgram, transformProgram;
  var transformFeedback;
  var lastTick = 0;

  function reportError(msg) {
    console.error(msg);
  }

  function setup() {
    canvas = document.getElementById("canvas");
    gl = canvas.getContext("webgl2");
    if (!gl) {
      reportError("No webgl 2");
      return;
    }

    renderProgram = loadProgram('render-vs', 'render-fs');
    renderProgram.use();
    gl.uniform1f(renderProgram.uniformLocation('maxSpeed'), maxSpeed);

    transformProgram = loadProgram('update-vs', 'dummy-fs', [ 'outputPosition', 'outputSpeed' ]);
    transformProgram.use();
    gl.uniform1f(transformProgram.uniformLocation('maxSpeed'), maxSpeed);
    gl.uniform2f(transformProgram.uniformLocation('target'), 0, 0);
    gl.uniform1f(transformProgram.uniformLocation('acceleration'), acceleration);
    gl.uniform1i(transformProgram.uniformLocation('mode'), 0);

    vbos[0] = createVBO(createParticles());
    vbos[1] = createVBO();

    vaos[0] = gl.createVertexArray();
    bindAttributes(0);

    vaos[1] = gl.createVertexArray();
    bindAttributes(1);

    transformFeedback = gl.createTransformFeedback();

    switchBuffer(0);

    window.onresize = onresize;
    onresize();

    canvas.onmousemove = function(event) {
      var x = (event.clientX / canvas.width) * 2 - 1;
      var y = (1 - (event.clientY / canvas.height)) * 2 - 1;
      transformProgram.use();
      gl.uniform2f(transformProgram.uniformLocation('target'), x, y);
    }

    canvas.onmousedown = function(e) {
      var mode;
      switch (e.button) {
      case 0:
        mode = 1;
        break;
      case 2:
        mode = 2;
        break;
      default:
        mode = 0;
        break;
      }
      transformProgram.use();
      gl.uniform1i(transformProgram.uniformLocation('mode'), mode);
    };

    canvas.onmouseup = function(e) {
      transformProgram.use();
      gl.uniform1i(transformProgram.uniformLocation('mode'), 0);
    };

    document.oncontextmenu = function() {
      return false;
    }

  }

  function loop(ts) {
    update(ts || 0);
    render();
    window.requestAnimationFrame(loop);
  }

  function update(ts) {
    transformProgram.use();

    let elapsed = (ts - lastTick) / 1000;
    lastTick = ts;
    gl.uniform1f(transformProgram.uniformLocation('elapsed'), elapsed);

    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, transformFeedback);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, vbos[bufferIndex == 0 ? 1 : 0]);

    gl.enable(gl.RASTERIZER_DISCARD);

    gl.beginTransformFeedback(gl.POINTS);
    gl.drawArrays(gl.POINTS, 0, particleCount);
    gl.endTransformFeedback();
    gl.flush();

    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    gl.disable(gl.RASTERIZER_DISCARD);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    switchBuffer(bufferIndex == 0 ? 1 : 0);
  }

  function render(ts) {
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    renderProgram.use();
    gl.drawArrays(gl.POINTS, 0, particleCount);
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

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);
  }

  function switchBuffer(index) {
    gl.bindBuffer(gl.ARRAY_BUFFER, vbos[index]);
    gl.bindVertexArray(vaos[index]);
    bufferIndex = index;
  }

  function onresize() {
    resizeCanvasToDisplaySize(canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  }

  function resizeCanvasToDisplaySize(canvas, multiplier) {
    multiplier = multiplier || 1;
    const width = canvas.clientWidth * multiplier | 0;
    const height = canvas.clientHeight * multiplier | 0;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      return true;
    }
    return false;
  }

  function loadProgram(vsName, fsName, varyings) {
    var vs = createShader(gl.VERTEX_SHADER, shaderSource(vsName));
    var fs = fsName ? createShader(gl.FRAGMENT_SHADER, shaderSource(fsName)) : null;
    return createProgram(vs, fs, varyings);
  }

  function createProgram(vs, fs, varyings) {
    var program = gl.createProgram();
    gl.attachShader(program, vs);
    if (fs) {
      gl.attachShader(program, fs);
    }

    if (varyings) {
      gl.transformFeedbackVaryings(program, varyings, gl.INTERLEAVED_ATTRIBS);
    }

    gl.linkProgram(program);

    gl.deleteShader(vs);
    if (fs) {
      gl.deleteShader(fs);
    }

    if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
      return new Program(program);
    }

    var log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw "Error linking program " + log;
  }

  function shaderSource(name) {
    return document.getElementById(name).text.trim();
  }

  function createShader(type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      return shader;
    }

    var log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw "Error creating shader " + source + "\n" + log;
  }

  function createVBO(buffer) {
    let res = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, res);
    gl.bufferData(gl.ARRAY_BUFFER, buffer || new Float32Array(particleCount * 4), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return res;
  }

  function createParticles() {
    let res = new Float32Array(particleCount * 4);
    let range = Math.sqrt(maxSpeed * 2);
    let halfRange = range / 2;
    let target = 0;
    for (let i = 0; i < particleCount; i++) {
      // position
      res[target++] = Math.random() * 2 - 1;
      res[target++] = Math.random() * 2 - 1;

      // velocity
      res[target++] = Math.random() * range - halfRange;
      res[target++] = Math.random() * range - halfRange;
    }
    return res;
  }

  setup();
  loop();
})();