/**
 * Mediator between the worker iframe and the gl implementation
 */
class WorkerGLProxy {
  /**
   * @param {Element} worker - worker iframe
   * @param {WebGLContext} gl
   * @param {number|string} workerId - unique identifier of worker
   */
  constructor(worker, gl, workerId) {
    this.worker = worker;
    this.gl = gl;
    this.workerId = workerId;

    this.uncloneables = {};

    this.cache = {};

    this.commandBuffer = [];
    this.lastTargettedBinds = {};
    this.buffering = false;

    this.onMessage = this.onMessage.bind(this);
    window.addEventListener('message', this.onMessage);

    this.frameEndListener = null;
  }

  onMessage(e) {
    const message = e.data;
    if (message.workerId !== this.workerId) {
      return;
    }

    if (this.frameEndListener && message.isFrameEnd) {
      this.frameEndListener();
      return;
    }

    if (this.buffering) {
      this.commandBuffer.push(message);
      return;
    }

    const res = this.executeCommand(message);

    if (message.wantsResponse) {
      this.worker.postMessage({
        id: message.id,
        result: res,
      }, '*');
    }
  }

  executeCommand(message) {
    if (message.messages) {
      for (let bufferedMessage of message.messages) {
        this.executeOneCommand(bufferedMessage);
      }
    } else {
      this.executeOneCommand(message);
    }
  }

  executeOneCommand(message) {
    for (let i = 0; i < message.args.length; i++) {
      let arg = message.args[i];
      if (arg && arg.fakeClone) {
        message.args[i] = this.uncloneables[arg.index];
      }
    }

    if (!this.gl[message.name]) {
      return;
    }

    const blacklist = {
      clear: true,
    };

    if (blacklist[message.name]) {
      return;
    }

    if (message.name === 'useProgram') {
      this.lastUseProgram = message;
    }

    const targettedBinds = {
      bindBuffer: true,
      bindFramebuffer: true,
      bindRenderbuffer: true,
      bindTexture: true,
    };

    if (targettedBinds[message.name]) {
      this.lastTargettedBinds[message.name + '-' + message.args[0]] = message;
    }

    let res = this.gl[message.name].apply(this.gl, message.args);
    if (res && typeof res !== 'object') {
      if (!this.cache[message.name]) {
        this.cache[message.name] = [];
      }
      this.cache[message.name].push({
        args: message.args,
        res: res,
      });
    }
    if (typeof res === 'object') {
      this.uncloneables[message.id] = res;
      res = {fakeClone: true, index: message.id};
    }
    return res;
  }

  logCommandBuffer() {
    let program = [];
    for (let command of this.commandBuffer) {
      let messages = command.messages || [command];
      for (let message of messages) {
        let args = message.args.map(arg => {
          if (arg.hasOwnProperty('0')) {
            arg = `[len(${arg.length})]`;
            // Array.from(arg);
          }
          return JSON.stringify(arg);
        });
        program.push(`gl.${message.name}(${args.join(', ')})`);
      }
    }
    console.log('frame');
    console.log(program.join('\n'));
  }

  executeFrameCommands() {
    this.buffering = false;
    if (this.commandBuffer.length > 4) {
      this.logCommandBuffer();
    }
    for (let message of this.commandBuffer) {
      this.executeCommand(message);
    }
    this.commandBuffer = [];
  }

  dropFrameCommands() {
    this.buffering = false;
    this.commandBuffer = [];
  }

  getFrameCommands() {
    this.buffering = true;
    if (this.lastUseProgram) {
      this.commandBuffer.push(this.lastUseProgram);
    }
    if (this.lastTargettedBinds) {
      for (let command of Object.values(this.lastTargettedBinds)) {
        this.commandBuffer.push(command);
      }
    }
    this.worker.postMessage({name: 'frame', time: Date.now()}, '*');
    return new Promise((res) => {
      this.frameEndListener = res;
    });
  }
}

let workers = [];
let workersPerBatch = 1;
let activeWorkers = 0;
let maxWorkers = 1;

function sleep(ms) {
  return new Promise((res) => {
    setTimeout(res, ms);
  });
}

async function addWorker(gl, functions, constants, i) {
  let frame = document.createElement('iframe');
  frame.id = `worker${i}`;
  frame.src = `worker.html`;
  document.body.appendChild(frame);
  let worker = frame.contentWindow;

  await sleep(500);

  let proxy = new WorkerGLProxy(worker, gl, i);

  await sleep(200);

  worker.postMessage({name: 'bootstrap', functions, constants, workerId: i}, '*');
  // Render 1 frame so it dies

  await sleep(200);

  await proxy.getFrameCommands();
  proxy.executeFrameCommands();

  await proxy.getFrameCommands();
  proxy.executeFrameCommands();

  await proxy.getFrameCommands();
  proxy.executeFrameCommands();

  return {
    worker,
    proxy,
  };
}

async function main() {
  const canvas = document.querySelector('#glcanvas');
  const gl = canvas.getContext('webgl');
  const status = document.querySelector('#status');

  // If we don't have a GL context, give up now

  if (!gl) {
    alert('Unable to initialize WebGL. Your browser or machine may not support it.');
    return;
  }

  const functions = [];
  const constants = {};

  for (let key in gl) {
    switch (typeof gl[key]) {
    case 'function':
      functions.push(key);
      break;
    case 'number':
      constants[key] = gl[key];
      break;
    }
  }

  window.proxies = [];

  const workerPromises = [];

  for (let i = 1; i <= workersPerBatch; i++) {
    console.log('addWorker', i);
    workerPromises.push(addWorker(gl, functions, constants, i).then(res => {
      proxies.push(res.proxy);
      activeWorkers+=1;
    }));
    // let {worker, proxy} = await addWorker(gl, functions, constants, i);
    // proxies.push(proxy);
  }

  await Promise.all(workerPromises);

  window.timings = {
    getCommands: [],
    getAllCommands: [],
    executeCommands: [],
    frames: [],
  };

  let lastBatchTime = performance.now();
  let batchesCompleted = false;
  let batchesCompletedTime = 0;
  let framesCompleted = 0;

  async function renderFrame() {
    let start = performance.now();

    if (start-lastBatchTime > 15000) {
      const workerPromises = [];

      let currentActiveWorkers = activeWorkers;
      for (let i = currentActiveWorkers + 1; i <= currentActiveWorkers + workersPerBatch && i <= maxWorkers; i++) {
        console.log('addWorker', i);
        workerPromises.push(addWorker(gl, functions, constants, i).then(res => {
          proxies.push(res.proxy);
          activeWorkers+=1;
        }));
        // let {worker, proxy} = await addWorker(gl, functions, constants, i);
        // proxies.push(proxy);
      }

      await Promise.all(workerPromises);
      lastBatchTime = performance.now();
      if (!batchesCompleted && activeWorkers === maxWorkers) {
        batchesCompleted = true;
        batchesCompletedTime = performance.now();
      }
    }

    // Get all the commands from the worker iframes
    await Promise.all(proxies.map(async (proxy) => {
       await proxy.getFrameCommands();
       timings.getCommands.push(performance.now() - start);
    }));

    timings.getAllCommands.push(performance.now() - start);

    gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
    gl.clearDepth(1.0);                 // Clear everything
    gl.enable(gl.DEPTH_TEST);           // Enable depth testing
    gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

    // Clear the canvas before we start drawing on it.
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    let executeStart = performance.now();

    // Execute all pending commands for this frame
    for (let proxy of proxies) {
      proxy.executeFrameCommands();
    }

    let end = performance.now();
    timings.executeCommands.push(end - executeStart);
    timings.frames.push(end - start);
    if (batchesCompleted) {
      framesCompleted += 1;
      status.innerText = `Real FPS: ${Math.round(framesCompleted * 100000 / (end - batchesCompletedTime))/100}
      Current workers: ${activeWorkers}/${maxWorkers}`;
    } else {
      status.innerText = `Instant FPS: ${Math.round(100000/(end-start))/100}
      Current workers: ${activeWorkers}/${maxWorkers}`;
    }
    requestAnimationFrame(renderFrame);
  }

  renderFrame();
}

main();

