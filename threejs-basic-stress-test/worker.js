const width = 640;
const height = 480;
const textureSize = 2048;

let numFaces = 0;

async function main() {
  const div = document.createElement("div");
  const p = document.createElement("p");
  div.appendChild(p);
  p.innerText = "";
  p.style.color = "white";
  document.body.appendChild(div);

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
    let geometry = null;
    if (true) {
      geometry = new THREE.BoxGeometry(10 + Math.random(),10 + Math.random(),10 + Math.random());
    } else {
      geometry = new THREE.TorusKnotGeometry(8, 3, 32, 8);
    }
    let material = null;
    let materialMode = 'texture';
    switch (materialMode) {
      case 'basic':
        material = new THREE.MeshBasicMaterial({color: 0x00ff00});
        break;
      case 'lambert':
        material = new THREE.MeshLambertMaterial({color: 0xffa400});
        break;
      case 'texture': {
        const loader = new THREE.TextureLoader();

        material = new THREE.MeshBasicMaterial({
          map: loader.load(`../assets/tex-${textureSize}.jpg`),
        });
      }
        break;
    }
    let cube = new THREE.Mesh(geometry, material);
    numFaces += cube.geometry.faces.length;
    cube.position.x = -40 + workerId * 2;
    cube.position.y = -2.5 + 15 * i;
    cube.position.z = -2.5;
    scene.add(cube);
    cubes.push(cube);
  }

  p.innerText = `ID: ${workerId}\nPolygon count: ${numFaces}`;

  let realRenderer = new THREE.WebGLRenderer();
  realRenderer.setSize(width, height);
  realGl = realRenderer.getContext();

  const renderer = new THREE.WebGLRenderer({context: gl});
  renderer.setSize(width, height);
  renderer.debug.checkShaderErrors = false;

  let then = 0;
  let done = false;

  // Draw the scene repeatedly
  render = function(now) {
    now *= 0.001;  // convert to seconds
    const deltaTime = now - then;
    then = now;

    for (let cube of cubes) {
      cube.rotation.x -= (0.2 + workerId / 10) * deltaTime;
      cube.rotation.y -= 0.2 * deltaTime;
    }

    renderer.render(scene, camera);

    if (done && realGl) {
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
