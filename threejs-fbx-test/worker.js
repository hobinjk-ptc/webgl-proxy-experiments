const width = 640;
const height = 480;
const textureSize = 256;

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
  let canBeDone = false;
  let mixer;
  const boring = false;

  const loader = new THREE.FBXLoader();
  if (boring) {
    loader.load('../assets/KineticAR_Locator_01.fbx', function(obj) {
      for (let i = 0; i < workerMeta.primitiveCount; i++) {
        let cube = obj.clone();
        cube.position.x = -40 + workerId * 2;
        cube.position.y = -5 + 4 * i;
        cube.position.z = -10;
        scene.add(cube);
        cubes.push(cube);
      }
      canBeDone = true;
    });
  } else {
    loader.load('../assets/Samba Dancing.fbx', function(obj) {
      mixer = new THREE.AnimationMixer(obj);
      const action = mixer.clipAction(obj.animations[0]);
      obj.scale.x = 0.1;
      obj.scale.y = 0.1;
      obj.scale.z = 0.1;
      obj.position.x = -40 + workerId * 6;
      obj.position.y = 0;
      obj.position.z = -10;
      action.play();
      scene.add(obj);
      canBeDone = true;
    });
  }

  p.innerText = `ID: ${workerId}`;

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

    mixer.update(deltaTime);

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
    if (canBeDone) {
      done = true;
    }
  }
}
