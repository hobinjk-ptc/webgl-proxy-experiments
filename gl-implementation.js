class WorkerGLProxy {
  constructor(worker, gl) {
    this.worker = worker;
    this.gl = gl;

    this.uncloneables = [];

    this.worker.onmessage = (e) => {
      const message = e.data;
      console.log(message.name);
      for (let i = 0; i < message.args.length; i++) {
        let arg = message.args[i];
        if (arg.fakeClone) {
          message.args[i] = this.uncloneables[arg.index];
        }
      }
      let res = gl[message.name].apply(gl, message.args);
      if (res instanceof WebGLShader ||
          res instanceof WebGLProgram ||
          res instanceof WebGLBuffer ||
          res instanceof WebGLUniformLocation) {
        this.uncloneables.push(res);
        res = {fakeClone: true, index: this.uncloneables.length - 1};
      }
      this.worker.postMessage({
        id: message.id,
        result: res,
      });
    };
  }
}

function main() {
  const canvas = document.querySelector('#glcanvas');
  const gl = canvas.getContext('webgl');
  const worker = new Worker('basic-demo.js');
  const worker2 = new Worker('basic-demo-2.js');

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

  let proxy = new WorkerGLProxy(worker, gl);
  let proxy2 = new WorkerGLProxy(worker2, gl);

  worker.postMessage({name: 'bootstrap', functions, constants});
  setTimeout(() => {
    worker2.postMessage({name: 'bootstrap', functions, constants});
    setTimeout(renderFrame, 200);
  }, 200);

  function renderFrame() {
    gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
    gl.clearDepth(1.0);                 // Clear everything
    gl.enable(gl.DEPTH_TEST);           // Enable depth testing
    gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

    // Clear the canvas before we start drawing on it.

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    worker.postMessage({name: 'frame', time: Date.now()});
    setTimeout(function() {
      // worker2.postMessage({name: 'frame', time: Date.now()});
      setTimeout(renderFrame, 10);
    }, 30);
  }

}

main();

