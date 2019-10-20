"use strict";

(function() {

  function reportError(msg) {
    console.error(msg);
  }

  function FpsCounter(element) {
    let frames = 0;
    let lastStart = performance.now();

    function fps() {
      let elapsed = (performance.now() - lastStart) / 1000;
      return Math.round(frames / elapsed);
    }

    function updateLoop() {
      element.textContent = fps();
      frames = 0;
      lastStart = performance.now();
      setTimeout(updateLoop, 1000);
    }

    updateLoop();

    Object.assign(this, {
      fps : fps,
      increment : function() {
        frames++;
      }
    });
  }

  function ParticlesController() {

    const DEFAULT_PARTICLES = 100000;
    const DEFAULT_MAX_PARTICLES = 2000000;
    const DEFAULT_MAX_SPEED = 1.2;
    const DEFAULT_ACCELERATION = 2;

    const MODE_ATTRACT = 0;
    const MODE_REPULSE = 1;
    const MODE_RELAX = 2;

    let config = readConfig();
    let container = document.getElementById("container");
    let canvas = document.getElementById("canvas");

    let renderer = new ParticlesRenderer(canvas, config);
    window.onresize = renderer.resize;
    renderer.resize();

    let mode = MODE_ATTRACT;

    let hashChanged;

    Object.assign(canvas, {
      onmousemove : function(event) {
        setScreenTarget(event.clientX, event.clientY);
      },
      onmousedown : function(e) {
        setMode(e.button == 0 ? MODE_REPULSE : e.button == 2 ? MODE_RELAX : MODE_ATTRACT);
        setScreenTarget(event.clientX, event.clientY);
      },
      onmouseup : function(e) {
        setMode(MODE_ATTRACT);
      },

      ontouchstart : function(event) {
        event.preventDefault();
        setScreenTarget(event.touches[0].clientX, event.touches[0].clientY);
        setMode(MODE_REPULSE);
      },
      ontouchmove : function(event) {
        event.preventDefault();
        setScreenTarget(event.touches[0].clientX, event.touches[0].clientY);
        if (mode == MODE_REPULSE)
          setMode(MODE_ATTRACT);
      },
      ontouchend : function(event) {
        event.preventDefault();
        setMode(MODE_ATTRACT);
      }
    });

    Object.assign(document, {
      onmouseleave : function(e) {
        setTarget(0, 0);
      },
      oncontextmenu : function() {
        return false;
      },
      onvisibilitychange : function() {
        // simulate a pause in the rendering
        if (!document.hidden) {
          renderer.resume();
        }
      }
    });

    Object.assign(window,{
      onhashchange : function(e) {
        if (hashChanged) {
          hashChanged = false;
          return;
        }
        config = readConfig();
        renderer.updateMaxSpeed(config.maxSpeed);
        renderer.updateAcceleration(config.maxSpeed);
        config.particleCount = renderer.setParticleCount(config.particleCount);
        hudController.update(config);
      },
      onkeydown: function(e) {
        if (e.code == 'KeyH') {
          container.classList.toggle('no-hud');
        }
      }
    });
      
    
    function getQueryParams() {
      let res = {};
      let matches = window.location.hash.matchAll('[?&]([^=]+)=([^&]*)');
      let match = matches.next();
      while (!match.done) {
        res[unescape(match.value[1])] = unescape(match.value[2]);
        match = matches.next();
      }
      return res;
    }

    function setQueryParam(key, value) {
      window.location.hash = window.location.hash.replace(new RegExp(escape(key) + '=[^&]+'), escape(key) + '=' + escape(value));
      hashChanged = true;
    }

    function readConfig() {
      let params = getQueryParams();
      return {
        particleCount : parseInt(params['p']) || DEFAULT_PARTICLES,
        maxSpeed : parseFloat(params['s']) || DEFAULT_MAX_SPEED,
        acceleration : parseFloat(params['a']) || DEFAULT_ACCELERATION,
        maxParticles : parseFloat(params['m']) || DEFAULT_MAX_PARTICLES
      };
    }

    function setMode(m) {
      mode = m;
      renderer.updateMode(m);
    }

    function setScreenTarget(screenX, screenY) {
      setTarget((screenX / canvas.width) * 2 - 1, (1 - (screenY / canvas.height)) * 2 - 1);
    }
    
    function setTarget(x, y) {
      renderer.updateTarget(x, y);
    }

    function loop(ts) {
      renderer.render(ts);
      fpsCounter.increment();
      window.requestAnimationFrame(loop);
    }

    Object.assign(this, {
      start : function() {
        window.requestAnimationFrame(loop);
      },
      setMaxSpeed : function(maxSpeed) {
        config.maxSpeed = maxSpeed;
        renderer.updateMaxSpeed(maxSpeed);
        setQueryParam('s', maxSpeed);
      },
      setAcceleration : function(acceleration) {
        config.acceleration = acceleration;
        renderer.updateAcceleration(acceleration);
        setQueryParam('a', acceleration);
      },
      setParticleCount : function(count) {
        config.particleCount = renderer.setParticleCount(count);
        setQueryParam('p', config.particleCount);
        return config.particleCount;
      }
    });

    let fpsCounter = new FpsCounter(document.getElementById("fps-value"));
    let hudController = new HUDController(this);
    hudController.update(config);
  }

  function HUDController(particlesController) {

    let hudInputs = document.getElementById("hud-inputs");

    let hudTrigger = document.getElementById("hud-trigger");

    hudTrigger.onclick = function(e) {
      if (hudInputs.classList.contains('hidden')) {
        showInputs();
      } else {
        hideInputs();
      }
    }

    function hideInputs() {
      hudInputs.style.height = hudInputs.style.width = '0';
      hudInputs.classList.add('hidden');
      hudTrigger.classList.remove('open');
    }

    function showInputs() {
      hudInputs.style.width = hudInputs.scrollWidth + 'px';
      hudInputs.style.height = hudInputs.scrollHeight + 'px';
      hudInputs.classList.remove('hidden');
      hudTrigger.classList.add('open');
    }

    let particlesInput = document.getElementById('particles');
    particlesInput.onchange = function(e) {
      let newCount = particlesController.setParticleCount(parseInt(particlesInput.value));
      particlesInput.value = newCount;
    };

    let maxSpeedInput = document.getElementById('max-speed');
    maxSpeedInput.onchange = function(e) {
      particlesController.setMaxSpeed(parseFloat(maxSpeedInput.value));
    };

    let accelerationInput = document.getElementById('acceleration');
    accelerationInput.onchange = function(e) {
      particlesController.setAcceleration(parseFloat(accelerationInput.value));
    };

    Object.assign(this, {
      update : function(config) {
        particlesInput.value = config.particleCount;
        maxSpeedInput.value = config.maxSpeed;
        accelerationInput.value = config.acceleration;
      }
    });
  }

  let controller = new ParticlesController();
  controller.start();

})();