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

    this.commandBuffer = [];
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

    this.worker.postMessage({
      id: message.id,
      result: res,
    }, '*');
  }

  executeCommand(message) {
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

    let res = this.gl[message.name].apply(this.gl, message.args);
    if (typeof res === 'object') {
      this.uncloneables[message.id] = res;
      res = {fakeClone: true, index: message.id};
    }
    return res;
  }

  executeFrameCommands() {
    this.buffering = false;
    for (let message of this.commandBuffer) {
      this.executeCommand(message);
    }
    this.commandBuffer = [];
  }

  getFrameCommands() {
    this.buffering = true;
    if (this.lastUseProgram) {
      this.commandBuffer.push(this.lastUseProgram);
    }
    this.worker.postMessage({name: 'frame', time: Date.now()}, '*');
    return new Promise((res) => {
      this.frameEndListener = res;
    });
  }
}

let workerCount = 2;
let workers = [];

function sleep(ms) {
  return new Promise((res) => {
    setTimeout(res, ms);
  });
}

async function main() {
  const canvas = document.querySelector('#glcanvas');
  const gl = canvas.getContext('webgl');
  console.log(gl.getParameter(7938));

  for (let i = 1; i <= workerCount; i++) {
    let frame = document.createElement('iframe');
    frame.id = `worker${i}`;
    frame.src = `worker-${i}.html`;
    document.body.appendChild(frame);
    workers.push(frame.contentWindow);
  }

  // If we don't have a GL context, give up now

  if (!gl) {
    alert('Unable to initialize WebGL. Your browser or machine may not support it.');
    return;
  }

  await sleep(1000);

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

  let proxies = [];
  for (let i = 0; i < workers.length; i++) {
    proxies.push(new WorkerGLProxy(workers[i], gl, i + 1));
  }

  setTimeout(() => {
    for (let worker of workers) {
      worker.postMessage({name: 'bootstrap', functions, constants}, '*');
    }
    setTimeout(renderFrame, 500);
  }, 200);

  window.timings = {
    getCommands: [],
    getAllCommands: [],
    executeCommands: [],
    frames: [],
  };

  async function renderFrame() {
    let start = performance.now();

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
    requestAnimationFrame(renderFrame);
  }

}

main();

