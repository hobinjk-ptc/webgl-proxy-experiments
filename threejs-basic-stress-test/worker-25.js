const width = 640;
const height = 480;

workerId = 25;

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

  // const geometry = new THREE.BoxGeometry();
  const geometry = new THREE.TorusKnotBufferGeometry( 10, 3, 100, 16 );
  // const material = new THREE.MeshBasicMaterial({color: 0x00ff00});
  const material = new THREE.MeshLambertMaterial({color: 0xffa400});
  let cube = new THREE.Mesh(geometry, material);
  cube.position.x = -15 + workerId;
  scene.add(cube);

  let realRenderer = new THREE.WebGLRenderer();
  realRenderer.setSize(width, height);
  realGl = realRenderer.getContext();

  const renderer = new THREE.WebGLRenderer({context: gl});
  renderer.setSize(width, height);

  let then = 0;
  let done = false;
  // Draw the scene repeatedly
  render = function(now) {
    now *= 0.001;  // convert to seconds
    const deltaTime = now - then;
    then = now;

    cube.rotation.x -= (0.2 + workerId / 60) * deltaTime;
    cube.rotation.y -= 0.2 * deltaTime;

    renderer.render(scene, camera);

    if (done) {
      realGl = null;
      realRenderer = null;
      for (let proxy of proxies) {
        delete proxy.__uncloneableObj;
      }
    }
    done = true;
  }
}
