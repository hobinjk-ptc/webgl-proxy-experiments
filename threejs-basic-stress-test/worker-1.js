const width = 640;
const height = 480;

workerId = 1;

async function main() {
  if (!gl) {
    console.error('Unable to initialize WebGL. Your browser or machine may not support it.');
    return;
  }

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xaaaaaa));
  var directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
  directionalLight.position.x = -20;
  directionalLight.position.y = -20;
  directionalLight.position.z = -20;
  scene.add( directionalLight );


  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.z = 35;

  let cubes = [];

  for (let i = 0; i < 2; i++) {
    let geometry, material;
    if (i === 0) {
      geometry = new THREE.BoxGeometry(4, 4, 4);
      material = new THREE.MeshBasicMaterial({color: 0x00ff00});
    } else {
      geometry = new THREE.TorusKnotGeometry(1 + i / 2, 0.3, 90 + i, 16);
      material = new THREE.MeshLambertMaterial({color: 0xffa400});
    }
    let cube = new THREE.Mesh(geometry, material);
    cube.position.x = -15 + workerId + i * 7;
    cube.position.y = -2.5 + i * 3;
    cube.position.z = -2.5 + i * 3;
    scene.add(cube);
    cubes.push(cube);
  }

  let realRenderer = new THREE.WebGLRenderer();
  realRenderer.setSize(width, height);
  realGl = realRenderer.getContext();

  const renderer = new THREE.WebGLRenderer({context: gl});
  renderer.setSize(width, height);
  renderer.debug.checkShaderErrors = false;

  let then = 0;
  let done = false;
  let patience = 0;

  // Draw the scene repeatedly
  render = function(now) {
    now *= 0.001;  // convert to seconds
    const deltaTime = now - then;
    then = now;

    // if (done && !realGl) {
    //   return;
    // }

    patience += 1;

    for (let i = 0; i < 2; i++) {
      let cube = cubes[i];
      cube.rotation.x -= (0.2 + workerId / 60) * deltaTime;
      cube.rotation.y -= 0.2 * deltaTime;
      cube.position.x = -15 + workerId + i * 7;
      cube.position.y = -2.5 + i * 3;
      cube.position.z = -2.5 + i * 3;
    }

    renderer.render(scene, camera);

    if (done && realGl && patience > 2) {
      for (let proxy of proxies) {
        proxy.__uncloneableObj = null;
        delete proxy.__uncloneableObj;
      }
      proxies = [];
      realRenderer.dispose();
      realRenderer.forceContextLoss();
      realRenderer.context = null;
      realRenderer.domElement = null;
      realRenderer = null;
      realGl = null;
    }
    done = true;
  }
}
