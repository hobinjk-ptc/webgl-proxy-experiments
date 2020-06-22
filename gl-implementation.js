class WorkerGLProxy {
  constructor(worker, gl, workerId) {
    this.worker = worker;
    this.gl = gl;
    this.workerId = workerId;

    this.uncloneables = [];

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
      if (arg.fakeClone) {
        message.args[i] = this.uncloneables[arg.index];
      }
    }

    if (!this.gl[message.name]) {
      return;
    }
    let res = this.gl[message.name].apply(this.gl, message.args);
    if (res instanceof WebGLShader ||
        res instanceof WebGLProgram ||
        res instanceof WebGLBuffer ||
        res instanceof WebGLUniformLocation) {
      this.uncloneables.push(res);
      res = {fakeClone: true, index: this.uncloneables.length - 1};
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
    this.worker.postMessage({name: 'frame', time: Date.now()}, '*');
    return new Promise((res) => {
      this.frameEndListener = res;
    });
  }
}

function main() {
  const canvas = document.querySelector('#glcanvas');
  const gl = canvas.getContext('webgl');
  const worker = document.getElementById('worker1').contentWindow;
  const worker2 = document.getElementById('worker2').contentWindow;

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

  let proxy = new WorkerGLProxy(worker, gl, 1);
  let proxy2 = new WorkerGLProxy(worker2, gl, 2);

  setTimeout(() => {
    worker.postMessage({name: 'bootstrap', functions, constants}, '*');
    worker2.postMessage({name: 'bootstrap', functions, constants}, '*');
    setTimeout(renderFrame, 200);
  }, 200);

  async function renderFrame() {
    await Promise.all([
      proxy.getFrameCommands(),
      proxy2.getFrameCommands(),
    ]);


    gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
    gl.clearDepth(1.0);                 // Clear everything
    gl.enable(gl.DEPTH_TEST);           // Enable depth testing
    gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

    // Clear the canvas before we start drawing on it.

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    proxy.executeFrameCommands();
    proxy2.executeFrameCommands();

    requestAnimationFrame(renderFrame);
  }

}

main();

