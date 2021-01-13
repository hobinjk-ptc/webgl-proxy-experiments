const width = 640;
const height = 480;

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
    const geometry1 = new THREE.BoxGeometry(10 + Math.random(),10 + Math.random(),10 + Math.random());
    const geometry2 = new THREE.TorusKnotGeometry(8, 3, 32, 8);
    const material1 = new THREE.MeshBasicMaterial({color: 0x00ff00});
    const material2 = new THREE.MeshLambertMaterial({color: 0xffa400});
    let cube = new THREE.Mesh(i === 0 ? geometry1 : geometry1, i === 0 ? material2 : material1);
    numFaces += cube.geometry.faces.length;
    cube.position.x = -15 + workerId / 10;
    cube.position.y = -2.5 + i / 2 + Math.random()*20-10;
    cube.position.z = -2.5 + i / 2 + Math.random()*20-10;
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
      cube.rotation.x -= (0.2 + workerId / 60) * deltaTime;
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
