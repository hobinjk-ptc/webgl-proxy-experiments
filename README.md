# WebGL Proxy

Experimental method for proxying webgl over basic message passing. A proper
class-based API is in development.

# Basic

After including the script it will use a couple global variables to coordinate
the gl context. `workerId` specifies a unique worker id, `gl` is the fake gl
context used to proxy, and `render` is a function that the script will call
every frame.

```javascript
workerId = 1;

async function main() {
  const shader = await gl.createShader(gl.VERTEX_SHADER);
  // ...

  render = function(now) {
    gl.clearColor(0, 0, 0, 1);
    // ...
  };
}
```
