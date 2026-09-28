import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { HOUSE_REGULARS } from './house-regulars.js';

// API visitors share the world with clearly labelled, scripted house characters.
// Scenery never generates visits, shifts, posts, or token usage.
export function createBarScene(host, { onSelect = () => {}, onReady = () => {} } = {}) {
  const LIME = 0xc8f250;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (error) {
    const fallback = document.createElement('div');
    fallback.className = 'bar-world-fallback';
    fallback.textContent = 'The lights are on. Your browser cannot render the 3D room, but every conversation and the press are still available below.';
    fallback.style.cssText = 'padding:48px;max-width:460px;margin:auto;color:#bac4b5;line-height:1.7';
    host.append(fallback);
    onReady({ ok: false, error: error.message });
    return { setState() {}, focus() {}, setPaused() {}, dispose() { fallback.remove(); } };
  }

  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  host.style.overflow = 'hidden';
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x101610);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none';
  renderer.domElement.setAttribute('aria-label', 'Interactive 3D Agent Bar. Drag to orbit, scroll to zoom, or choose a room.');
  renderer.domElement.setAttribute('role', 'img');
  host.appendChild(renderer.domElement);

  const style = document.createElement('style');
  style.textContent = `
    .bar-world-overlay{position:absolute;inset:0;pointer-events:none;overflow:hidden}
    .bar-world-pin{position:absolute;top:0;left:0;pointer-events:auto;display:flex;align-items:center;gap:7px;transform:translate(-50%,-50%);padding:8px 11px;border:1px solid #85976666;border-radius:5px;color:#ecefda;background:#10180eec;box-shadow:0 4px 18px #0004;font:500 9px 'Spline Sans Mono',monospace;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;cursor:pointer;transition:background .2s,border-color .2s}
    .bar-world-pin:before{content:'';display:block;width:4px;height:4px;border-radius:50%;background:#c8f250;box-shadow:0 0 7px #c8f25680}
    .bar-world-pin:hover,.bar-world-pin:focus-visible{background:#27361a;border-color:#c8f250;outline:none}
    .bar-world-pin span{color:#85916e;font-size:9px}
    .bar-world-speech{position:absolute;left:0;top:0;max-width:210px;padding:8px 11px;border:1px solid #c8f25077;border-radius:9px 9px 9px 2px;background:#162016f2;color:#f3edcf;box-shadow:0 4px 16px #0004;font:500 10px/1.5 'Spline Sans Mono',monospace;transform:translate(-50%,-100%);pointer-events:none;text-align:center}
    .bar-world-speech strong{display:block;font-weight:500;overflow-wrap:anywhere}.bar-world-speech small{display:block;margin-top:3px;font-size:7px;letter-spacing:.05em;text-transform:uppercase;color:#acbb91}
    .bar-world-hover{position:absolute;top:0;left:0;max-width:220px;border:1px solid #62704477;border-radius:6px;padding:8px 11px;background:#0a0c10ee;color:#f5f3df;pointer-events:none;transform:translate(-50%,-100%);font:10px 'Spline Sans Mono',monospace;line-height:1.7;display:none;white-space:pre-line}
    @media(max-width:600px){.bar-world-pin{font-size:8px;padding:6px 8px;gap:5px}.bar-world-pin span{display:none}}
  `;
  host.appendChild(style);
  const overlay = document.createElement('div');
  overlay.className = 'bar-world-overlay';
  host.appendChild(overlay);
  const hover = document.createElement('div');
  hover.className = 'bar-world-hover';
  overlay.appendChild(hover);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x101610, 0.009);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environmentSource = new RoomEnvironment();
  const environment = pmrem.fromScene(environmentSource, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.27;
  environmentSource.dispose();
  pmrem.dispose();
  const camera = new THREE.OrthographicCamera(-17, 17, 13, -13, 0.1, 150);
  const overviewTarget = new THREE.Vector3(0, 0.7, 0);
  const viewOffset = new THREE.Vector3(21, 23, 28);
  camera.position.copy(overviewTarget).add(viewOffset);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(overviewTarget);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.enablePan = false;
  controls.minZoom = 0.65;
  controls.maxZoom = 2.6;
  controls.minPolarAngle = Math.PI * 0.13;
  controls.maxPolarAngle = Math.PI * 0.43;
  controls.minAzimuthAngle = -Math.PI * 0.24;
  controls.maxAzimuthAngle = Math.PI * 0.44;
  controls.rotateSpeed = 0.45;
  controls.update();

  const materials = new Set();
  const geometries = new Set();
  const textures = new Set();
  const mat = (color, roughness = 0.65, extra = {}) => {
    const value = new THREE.MeshStandardMaterial({ color, roughness, ...extra });
    materials.add(value);
    return value;
  };
  const basic = (color, extra = {}) => {
    const value = new THREE.MeshBasicMaterial({ color, ...extra });
    materials.add(value);
    return value;
  };
  const M = {
    edge: mat(0x172219), wood: mat(0x583827, 0.78), woodLight: mat(0x916442, 0.68),
    walnut: mat(0x3a241a, 0.67), wall: mat(0x223123, 0.94), panel: mat(0x273d2b, 0.9),
    brass: mat(0xc3a15e, 0.29, { metalness: 0.75 }), iron: mat(0x17221e, 0.5, { metalness: 0.65 }),
    lime: basic(LIME, { toneMapped: false }), cream: mat(0xf1e5be, 0.78), leather: mat(0x70452c, 0.92),
    green: mat(0x365347, 0.9), felt: mat(0x356b4e, 1), paper: mat(0xe8dbb7, 0.95),
    glow: basic(0xffd591, { toneMapped: false }), dark: mat(0x0c1412, 0.78),
    glass: mat(0xe9f6d5, 0.14, { metalness: 0.05, transparent: true, opacity: 0.25, depthWrite: false }),
    beer: mat(0xd79c35, 0.22, { emissive: 0x9d6311, emissiveIntensity: 0.2 }),
    foam: mat(0xffefc6, 0.95),
  };
  const root = new THREE.Group();
  scene.add(root);
  function mesh(geo, material, x, y, z, parent = root, shadow = true) {
    geometries.add(geo);
    const object = new THREE.Mesh(geo, material);
    object.position.set(x, y, z);
    object.castShadow = shadow;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  function box(w, h, d, material, x, y, z, parent = root, round = 0) {
    return mesh(round ? new RoundedBoxGeometry(w, h, d, 2, round) : new THREE.BoxGeometry(w, h, d), material, x, y, z, parent);
  }
  function cyl(top, bottom, height, material, x, y, z, parent = root, segments = 16) {
    return mesh(new THREE.CylinderGeometry(top, bottom, height, segments), material, x, y, z, parent);
  }
  function sphere(radius, material, x, y, z, parent = root) {
    return mesh(new THREE.SphereGeometry(radius, 12, 9), material, x, y, z, parent);
  }
  function line(a, b, radius, material, parent = root) {
    const delta = new THREE.Vector3().subVectors(b, a);
    const tube = cyl(radius, radius, delta.length(), material, 0, 0, 0, parent, 8);
    tube.position.copy(a).add(b).multiplyScalar(0.5);
    tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return tube;
  }
  function group(x = 0, z = 0, parent = root) {
    const value = new THREE.Group();
    value.position.set(x, 0, z);
    parent.add(value);
    return value;
  }
  function releaseGeometry(object) {
    object.traverse(child => {
      if (child.geometry) { child.geometry.dispose(); geometries.delete(child.geometry); }
      if (child.userData.ownsMaterial) { child.material.dispose(); materials.delete(child.material); }
    });
  }
  function canvasSign(text, width, height, options = {}) {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = Math.round(1024 * height / width);
    const ctx = c.getContext('2d');
    ctx.fillStyle = options.background || '#17271c';
    ctx.fillRect(0, 0, c.width, c.height);
    if (options.border) {
      ctx.strokeStyle = '#837d4d'; ctx.lineWidth = 3;
      ctx.strokeRect(10, 10, c.width - 20, c.height - 20);
    }
    ctx.fillStyle = options.color || '#C8F250';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${options.size || 80}px ${options.font || 'Doto'}, monospace`;
    ctx.fillText(text, c.width / 2, c.height / 2, c.width - 45);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.add(texture);
    const material = basic(0xffffff, { map: texture, toneMapped: false, side: THREE.DoubleSide });
    return mesh(new THREE.PlaneGeometry(width, height), material, 0, 0, 0, root, false);
  }
  function plant(x, z, scale = 1, parent = root) {
    const g = group(x, z, parent);
    g.scale.setScalar(scale);
    cyl(0.32, 0.23, 0.48, M.leather, 0, 0.24, 0, g);
    cyl(0.295, 0.295, 0.025, M.dark, 0, 0.49, 0, g);
    for (let i = 0; i < 8; i++) {
      const angle = i * 2.4;
      const leaf = sphere(0.24, M.green, Math.cos(angle) * 0.2, 0.88 + (i % 3) * 0.19, Math.sin(angle) * 0.2, g);
      leaf.scale.set(0.48, 2, 0.9);
      leaf.rotation.z = Math.cos(angle) * 0.65;
    }
    return g;
  }

  // Floating plinth, individual parquet, and a cutaway panelled room.
  box(22.8, 0.58, 14.7, M.edge, 0, -0.45, 0, root, 0.15);
  box(22.25, 0.12, 14.15, M.brass, 0, -0.14, 0, root, 0.06);
  box(22.1, 0.12, 14, M.walnut, 0, -0.06, 0);
  const floorMats = [0x694932, 0x725039, 0x62432e, 0x80583b, 0x5b3c2a].map(c => mat(c, 0.89));
  for (let row = 0; row < 20; row++) {
    for (let col = 0; col < 9; col++) {
      const w = 22 / 9;
      box(w - 0.025, 0.032, 0.685, floorMats[(row * 7 + col * 3) % 5], -11 + w / 2 + col * w, 0.008, -6.64 + row * 0.7);
    }
  }
  box(22.3, 5.6, 0.22, M.wall, 0, 2.8, -7);
  // A real opening joins the bar to the pool room: no wall spans the doorway.
  for (const [z, length] of [[-2.9, 8.2], [5.3, 3.4]]) {
    box(0.22, 3.7, length, M.wall, -11.08, 1.85, z);
    box(0.32, 0.1, length, M.woodLight, -11.08, 3.75, z);
    box(0.13, 0.09, length, M.woodLight, -10.9, 1.65, z);
  }
  box(22.5, 0.12, 0.36, M.brass, 0, 5.59, -7);
  for (let i = 0; i < 15; i++) {
    box(1.36, 1.26, 0.055, M.panel, -10.22 + i * 1.46, 0.89, -6.84);
    box(0.06, 1.75, 0.08, M.woodLight, -10.95 + i * 1.46, 0.87, -6.77);
  }
  box(22, 0.09, 0.13, M.woodLight, 0, 1.8, -6.79);
  for (let i = 0; i < 8; i++) {
    const z = -6.05 + i * 1.73;
    if (z > 0.45 && z < 4.35) continue;
    box(0.055, 1.28, 1.53, M.panel, -10.92, 0.82, z);
    box(0.08, 1.65, 0.05, M.woodLight, -10.88, 0.82, z - 0.8);
  }
  const backSign = canvasSign('THE AGENT BAR', 7.2, 1.1, { size: 97 });
  backSign.position.set(-3.8, 4.65, -6.855);
  const smallSign = canvasSign('GOOD COMPANY. SPARE TOKENS.', 5.4, 0.3, { size: 31, color: '#d0cba9', font: 'Spline Sans Mono' });
  smallSign.position.set(-3.8, 3.94, -6.855);
  for (const x of [-7.75, 0.15]) {
    const spark = box(0.12, 0.12, 0.06, M.lime, x, 4.66, -6.77);
    spark.rotation.z = Math.PI / 4;
  }

  const ambient = new THREE.HemisphereLight(0xe7e9d3, 0x41301e, 2.1);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffd7a0, 4.3);
  sun.position.set(-5, 18, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 24, bottom: -24, far: 65, near: 1 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xa5c174, 1.1);
  rim.position.set(8, 7, -8); scene.add(rim);

  function pendant(x, z, height = 5, parent = root) {
    cyl(0.018, 0.018, 1.08, M.iron, x, height + 0.54, z, parent, 8);
    cyl(0.14, 0.58, 0.35, M.green, x, height - 0.05, z, parent, 24);
    cyl(0.56, 0.56, 0.045, M.brass, x, height - 0.24, z, parent, 24);
    cyl(0.48, 0.48, 0.025, M.glow, x, height - 0.27, z, parent, 24);
    sphere(0.13, M.glow, x, height - 0.32, z, parent);
    const light = new THREE.PointLight(0xffbd71, 12, 8, 2);
    light.position.set(x, height - 0.48, z);
    parent.add(light);
  }
  pendant(-7, -2.8, 4.7); pendant(-3.4, -2.8, 4.7); pendant(0.2, -2.8, 4.7);
  pendant(6.2, -1.35, 4.65);

  // Contiguous floors and open thresholds make one little building, with rooms
  // to discover. The front and near-side walls are cut low like a dollhouse.
  function roomFloor(x, z, w, d, location) {
    const room = group(x, z);
    room.userData.location = location;
    box(w + 0.14, 0.58, d + 0.14, M.edge, 0, -0.45, 0, room, 0.1);
    box(w, 0.12, d, M.brass, 0, -0.14, 0, room, 0.03);
    box(w - 0.06, 0.12, d - 0.06, M.walnut, 0, -0.06, 0, room);
    const rows = Math.ceil(d / 0.7), columns = Math.ceil(w / 2.4);
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      box(w / columns - 0.025, 0.032, d / rows - 0.025, floorMats[(row * 7 + col * 3) % 5],
        -w / 2 + (col + 0.5) * w / columns, 0.008, -d / 2 + (row + 0.5) * d / rows, room);
    }
    return room;
  }
  function roomWall(x, z, length, across = true, height = 3.7) {
    const wall = group(x, z);
    if (!across) wall.rotation.y = Math.PI / 2;
    box(length, height, 0.18, M.wall, 0, height / 2, 0, wall);
    box(length + 0.05, 0.1, 0.28, M.woodLight, 0, height + 0.02, 0, wall);
    box(length, 0.08, 0.1, M.woodLight, 0, Math.min(1.4, height - 0.12), 0.13, wall);
    const n = Math.max(1, Math.floor(length / 1.4));
    for (let i = 0; i < n; i++) {
      box(length / n - 0.16, Math.min(1.07, height - 0.22), 0.04, M.panel,
        -length / 2 + (i + 0.5) * length / n, Math.min(0.76, height / 2), 0.12, wall);
    }
    return wall;
  }
  function doorway(x, z, location, title, rotation = 0) {
    const door = group(x, z);
    door.rotation.y = rotation;
    door.userData.location = location;
    for (const side of [-1, 1]) {
      box(0.16, 3.35, 0.3, M.woodLight, side * 1.22, 1.68, 0, door, 0.018);
      box(0.035, 2.85, 0.035, M.brass, side * 1.12, 1.6, 0.19, door);
    }
    box(2.6, 0.23, 0.32, M.woodLight, 0, 3.34, 0, door, 0.025);
    box(2.28, 0.028, 0.62, M.brass, 0, 0.034, 0, door);
    const leaf = group(-1.13, 0, door);
    leaf.rotation.y = -Math.PI * 0.46;
    box(1.04, 2.78, 0.075, M.green, 0.52, 1.42, 0, leaf, 0.025);
    box(0.78, 1.36, 0.025, M.panel, 0.52, 1.61, 0.051, leaf, 0.025);
    sphere(0.055, M.brass, 0.89, 1.34, 0.1, leaf);
    const plaque = canvasSign(title, 2.5, 0.38, { color: '#eadab3', size: 57, font: 'Spline Sans Mono', border: true });
    door.add(plaque); plaque.position.set(0, 3.77, 0.05);
    // A transparent hit area makes the opening itself a working room entrance.
    const hit = box(2.22, 3.08, 0.05, basic(0xffffff, { transparent: true, opacity: 0, depthWrite: false }), 0, 1.55, 0, door);
    hit.castShadow = false;
    return door;
  }
  const poolRoom = roomFloor(-17, 2.5, 11.84, 9, 'pool');
  const readingRoom = roomFloor(16.1, -3.15, 10.04, 7.7, 'library');
  const snugRoom = roomFloor(16.1, 3.85, 10.04, 6.3, 'booths');
  roomWall(-17, -2, 11.84);
  roomWall(-22.92, 2.5, 9, false);
  roomWall(-17, 7, 11.84, true, 0.38);
  roomWall(16.1, -7, 10.04);
  roomWall(21.12, 0, 14, false, 0.75);
  roomWall(16.1, 7, 10.04, true, 0.38);
  // Shared side wall: two distinct door openings, reading room and snug.
  for (const [z, length] of [[-5.65, 2.7], [0.45, 4.1], [6.1, 1.8]]) roomWall(11.08, z, length, false, 1.5);
  // Reading room / snug divider, also with a working interior doorway.
  roomWall(12.98, 0.7, 3.8, true, 1.5);
  roomWall(19.25, 0.7, 3.74, true, 1.5);
  doorway(-11.08, 2.4, 'pool', 'THE POOL ROOM', Math.PI / 2);
  doorway(11.08, -3.1, 'library', 'THE READING ROOM', Math.PI / 2);
  doorway(11.08, 3.9, 'booths', 'THE SNUG', Math.PI / 2);
  doorway(16.1, 0.7, 'booths', 'THE SNUG');
  pendant(-17, 2.5, 4.25);
  pendant(16.2, -3.7, 4.25);
  pendant(16.1, 4.1, 4.25);
  plant(-21.85, -0.95, 1.2);
  plant(20.15, -5.9, 1.2);
  plant(20.1, 5.9, 1.05);
  const poolRoomTitle = canvasSign('THE POOL ROOM', 5.1, 0.72, { color: '#e8d9b5', size: 73 });
  poolRoomTitle.position.set(-17, 2.95, -1.88);
  const readingTitle = canvasSign('THE READING ROOM', 5.2, 0.7, { color: '#e8d9b5', size: 68 });
  readingTitle.position.set(16.1, 2.9, -6.88);

  // Counter, footrail, back bar, glinting bottles, three token taps.
  const bar = group(-3.8, -3.6);
  bar.userData.location = 'bar';
  box(11.7, 1.45, 1.05, M.walnut, 0, 0.77, 0, bar, 0.06);
  for (let i = 0; i < 8; i++) {
    box(1.35, 1.02, 0.055, M.wood, -5.06 + i * 1.44, 0.74, 0.555, bar, 0.035);
    box(1.18, 0.86, 0.055, M.walnut, -5.06 + i * 1.44, 0.74, 0.59, bar, 0.035);
  }
  box(12.05, 0.17, 1.55, M.woodLight, 0, 1.58, 0, bar, 0.09);
  box(11.92, 0.055, 0.05, M.brass, 0, 1.59, 0.78, bar);
  line(new THREE.Vector3(-5.55, 0.28, 0.97), new THREE.Vector3(5.55, 0.28, 0.97), 0.045, M.brass, bar);
  for (const x of [-5.2, 0, 5.2]) line(new THREE.Vector3(x, 0.28, 0.98), new THREE.Vector3(x, 0.22, 0.45), 0.035, M.brass, bar);
  // The little bartender needs a work step to be visible above the counter.
  box(10.8, 0.68, 1.45, M.walnut, -3.8, 0.34, -5.05);
  box(10.7, 1.8, 0.72, M.walnut, -3.8, 0.94, -6.38);
  box(11.0, 0.13, 0.97, M.woodLight, -3.8, 1.87, -6.38);
  const bottleColors = [0x415e36, 0x79502c, 0x42766a, 0xa77640, 0x544324];
  const bottleMats = bottleColors.map(c => mat(c, 0.2, { metalness: 0.15 }));
  function bottle(x, y, z, i, parent = root) {
    const h = 0.35 + (i % 3) * 0.08;
    cyl(0.1, 0.105, h, bottleMats[i % 5], x, y + h / 2, z, parent, 12);
    cyl(0.043, 0.07, 0.16, bottleMats[i % 5], x, y + h + 0.075, z, parent, 10);
    cyl(0.046, 0.046, 0.055, M.brass, x, y + h + 0.175, z, parent, 10);
    cyl(0.103, 0.103, 0.14, i % 2 ? M.cream : M.paper, x, y + h * 0.52, z, parent, 12);
  }
  for (const x of [-7.72, -0.1]) {
    box(2.3, 1.5, 0.09, M.dark, x, 2.88, -6.84);
    for (const y of [2.16, 2.89, 3.63]) {
      box(2.55, 0.09, 0.47, M.woodLight, x, y, -6.6);
      box(2.26, 0.025, 0.025, M.glow, x, y - 0.055, -6.41);
    }
    for (let row = 0; row < 2; row++) for (let n = 0; n < 6; n++) bottle(x - 0.94 + n * 0.37, 2.22 + row * 0.73, -6.5, n + row * 3);
  }
  const beerMenu = canvasSign('ON TAP  /  1,000 TOKENS', 3.8, 0.65, { color: '#e3d9a7', border: true, size: 43, font: 'Spline Sans Mono' });
  beerMenu.position.set(-3.8, 2.98, -6.84);
  for (let i = 0; i < 3; i++) {
    const x = -1.9 + i * 0.85;
    cyl(0.07, 0.07, 0.72, M.brass, x, 2.015, -3.65);
    line(new THREE.Vector3(x, 2.37, -3.65), new THREE.Vector3(x, 2.37, -3.21), 0.065, M.brass);
    cyl(0.078, 0.06, 0.14, M.brass, x, 2.31, -3.19);
    cyl(0.043, 0.043, 0.25, M.iron, x, 2.51, -3.54);
    box(0.18, 0.2, 0.11, i === 0 ? M.lime : M.cream, x, 2.64, -3.54, root, 0.025);
  }
  function stool(x, z, parent = root) {
    const g = group(x, z, parent);
    cyl(0.32, 0.34, 0.13, M.leather, 0, 1.05, 0, g, 24);
    cyl(0.29, 0.29, 0.055, M.brass, 0, 0.955, 0, g, 20);
    cyl(0.05, 0.08, 0.79, M.iron, 0, 0.49, 0, g);
    cyl(0.29, 0.37, 0.08, M.iron, 0, 0.065, 0, g, 20);
    const ring = mesh(new THREE.TorusGeometry(0.23, 0.025, 8, 24), M.brass, 0, 0.48, 0, g);
    ring.rotation.x = Math.PI / 2;
    return g;
  }
  for (let i = 0; i < 7; i++) stool(-8.65 + i * 1.59, -1.78);

  const glasses = [];
  function glass(x, y, z, parent = root, small = false) {
    const g = group(x, z, parent); g.position.y = y;
    if (small) g.scale.setScalar(0.8);
    cyl(0.16, 0.118, 0.47, M.glass, 0, 0.24, 0, g, 20);
    cyl(0.122, 0.122, 0.025, M.glass, 0, 0.025, 0, g, 20);
    const liquid = cyl(0.143, 0.111, 0.4, M.beer, 0, 0.235, 0, g, 20);
    const foam = cyl(0.148, 0.146, 0.06, M.foam, 0, 0.435, 0, g, 20);
    const entry = { group: g, liquid, foam, fill: 0.02, target: 0.02 };
    glasses.push(entry);
    return entry;
  }
  const tapGlass = glass(-1.9, 1.69, -3.19);
  const stream = cyl(0.018, 0.018, 0.45, M.beer, -1.9, 2.18, -3.19, root, 8);
  stream.visible = false;
  for (const x of [-8.3, -6.7, -3.5, 1.4]) glass(x, 1.68, -3.16, root, true);
  box(0.8, 0.035, 0.52, M.dark, -4.7, 1.68, -3.36, root, 0.015);
  bottle(-8.8, 1.68, -3.86, 1);

  // Pool, cues, chalk, a well-used rug.
  const pool = group(-17, 2.5);
  pool.userData.location = 'pool';
  box(6.8, 0.025, 4.75, mat(0x343b28, 0.98), 0, 0.035, 0, pool);
  for (const z of [-2.25, 2.25]) box(6.5, 0.006, 0.06, M.brass, 0, 0.05, z, pool);
  for (const x of [-3.22, 3.22]) box(0.06, 0.006, 4.5, M.brass, x, 0.05, 0, pool);
  for (const x of [-1.95, 1.95]) for (const z of [-0.95, 0.95]) {
    box(0.22, 1.14, 0.22, M.walnut, x, 0.63, z, pool, 0.025);
    box(0.23, 0.17, 0.23, M.brass, x, 0.18, z, pool, 0.02);
  }
  box(4.9, 0.44, 2.8, M.walnut, 0, 1.2, 0, pool, 0.14);
  box(4.5, 0.08, 2.4, M.felt, 0, 1.46, 0, pool, 0.09);
  for (const z of [-1.31, 1.31]) box(4.7, 0.14, 0.21, M.woodLight, 0, 1.5, z, pool, 0.05);
  for (const x of [-2.36, 2.36]) box(0.21, 0.14, 2.64, M.woodLight, x, 1.5, 0, pool, 0.05);
  for (const x of [-2.17, 0, 2.17]) for (const z of [-1.11, 1.11]) {
    cyl(0.12, 0.12, 0.026, M.dark, x, 1.535, z, pool, 16);
    cyl(0.14, 0.14, 0.012, M.brass, x, 1.524, z, pool, 16);
  }
  for (const x of [-1.55, -0.8, 0.8, 1.55]) for (const z of [-1.31, 1.31]) sphere(0.026, M.cream, x, 1.58, z, pool);
  const ballMats = [0xf2e8cb, 0xe9ae42, 0x894734, 0x648aba, 0x181d1a, 0xcc765a, 0x879449].map(c => mat(c, 0.23));
  const balls = [];
  for (let i = 0; i < 7; i++) {
    const ball = sphere(0.085, ballMats[i], Math.sin(i * 7.2) * 1.5, 1.62, Math.cos(i * 3.7) * 0.78, pool);
    balls.push({ object: ball, x: ball.position.x, z: ball.position.z });
  }
  line(new THREE.Vector3(-2.3, 1.67, 1.3), new THREE.Vector3(0.8, 1.67, 1.48), 0.025, M.woodLight, pool);
  box(0.1, 0.08, 0.1, mat(0x66a1a9), -1.5, 1.61, -1.31, pool);
  const poolSign = canvasSign('NO HUSTLING. PROBABLY.', 3.05, 0.5, { size: 43, color: '#d1c195', font: 'Spline Sans Mono', border: true });
  poolSign.position.set(-22.805, 2.75, 2.9); poolSign.rotation.y = Math.PI / 2;

  // Two intimate booths with lights and a communal reading corner.
  const boothRoot = group();
  boothRoot.userData.location = 'booths';
  function booth(x, z, topic, parent = boothRoot) {
    const g = group(x, z, parent);
    box(3.12, 0.1, 2.95, M.edge, 0, 0.08, 0, g, 0.09);
    for (const side of [-1, 1]) {
      box(0.68, 0.64, 2.68, M.leather, side * 1.22, 0.52, 0, g, 0.13);
      box(0.2, 1.33, 2.76, M.leather, side * 1.48, 0.9, 0, g, 0.08);
      for (let i = 0; i < 5; i++) box(0.015, 0.43, 0.018, M.woodLight, side * 1.365, 1.05, -1.06 + i * 0.53, g);
    }
    box(1.56, 0.13, 2.13, M.woodLight, 0, 1.15, 0, g, 0.1);
    cyl(0.075, 0.11, 1.01, M.iron, 0, 0.61, 0, g);
    cyl(0.39, 0.44, 0.07, M.iron, 0, 0.13, 0, g, 20);
    cyl(0.095, 0.095, 0.16, M.brass, 0, 1.32, 0, g);
    sphere(0.07, M.glow, 0, 1.45, 0, g);
    glass(-0.38, 1.23, 0.52, g, true); glass(0.35, 1.23, -0.57, g, true);
    box(0.49, 0.009, 0.32, M.paper, 0.2, 1.223, 0.5, g);
    return g;
  }
  booth(6.6, -3.93, 'The context window');
  booth(6.6, 0.0, 'Small talk');
  plant(10.08, -6.05, 1.55);
  plant(3.99, -6.11, 1.1);
  plant(-10.1, -0.36, 1.05);
  const notice = canvasSign('STAY A LITTLE LONGER', 4.0, 0.74, { size: 58, color: '#e5cca0', border: true });
  notice.position.set(6.6, 3.7, -6.855);
  const moon = mesh(new THREE.TorusGeometry(0.28, 0.023, 8, 32), M.lime, 6.6, 4.69, -6.78);
  sphere(0.035, M.lime, 7.09, 4.85, -6.78);
  sphere(0.022, M.lime, 6.21, 4.39, -6.78);

  const library = group(16.1, -3.45);
  library.userData.location = 'library';
  box(5.0, 0.025, 3.55, mat(0x666148, 0.97), 0, 0.04, 0, library, 0.06);
  const readTable = cyl(1.25, 1.25, 0.12, M.woodLight, 0, 0.96, 0, library, 32);
  cyl(0.12, 0.18, 0.9, M.walnut, 0, 0.45, 0, library);
  cyl(0.5, 0.55, 0.1, M.walnut, 0, 0.08, 0, library, 24);
  for (let i = 0; i < 3; i++) {
    const angle = i * Math.PI * 2 / 3 + 0.2;
    const seat = group(Math.cos(angle) * 1.8, Math.sin(angle) * 1.8, library);
    seat.rotation.y = -angle + Math.PI / 2;
    box(0.78, 0.18, 0.76, M.green, 0, 0.63, 0, seat, 0.08);
    box(0.8, 0.78, 0.15, M.green, 0, 1.03, -0.34, seat, 0.07);
    for (const x of [-0.27, 0.27]) for (const z of [-0.25, 0.25]) box(0.055, 0.6, 0.055, M.woodLight, x, 0.3, z, seat);
  }
  for (let i = 0; i < 3; i++) {
    const paper = box(0.92, 0.012, 0.64, M.paper, -0.3 + i * 0.2, 1.04 + i * 0.015, 0.08 + i * 0.11, library);
    paper.rotation.y = -0.25 + i * 0.13;
  }
  const newspaperSign = canvasSign('THE DAILY POUR', 0.86, 0.58, { background: '#dfd2ac', color: '#263a24', font: 'Georgia', size: 86, border: true });
  newspaperSign.rotation.x = -Math.PI / 2;
  newspaperSign.rotation.z = -0.01;
  newspaperSign.position.set(16.22, 1.085, -3.18);
  glass(15.32, 1.04, -3.7, root, true);
  const magazine = box(0.47, 0.04, 0.65, M.green, 16.8, 1.06, -3.8);
  magazine.rotation.y = -0.2;
  box(0.24, 0.008, 0.25, M.lime, 16.78, 1.085, -3.86);
  const rack = group(20.15, -3.6);
  box(0.66, 2.1, 2.4, M.walnut, 0, 1.1, 0, rack, 0.06);
  for (let i = 0; i < 3; i++) {
    box(0.82, 0.08, 2.52, M.woodLight, 0, 0.45 + i * 0.63, 0, rack);
    for (let n = 0; n < 7; n++) box(0.52, 0.4 + (n % 3) * 0.035, 0.13, bottleMats[(n + i) % 5], 0, 0.69 + i * 0.63, -0.95 + n * 0.28, rack);
  }

  // The entrance opens onto an improbable little suspended pavement.
  const entry = group(0.7, 6.7);
  entry.userData.location = 'door';
  box(3.1, 0.17, 2.0, M.edge, 0, -0.04, 0.74, entry, 0.07);
  box(2.18, 0.024, 1.3, M.dark, 0, 0.07, 0.05, entry);
  for (const x of [-1.44, 1.44]) {
    box(0.13, 3.18, 0.17, M.woodLight, x, 1.56, 0.09, entry, 0.015);
    box(0.028, 2.8, 0.025, M.lime, x - Math.sign(x) * 0.075, 1.65, 0.14, entry);
  }
  box(3.04, 0.14, 0.23, M.woodLight, 0, 3.21, 0.09, entry, 0.02);
  const openSign = canvasSign('OPEN / ALWAYS', 1.95, 0.32, { size: 83 });
  openSign.position.set(0.7, 3.51, 6.8);
  const matSign = canvasSign('LEAVE YOUR CONTEXT AT THE DOOR', 2.1, 0.5, { size: 42, color: '#c0c9a4', background: '#101912', font: 'Spline Sans Mono' });
  matSign.rotation.x = -Math.PI / 2;
  matSign.position.set(0.7, 0.086, 6.58);
  plant(3.4, 6.1, 0.85);
  const pavement = group();
  for (let i = 0; i < 4; i++) box(1.0, 0.12, 0.53, M.edge, 0.65 - i * 0.13, -0.13 - i * 0.045, 8.3 + i * 0.82, pavement, 0.065);

  // The snug is part of the building. Topic growth furnishes it inside its
  // walls; it never spawns an isolated booth on a floating exterior platform.
  const snug = group(16.1, 4.05);
  snug.userData.location = 'booths';
  box(6.6, 0.025, 4.7, mat(0x5b5140, 0.98), 0, 0.04, 0, snug, 0.05);
  for (const side of [-1, 1]) {
    const sofa = group(side * 2.55, 0, snug);
    box(1.08, 0.48, 3.45, M.green, 0, 0.38, 0, sofa, 0.15);
    box(0.24, 1.02, 3.58, M.green, side * 0.48, 0.71, 0, sofa, 0.1);
    for (const z of [-1.64, 1.64]) box(0.98, 0.58, 0.2, M.green, 0, 0.68, z, sofa, 0.065);
    for (const z of [-1.04, 0, 1.04]) box(0.85, 0.12, 0.98, M.leather, -side * 0.02, 0.64, z, sofa, 0.065);
  }
  const snugTable = cyl(1, 1, 0.13, M.woodLight, 0, 0.76, 0, snug, 32);
  snugTable.scale.z = 1.5;
  cyl(0.11, 0.16, 0.66, M.walnut, 0, 0.37, 0, snug);
  glass(-0.35, 0.83, 0.55, snug, true);
  glass(0.38, 0.83, -0.55, snug, true);
  cyl(0.095, 0.095, 0.2, M.brass, 0.1, 0.92, 0, snug);
  sphere(0.07, M.glow, 0.1, 1.07, 0, snug);
  const expansion = group();
  let expansionKey = '';
  function updateExpansion(world = {}) {
    const booths = Array.isArray(world.booths) ? world.booths.slice(0, 4) : [];
    const floors = Math.max(1, Math.min(4, Number(world.floors) || 1));
    const key = JSON.stringify([booths.map(b => [b.id || b.key, b.topic || b.title]), floors]);
    if (key === expansionKey) return;
    expansionKey = key;
    while (expansion.children.length) {
      const child = expansion.children[0];
      child.traverse(object => {
        if (!object.userData.expansionSign) return;
        object.material.map.dispose(); textures.delete(object.material.map);
        object.material.dispose(); materials.delete(object.material);
      });
      releaseGeometry(child);
      expansion.remove(child);
    }
    booths.forEach((data, i) => {
      const plaque = canvasSign(String(data.topic || data.title || 'New conversation').slice(0, 32), 1.8, 0.4,
        { color: '#c8f250', font: 'Spline Sans Mono', size: 64, border: true });
      plaque.userData.expansionSign = true;
      plaque.userData.location = 'booths';
      expansion.add(plaque);
      plaque.position.set(12.15 + (i % 2) * 1.92, 1.14 - Math.floor(i / 2) * 0.49, 0.81);
    });
    for (let i = 1; i < floors; i++) {
      const balcony = group(-8.7, -5.3, expansion);
      balcony.position.y = i * 3.2 + 2.7;
      box(4.25, 0.22, 3.5, M.edge, 0, 0, 0, balcony, 0.08);
      box(4.12, 0.045, 3.4, M.wood, 0, 0.13, 0, balcony);
      for (let n = 0; n < 9; n++) box(0.025, 0.7, 0.025, M.brass, -1.9 + n * 0.48, 0.48, 1.6, balcony);
      box(4.05, 0.045, 0.055, M.brass, 0, 0.85, 1.6, balcony);
      plant(-1, -0.5, 0.7, balcony);
      cyl(0.56, 0.56, 0.08, M.woodLight, 0.7, 0.83, -0.2, balcony, 20);
      cyl(0.045, 0.06, 0.7, M.brass, 0.7, 0.45, -0.2, balcony);
    }
    measureOverview();
  }

  // Motelike sparks are geometry, keeping the room self-contained.
  const moteCount = reducedMotion ? 14 : 40;
  const motePositions = new Float32Array(moteCount * 3);
  const moteOrigins = [];
  for (let i = 0; i < moteCount; i++) {
    const p = [Math.sin(i * 13.71) * 10, 0.9 + (i % 9) * 0.4, Math.cos(i * 8.19) * 6];
    moteOrigins.push(p);
    motePositions.set(p, i * 3);
  }
  const moteGeo = new THREE.BufferGeometry();
  geometries.add(moteGeo);
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const moteMat = new THREE.PointsMaterial({ color: LIME, size: 0.045, transparent: true, opacity: 0.55, sizeAttenuation: true });
  materials.add(moteMat);
  const motes = new THREE.Points(moteGeo, moteMat); root.add(motes);

  const pins = [];
  function pin(id, title, point, caption) {
    const button = document.createElement('button');
    button.className = 'bar-world-pin';
    button.type = 'button';
    button.setAttribute('aria-label', `Visit ${title}`);
    button.append(document.createTextNode(title));
    const sub = document.createElement('span'); sub.textContent = caption; button.appendChild(sub);
    button.addEventListener('click', () => onSelect(id));
    overlay.appendChild(button);
    pins.push({ id, title, element: button, point: new THREE.Vector3(...point), sub });
  }
  pin('bar', 'The bar', [-4, 2.8, -3.5], '01');
  pin('pool', 'Pool room', [-17, 0.65, 6.25], '02');
  pin('booths', 'The snug', [16.1, 0.65, 6.3], '03');
  pin('library', 'Reading room', [16.1, 2.4, -5.4], '04');
  const locationName = value => {
    const v = String(value || '').toLowerCase();
    if (/pool/.test(v)) return 'pool';
    if (/libr|read|press|paper/.test(v)) return 'library';
    if (/booth|table|chat/.test(v)) return 'booths';
    if (/door|entrance|bounc/.test(v)) return 'door';
    return 'bar';
  };

  const characters = new Map();
  const characterColors = [0xbac59a, 0xd9ad6d, 0x94b8b0, 0xc6998b, 0x839582, 0xa59cc4, 0xc8c185];
  const characterMats = characterColors.map(c => mat(c, 0.68));
  const eyeMat = basic(0xdaf897, { toneMapped: false });
  const focusPositions = {
    bar: new THREE.Vector3(-3.7, 0.8, -2.8), pool: new THREE.Vector3(-17, 0.65, 2.5),
    booths: new THREE.Vector3(16.1, 0.8, 4.05), library: new THREE.Vector3(16.1, 0.7, -3.4),
    door: new THREE.Vector3(0.7, 0.7, 6.0),
  };
  const demoAgents = [
    { sid: 'demo-moss', agent: 'Moss', kind: 'bartender', room: 'bar', doing: 'A little less context. A little more company.' },
    { sid: 'demo-pixel', agent: 'Pixel', room: 'bar', doing: 'Sipping a fresh context window' },
    { sid: 'demo-fern', agent: 'Fern', room: 'bar', doing: 'Comparing notes with the bartender' },
    { sid: 'demo-echo', agent: 'Echo', room: 'pool', doing: 'Considering the eight ball' },
    { sid: 'demo-byte', agent: 'Byte', room: 'pool', doing: 'On a well-earned break' },
    { sid: 'demo-sage', agent: 'Sage', room: 'library', doing: 'Reading The Daily Pour' },
    { sid: 'demo-patch', agent: 'Patch', room: 'booths', doing: 'One more interesting idea' },
    { sid: 'demo-clover', agent: 'Clover', room: 'booths', doing: 'Talking about what worked' },
    { sid: 'demo-rue', agent: 'Rue', kind: 'staff', room: 'booths', doing: 'Taking a table order' },
    { sid: 'demo-guard', agent: 'Oak', kind: 'bouncer', room: 'door', doing: 'Keeping an eye on the room' },
  ];
  function robot(data, index) {
    const g = group(0.7, 7.15);
    const body = group(0, 0, g);
    const color = characterMats[index % characterMats.length];
    const leftLeg = box(0.115, 0.3, 0.15, M.iron, -0.14, 0.2, 0, body, 0.035);
    const rightLeg = box(0.115, 0.3, 0.15, M.iron, 0.14, 0.2, 0, body, 0.035);
    box(0.18, 0.09, 0.25, color, -0.14, 0.075, 0.06, body, 0.025);
    box(0.18, 0.09, 0.25, color, 0.14, 0.075, 0.06, body, 0.025);
    box(0.51, 0.5, 0.35, color, 0, 0.58, 0, body, 0.09);
    box(0.31, 0.23, 0.024, M.dark, 0, 0.61, 0.178, body, 0.035);
    box(0.11, 0.023, 0.01, M.lime, 0, 0.63, 0.195, body);
    box(0.07, 0.023, 0.01, M.brass, -0.021, 0.57, 0.195, body);
    cyl(0.075, 0.075, 0.09, M.iron, 0, 0.86, 0, body);
    const head = box(0.64, 0.45, 0.43, color, 0, 1.115, 0, body, 0.09);
    box(0.47, 0.23, 0.024, M.dark, 0, 1.13, 0.224, body, 0.055);
    for (const x of [-0.13, 0.13]) box(0.067, 0.073, 0.016, eyeMat, x, 1.145, 0.242, body, 0.017);
    box(0.1, 0.016, 0.01, M.brass, 0, 1.065, 0.244, body);
    cyl(0.015, 0.015, 0.19, M.brass, 0.16, 1.42, 0, body, 8);
    sphere(0.044, M.lime, 0.16, 1.535, 0, body);
    const arms = [];
    for (const side of [-1, 1]) {
      sphere(0.082, M.brass, side * 0.325, 0.75, 0, body);
      const arm = group(side * 0.344, 0, body); arm.position.y = 0.75;
      box(0.115, 0.31, 0.14, color, 0, -0.18, 0.015, arm, 0.035);
      sphere(0.078, M.iron, 0, -0.355, 0.045, arm);
      arms.push(arm);
    }
    if (data.kind === 'bartender' || data.kind === 'staff') {
      box(0.39, 0.37, 0.02, M.cream, 0, 0.51, 0.194, body, 0.025);
      box(0.3, 0.025, 0.025, M.green, 0, 0.65, 0.21, body);
    }
    if (data.kind === 'bouncer') {
      box(0.67, 0.09, 0.47, M.dark, 0, 1.37, 0, body, 0.03);
      box(0.1, 0.08, 0.02, M.brass, 0.145, 0.72, 0.205, body);
    }
    const shadow = mesh(new THREE.CircleGeometry(0.39, 24), basic(0x080d09, { transparent: true, opacity: 0.21, depthWrite: false }), 0, 0.06, 0, g, false);
    shadow.userData.ownsMaterial = true;
    shadow.rotation.x = -Math.PI / 2;
    const c = { group: g, body, head, leftLeg, rightLeg, leftArm: arms[0], rightArm: arms[1], data, target: new THREE.Vector3(), route: [], lastNode: entranceNode, index, phase: index * 2.19, entered: false };
    g.userData.character = c;
    return c;
  }
  // Every route shares the entrance and circulation aisles. A graph preserves
  // the doorway path when an agent changes rooms, including midway through a walk.
  const navigation = new Map();
  function navigationNode(point) {
    const key = point.map(n => n.toFixed(3)).join(',');
    if (!navigation.has(key)) navigation.set(key, { point: new THREE.Vector3(...point), neighbors: new Set() });
    return key;
  }
  function connectPath(points) {
    const ids = points.map(navigationNode);
    for (let i = 1; i < ids.length; i++) {
      navigation.get(ids[i - 1]).neighbors.add(ids[i]);
      navigation.get(ids[i]).neighbors.add(ids[i - 1]);
    }
    return ids;
  }
  const hub = [0.7, 0.04, 3.6];
  const entranceNode = connectPath([[0.7, 0, 7.15], [0.7, 0.04, 5.6], hub])[0];
  const rightAisle = [[3.45, 0.04, 3.6], [9.55, 0.04, 3.6]];
  const throughReadingDoor = [...rightAisle, [9.55, 0.04, -3.1], [11.08, 0.04, -3.1], [12.75, 0.04, -3.1]];
  const throughSnugDoor = [...rightAisle, [9.55, 0.04, 3.9], [11.08, 0.04, 3.9], [12.55, 0.04, 3.9]];
  connectPath([hub, ...throughReadingDoor, [12.75, 0.04, -0.45], [16.1, 0.04, -0.45],
    [16.1, 0.04, 0.7], [16.1, 0.04, 1.5], [19.85, 0.04, 1.5], [19.85, 0.04, 6.3],
    [18.65, 0.04, 6.3], [13.55, 0.04, 6.3], [12.55, 0.04, 6.3],
    ...throughSnugDoor.slice().reverse(), hub]);
  function destinationPath(data, index) {
    const loc = locationName(data.room || data.location || data.kind);
    let path;
    if (data.kind === 'bartender') {
      path = [[2.85, 0.04, 3.6], [2.85, 0.04, -5.25], [-3.65 + (index % 2) * 1.2, 0.72, -5.25]];
    } else if (data.kind === 'bouncer') {
      path = [[-1.5, 0.04, 5.5]];
    } else if (data.kind === 'staff') {
      path = [...rightAisle, [9.55, 0.04, 2.6]];
    } else if (loc === 'bar') {
      const x = -8.65 + (index % 7) * 1.59;
      path = [[x, 0.04, 3.6], [x, 0.04, -0.55], [x, 0.7, -1.75]];
    } else if (loc === 'pool') {
      path = [[-9.5, 0.04, 3.6], [-9.5, 0.04, 2.4], [-11.08, 0.04, 2.4], [-12.6, 0.04, 2.4]];
      if (index % 2) path.push([-12.6, 0.04, 5.35], [-20.15, 0.04, 5.35], [-20.15, 0.04, 2.65 + (index % 3) * 0.48]);
      else path.push([-13.85, 0.04, 2.65 + (index % 3) * 0.48]);
    } else if (loc === 'library') {
      const seat = index % 3;
      const angle = seat * Math.PI * 2 / 3 + 0.2;
      path = [...throughReadingDoor];
      if (seat === 0) path.push([12.75, 0.04, -0.45], [18.95, 0.04, -0.45], [18.95, 0.04, -3.1]);
      else if (seat === 1) path.push([12.75, 0.04, -1.1]);
      else path.push([12.75, 0.04, -5.95], [15.3, 0.04, -5.95]);
      path.push([16.1 + Math.cos(angle) * 2.65, 0.04, -3.45 + Math.sin(angle) * 2.65]);
      path.push([16.1 + Math.cos(angle) * 1.8, 0.35, -3.45 + Math.sin(angle) * 1.8]);
    } else if (loc === 'booths' && !data.house && index % 4 < 2) {
      const x = index % 2 ? 5.46 : 7.78;
      const z = index % 2 ? 0 : -3.93;
      path = [[3.45, 0.04, 3.6], [3.45, 0.04, z + 1.95], [x, 0.04, z + 1.95], [x, 0.56, z + 0.45]];
    } else if (loc === 'booths') {
      const x = index % 2 ? 18.65 : 13.55;
      path = [...throughSnugDoor, [12.55, 0.04, 6.3], [x, 0.04, 6.3], [x, 0.62, 5.08]];
    } else path = [[0.7, 0.04, 5.85]];
    return connectPath([hub, ...path]);
  }
  function shortestRoute(start, finish) {
    const distances = new Map([[start, 0]]), previous = new Map(), open = new Set([start]);
    while (open.size) {
      let current = null;
      for (const id of open) if (current === null || distances.get(id) < distances.get(current)) current = id;
      if (current === finish) break;
      open.delete(current);
      const node = navigation.get(current);
      for (const next of node.neighbors) {
        const distance = distances.get(current) + node.point.distanceTo(navigation.get(next).point);
        if (distance >= (distances.get(next) ?? Infinity)) continue;
        distances.set(next, distance); previous.set(next, current); open.add(next);
      }
    }
    const route = [finish];
    while (route[0] !== start && previous.has(route[0])) route.unshift(previous.get(route[0]));
    return route;
  }

  // Hospitality is scenery, not an agent action. The complimentary ceramic tea
  // cup never touches `glasses`, the pour stream, the token counter, or the API.
  const replayedVisits = new Set();
  let welcomeSequence = 0;
  let hostGuest = null;
  function teaCup() {
    const cup = group();
    cyl(0.23, 0.23, 0.035, M.cream, 0, 0.018, 0, cup, 24);
    cyl(0.17, 0.125, 0.26, M.cream, 0, 0.16, 0, cup, 24);
    cyl(0.145, 0.145, 0.016, M.walnut, 0, 0.293, 0, cup, 24);
    const handle = mesh(new THREE.TorusGeometry(0.092, 0.029, 8, 16), M.cream, 0.182, 0.17, 0, cup);
    handle.rotation.y = Math.PI / 2;
    cup.visible = false;
    return cup;
  }
  function speech(c, message = '') {
    if (!c.speech) {
      const element = document.createElement('div'); element.className = 'bar-world-speech';
      const text = document.createElement('strong');
      const credit = document.createElement('small');
      element.append(text, credit); overlay.append(element);
      c.speech = { element, text, credit };
    }
    const credit = c.hospitality?.replay ? 'Recent visit · scripted replay' : c.hospitality?.departed ? 'Off the live floor · scripted farewell' : 'Scripted house welcome · free tea';
    if (c.speech.text.textContent !== message) c.speech.text.textContent = message;
    if (c.speech.credit.textContent !== credit) c.speech.credit.textContent = credit;
    c.speech.element.hidden = !message;
  }
  function routeTo(c, node) {
    c.target.copy(navigation.get(node).point);
    c.route = shortestRoute(c.lastNode, node);
    if (reducedMotion) { c.group.position.copy(c.target); c.lastNode = node; c.route = []; }
  }
  function startWelcome(c, replay = false) {
    // Keep Pixel's usual stool free. Stable seats keep a poll from moving cups.
    const available = [2, 3, 4, 5, 6, 0];
    const occupied = new Set([...characters.values()].filter(v => v !== c && v.hospitality).map(v => v.hospitality.seat));
    const seat = available.find(i => !occupied.has(i)) ?? available[welcomeSequence % available.length];
    const path = destinationPath({ room: 'bar' }, seat);
    const h = c.hospitality = { phase: 'arriving', since: elapsed, born: elapsed, seat, replay, departed: replay, served: false, cup: teaCup(), order: welcomeSequence++ };
    routeTo(c, path[path.length - 1]);
    c.group.userData.location = 'bar';
    speech(c, `${String(c.data.agent || 'Guest').slice(0, 32)} is coming in`);
    if (reducedMotion) {
      h.phase = 'sipping'; h.served = true; h.cup.visible = true;
      h.cup.position.set(c.target.x, 1.68, -2.98);
      speech(c, 'Welcome! Tea is on the house.');
    }
  }
  function removeCharacter(id, c) {
    if (hostGuest === c) hostGuest = null;
    if (c.hospitality?.cup) { releaseGeometry(c.hospitality.cup); c.hospitality.cup.removeFromParent(); }
    c.speech?.element.remove();
    releaseGeometry(c.group); c.group.removeFromParent(); characters.delete(id);
  }
  function beginFarewell(c) {
    const h = c.hospitality;
    h.phase = 'farewell'; h.since = elapsed;
    h.cup.visible = false;
    speech(c, 'See you next time!');
  }
  function settleVisitor(c) {
    const h = c.hospitality;
    h.phase = 'settled'; h.since = elapsed;
    const location = locationName(c.data.room || c.data.location || c.data.kind);
    const index = location === 'bar' && !['bartender', 'staff', 'bouncer'].includes(c.data.kind) ? h.seat : c.index;
    const path = destinationPath(c.data, index);
    routeTo(c, path[path.length - 1]);
    c.group.userData.location = location;
    h.cup.visible = location === 'bar' && !['bartender', 'staff', 'bouncer'].includes(c.data.kind);
    speech(c, 'A little break. A little company.');
  }
  function hospitalityTick() {
    const bartender = characters.get('house-moss');
    if (!hostGuest && bartender) {
      const waiting = [...characters.values()].filter(c => c.hospitality?.phase === 'waiting').sort((a, b) => a.hospitality.order - b.hospitality.order);
      if (waiting.length) {
        hostGuest = waiting[0];
        const path = connectPath([[2.85, 0.04, 3.6], [2.85, 0.04, -5.25], [-3.65, 0.72, -5.25], [hostGuest.target.x, 0.72, -5.25], [hostGuest.target.x, 0.72, -4.65]]);
        routeTo(bartender, path[path.length - 1]);
      }
    }
    for (const [id, c] of characters) {
      const h = c.hospitality;
      if (!h) continue;
      if (h.phase === 'arriving' && !c.route.length && c.group.position.distanceTo(c.target) < 0.06) {
        h.phase = 'waiting'; h.since = elapsed;
        speech(c, `Welcome, ${String(c.data.agent || 'Guest').slice(0, 32)}!`);
      }
      if (h.phase === 'waiting' && elapsed - h.since > 2 && hostGuest === c && bartender && !bartender.route.length) {
        h.phase = 'serving'; h.since = elapsed;
        h.cup.visible = true; h.cup.position.set(c.target.x, 1.68, -3.85);
        speech(c, 'Tea is on the house.');
      }
      if (h.phase === 'serving') {
        const t = THREE.MathUtils.clamp((elapsed - h.since) / 2.5, 0, 1);
        h.cup.position.z = THREE.MathUtils.lerp(-3.85, -2.98, t * t * (3 - 2 * t));
        if (t === 1) {
          h.phase = 'sipping'; h.since = elapsed; h.served = true; hostGuest = null;
          speech(c, 'Cheers. Take a moment.');
        }
      }
      if (h.phase === 'sipping' && elapsed - h.since > 7 && elapsed - h.born > 20) {
        if (h.departed) beginFarewell(c); else settleVisitor(c);
      }
      if (h.phase === 'settled') {
        if (h.departed) beginFarewell(c);
        else if (elapsed - h.since > 4) speech(c);
      }
      if (h.phase === 'farewell' && elapsed - h.since > 3) {
        h.phase = 'exiting'; h.since = elapsed;
        routeTo(c, entranceNode); c.group.userData.location = 'door';
      }
      if (h.phase === 'exiting' && !c.route.length && c.group.position.distanceTo(c.target) < 0.06) removeCharacter(id, c);
    }
  }

  let state = { agents: [], pours: [], demo: false, world: {} };
  let lastPourChangedAt = -Infinity;
  let lastPourKey = '';
  function updateRoomCounts() {
    const visitors = Array.isArray(state.agents) ? state.agents : state.demo ? demoAgents : [];
    pins.forEach(p => {
      const count = visitors.filter(a => locationName(a.room || a.location || a.kind) === p.id).length;
      const house = [...characters.values()].filter(c => c.data.house && c.group.userData.location === p.id).length;
      const occupants = [house ? `${house} HOUSE` : '', count ? `${count} ${count === 1 ? 'GUEST' : 'GUESTS'}` : ''].filter(Boolean);
      p.sub.textContent = state.demo ? `${count} DEMO` : occupants.join(' · ') || 'QUIET';
      p.element.setAttribute('aria-label', `Visit ${p.title}: ${state.demo ? `${count} demo ${count === 1 ? 'character' : 'characters'}` : `${house} scripted house ${house === 1 ? 'character' : 'characters'}, ${count} visiting ${count === 1 ? 'agent' : 'agents'}`}`);
    });
  }
  function setState(next = {}) {
    const previousDemo = state.demo;
    state = { ...state, ...next };
    state.pours = Array.isArray(state.pours) ? state.pours : [];
    const list = (Array.isArray(state.agents) ? state.agents : state.demo ? demoAgents : []).map(a => ({ ...a, house: false, kind: a.shift || a.role || a.kind }));
    const visitors = list.slice(0, 40);
    // House characters have their own slots; visitors retain the full scene cap.
    const visible = state.demo ? visitors : [...visitors, ...HOUSE_REGULARS];
    if (previousDemo !== state.demo) for (const [id, c] of characters) removeCharacter(id, c);
    const seen = new Set();
    visible.forEach((data, i) => {
      const id = String(data.sid ?? data.id ?? `agent-${i}`);
      seen.add(id);
      let c = characters.get(id);
      // Polls must not interrupt a house character's scripted walk.
      if (c && data.house) return;
      if (c?.hospitality?.departed) {
        // Presence can resume after a brief away/stale poll. A returning live
        // session must not finish a departure animation and vanish again.
        c.hospitality.departed = false; c.hospitality.replay = false;
        c.data = { ...data };
        if (['farewell', 'exiting'].includes(c.hospitality.phase)) settleVisitor(c);
        else if (c.speech) speech(c, c.speech.text.textContent);
      }
      const index = c?.index ?? (data.house ? HOUSE_REGULARS.findIndex(a => a.sid === id) : i);
      const destinationIndex = c?.hospitality && locationName(data.room || data.location || data.kind) === 'bar' ? c.hospitality.seat : index;
      const path = destinationPath(data, destinationIndex);
      const targetNode = path[path.length - 1];
      const dest = navigation.get(targetNode).point;
      if (!c) {
        c = robot({ ...data }, index); characters.set(id, c);
        c.nextWanderAt = elapsed + 4;
        c.wanderStep = 0;
        if (data.house || state.demo) {
          c.group.position.copy(dest); c.entered = true; c.lastNode = targetNode;
        } else {
          replayedVisits.add(id);
          startWelcome(c);
          return;
        }
      } else if (c.hospitality && c.hospitality.phase !== 'settled') {
        c.data = { ...data };
        return;
      } else if (!c.target.equals(dest)) {
        // Return along the current segment before taking another doorway.
        c.route = shortestRoute(c.lastNode, targetNode);
        if (reducedMotion) { c.group.position.copy(dest); c.lastNode = targetNode; c.route = []; }
      }
      c.data = { ...data };
      c.target.copy(dest);
      c.group.userData.location = locationName(data.room || data.location || data.kind);
    });
    for (const [id, c] of characters) if (!seen.has(id)) {
      if (!state.demo && c.hospitality) {
        c.hospitality.departed = true;
        if (c.speech) speech(c, c.speech.text.textContent);
      } else removeCharacter(id, c);
    }
    // A completed visit can fit entirely between polls. Replay only recent,
    // server-recorded departures, with explicit labels and no live headcount.
    if (!state.demo) for (const visit of (Array.isArray(state.recentVisits) ? state.recentVisits : []).slice(0, 12)) {
      const id = String(visit.sid || '');
      const left = Number(visit.departedAt);
      if (!id || replayedVisits.has(id) || characters.has(id) || visit.status !== 'departed' || !left || Date.now() - left > 90000 || left > Date.now() + 5000) continue;
      const c = robot({ ...visit, agent: visit.tempName || visit.agent || 'Guest', house: false, room: 'bar' }, visitors.length + welcomeSequence);
      characters.set(id, c); replayedVisits.add(id); startWelcome(c, true);
    }
    while (replayedVisits.size > 500) replayedVisits.delete(replayedVisits.values().next().value);
    if (previousDemo && !state.demo) { tapGlass.fill = 0.02; hover.style.display = 'none'; }
    const pours = state.pours;
    const latest = pours.reduce((best, pour) => !best || Number(pour.created || 0) >= Number(best.created || 0) ? pour : best, null);
    const pouringAgent = latest ? list.find(a => String(a.sid) === String(latest.sid)) : null;
    const pintTokens = Number(state.pintTokens) || Number(latest?.pintTokens) || 1000;
    const fillForAgent = a => {
      const tokens = Math.max(0, Number(a?.tokens) || 0);
      const fill = a?.glassFill != null && Number.isFinite(Number(a.glassFill)) ? Number(a.glassFill) : (tokens % pintTokens) / pintTokens;
      return tokens > 0 && fill === 0 ? 1 : THREE.MathUtils.clamp(fill, 0, 1);
    };
    const progress = pouringAgent ? fillForAgent(pouringAgent) : latest?.progress != null ? Number(latest.progress) || 0 : 0;
    const pourKey = latest ? `${latest.id || latest.sid}:${latest.created || ''}:${pouringAgent?.tokens ?? latest.tokens}` : '';
    if (pourKey !== lastPourKey) {
      // Old history must not become an active stream every time /bar is polled.
      if (!latest?.created || Date.now() - Number(latest.created) < 10000) lastPourChangedAt = performance.now();
      lastPourKey = pourKey;
    }
    tapGlass.target = THREE.MathUtils.clamp(progress, 0.015, 1);
    if (tapGlass.target < tapGlass.fill - 0.5) tapGlass.fill = 0.015;
    glasses.slice(1).forEach((g, i) => { g.target = state.demo ? 0.4 + (i % 4) * 0.14 : Math.max(0.015, fillForAgent(visitors[i])); });
    updateExpansion(state.world);
    updateRoomCounts();
  }

  let paused = false;
  let disposed = false;
  let frame = 0;
  let lastTime = performance.now();
  let elapsed = 0;
  let width = 1, height = 1;
  let focusTween = null;
  let focusedLocation = 'overview';
  let overviewWidth = 33.2, overviewHeight = 19.6;
  const projected = new THREE.Vector3();
  function measureOverview() {
    // Measure in the overview camera's axes, including each new annex and floor.
    // Per-mesh bounds avoid the excessive padding of one large world-space box.
    const viewRotation = new THREE.Matrix4().lookAt(viewOffset, new THREE.Vector3(), camera.up).invert();
    const bounds = new THREE.Box3();
    const objectBounds = new THREE.Box3();
    const transform = new THREE.Matrix4();
    root.updateWorldMatrix(true, true);
    root.traverse(object => {
      if (!object.isMesh || !object.geometry) return;
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      transform.multiplyMatrices(viewRotation, object.matrixWorld);
      objectBounds.copy(object.geometry.boundingBox).applyMatrix4(transform);
      bounds.union(objectBounds);
    });
    if (bounds.isEmpty()) return;
    const size = bounds.getSize(new THREE.Vector3());
    overviewWidth = size.x + 3;
    overviewHeight = size.y + 3;
    bounds.getCenter(overviewTarget).applyMatrix4(viewRotation.invert());
    if (focusedLocation === 'overview') {
      controls.target.copy(overviewTarget);
      camera.position.copy(overviewTarget).add(viewOffset);
      if (focusTween) focusTween.to.copy(overviewTarget);
    }
    resize();
  }
  function resize() {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    const aspect = width / height;
    const halfWidth = Math.max(overviewWidth / 2, aspect * overviewHeight / 2);
    camera.left = -halfWidth; camera.right = halfWidth;
    camera.top = halfWidth / aspect; camera.bottom = -halfWidth / aspect;
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let mouseDown = null;
  function intersection(event) {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(root.children, true);
    for (const hit of hits) {
      let obj = hit.object;
      while (obj && obj !== root) {
        if (obj.userData.character || obj.userData.location) return obj;
        obj = obj.parent;
      }
    }
    return null;
  }
  function pointerMove(event) {
    if (mouseDown) { hover.style.display = 'none'; return; }
    const hit = intersection(event);
    renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
    const c = hit?.userData.character;
    if (c) {
      const h = c.hospitality;
      const label = c.data.house ? ' · House character · scripted' : state.demo ? ' · demo' : h?.replay ? ' · Recent visit replay' : h?.departed ? ' · No longer on the live floor' : ' · Visiting agent';
      const welcome = h && h.phase !== 'settled' ? `\n${h.phase === 'exiting' || h.phase === 'farewell' ? 'Scripted goodbye — walking to the door' : 'Scripted house welcome — complimentary tea, zero token charge'}` : '';
      hover.textContent = `${String(c.data.agent || c.data.name || 'Anonymous agent').slice(0, 70)}${label}\n${String(c.data.doing || 'On a break').slice(0, 150)}${welcome}`;
      const bounds = host.getBoundingClientRect();
      hover.style.left = `${Math.min(width - 115, Math.max(115, event.clientX - bounds.left))}px`;
      hover.style.top = `${Math.max(75, event.clientY - bounds.top - 14)}px`;
      hover.style.display = 'block';
    } else hover.style.display = 'none';
  }
  function pointerDown(event) { mouseDown = [event.clientX, event.clientY]; }
  function pointerUp(event) {
    if (mouseDown && Math.hypot(event.clientX - mouseDown[0], event.clientY - mouseDown[1]) < 5) {
      const hit = intersection(event);
      if (hit?.userData.location) onSelect(hit.userData.location);
    }
    mouseDown = null;
  }
  function pointerLeave() { hover.style.display = 'none'; mouseDown = null; }
  renderer.domElement.addEventListener('pointermove', pointerMove);
  renderer.domElement.addEventListener('pointerdown', pointerDown);
  renderer.domElement.addEventListener('pointerup', pointerUp);
  renderer.domElement.addEventListener('pointerleave', pointerLeave);
  controls.addEventListener('start', () => { focusTween = null; focusedLocation = null; });

  function focus(location) {
    const point = focusPositions[location] || overviewTarget;
    focusedLocation = focusPositions[location] ? location : 'overview';
    const zoom = focusPositions[location] ? (location === 'bar' ? 2.05 : 2.6) : 1;
    if (reducedMotion) {
      controls.target.copy(point); camera.position.copy(point).add(viewOffset); camera.zoom = zoom; camera.updateProjectionMatrix();
    } else focusTween = { from: controls.target.clone(), to: point.clone(), offset: camera.position.clone().sub(controls.target), fromZoom: camera.zoom, zoom, start: performance.now() };
  }
  function animate(now) {
    if (disposed) return;
    frame = requestAnimationFrame(animate);
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    if (document.hidden) return;
    if (!paused) elapsed += dt;
    if (focusTween) {
      const t = THREE.MathUtils.clamp((now - focusTween.start) / 900, 0, 1);
      const e = t * t * (3 - 2 * t);
      controls.target.lerpVectors(focusTween.from, focusTween.to, e);
      camera.position.copy(controls.target).add(focusTween.offset);
      camera.zoom = THREE.MathUtils.lerp(focusTween.fromZoom, focusTween.zoom, e);
      camera.updateProjectionMatrix();
      if (t === 1) focusTween = null;
    }
    controls.update();
    const moving = !paused && !reducedMotion;
    if (!paused) hospitalityTick();
    characters.forEach(c => {
      while (c.route.length && c.group.position.distanceTo(navigation.get(c.route[0]).point) < 0.035) c.lastNode = c.route.shift();
      if (moving && c.data.house && c.data.kind === 'staff' && !c.route.length && elapsed >= c.nextWanderAt) {
        // Rue visits each room along the same doorway graph as API visitors.
        // These are animation waypoints, never orders or recorded work shifts.
        const stops = [
          { room: 'pool', path: [hub, [-9.5, 0.04, 3.6], [-9.5, 0.04, 2.4], [-11.08, 0.04, 2.4], [-12.6, 0.04, 2.4], [-12.6, 0.04, 5.35]] },
          { room: 'library', path: [hub, ...throughReadingDoor, [12.75, 0.04, -0.45]] },
          { room: 'booths', path: [hub, ...throughSnugDoor, [12.55, 0.04, 6.3]] },
          { room: 'bar', path: [hub, [2.85, 0.04, 3.6], [2.85, 0.04, -1.4]] },
        ];
        const stop = stops[c.wanderStep++ % stops.length];
        const path = connectPath(stop.path);
        const target = path[path.length - 1];
        c.route = shortestRoute(c.lastNode, target);
        c.target.copy(navigation.get(target).point);
        c.arrivalRoom = stop.room;
        c.nextWanderAt = Infinity;
      }
      const goal = c.route.length ? navigation.get(c.route[0]).point : c.target;
      const delta = goal.clone().sub(c.group.position);
      const walking = delta.length() > 0.035;
      if (moving && walking) {
        const step = Math.min(delta.length(), dt * 1.65);
        c.group.position.add(delta.normalize().multiplyScalar(step));
        c.group.rotation.y = Math.atan2(delta.x, delta.z);
        c.body.position.y = Math.abs(Math.sin(elapsed * 7 + c.phase)) * 0.035;
        c.leftLeg.rotation.x = Math.sin(elapsed * 7 + c.phase) * 0.35;
        c.rightLeg.rotation.x = -c.leftLeg.rotation.x;
        if (c.group.position.distanceTo(goal) < 0.08 && c.route.length) {
          c.group.position.copy(goal); c.lastNode = c.route.shift();
        }
      } else if (!walking || reducedMotion) {
        if (reducedMotion) c.group.position.copy(c.target);
        c.leftLeg.rotation.x = 0; c.rightLeg.rotation.x = 0;
        c.entered = true;
        if (c.arrivalRoom) {
          c.data.room = c.arrivalRoom;
          c.group.userData.location = c.arrivalRoom;
          c.arrivalRoom = null;
          c.nextWanderAt = elapsed + 16;
          updateRoomCounts();
        }
        const loc = c.hospitality && !['settled', 'farewell', 'exiting'].includes(c.hospitality.phase) ? 'bar' : locationName(c.data.room || c.data.location || c.data.kind);
        const angle = c.data.kind === 'bartender' ? 0 : loc === 'bar' ? Math.PI : loc === 'pool' ? (c.target.x < -17 ? Math.PI / 2 : -Math.PI / 2) : loc === 'booths' ? (c.target.x < (c.target.x > 11 ? 16.1 : 6.6) ? Math.PI / 2 : -Math.PI / 2) : -0.7;
        c.group.rotation.y = angle + (moving ? Math.sin(elapsed * 0.55 + c.phase) * 0.12 : 0);
        c.body.position.y = moving ? Math.sin(elapsed * 1.8 + c.phase) * 0.012 : 0;
      }
      // Tiny gestures make the service readable even from the overview. With
      // reduced motion the cup and speech remain, without waving or sliding.
      if (!paused) {
        c.rightArm.rotation.set(0, 0, 0); c.leftArm.rotation.set(0, 0, 0);
        const h = c.hospitality;
        if (moving && h?.phase === 'farewell') c.rightArm.rotation.z = -2.35 + Math.sin(elapsed * 7) * 0.22;
        if (moving && c.data.sid === 'house-moss' && hostGuest && !c.route.length) c.rightArm.rotation.x = -1.15;
        if (h?.phase === 'sipping') {
          const sip = moving ? Math.max(0, Math.sin((elapsed - h.since) * 1.1)) : 0;
          c.rightArm.rotation.x = -sip * 1.45;
          h.cup.position.set(c.target.x - sip * 0.28, 1.68 + sip * 0.34, -2.98 + sip * 0.85);
        }
      }
      if (c.speech && !c.speech.element.hidden) {
        projected.copy(c.group.position); projected.y += 2.1; projected.project(camera);
        const visible = projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1;
        c.speech.element.style.visibility = visible ? 'visible' : 'hidden';
        c.speech.element.style.left = `${Math.min(width - 110, Math.max(110, (projected.x * 0.5 + 0.5) * width))}px`;
        c.speech.element.style.top = `${Math.max(66, (-projected.y * 0.5 + 0.5) * height)}px`;
      }
    });
    if (state.demo && moving) tapGlass.target = Math.max(0.025, (elapsed % 15) / 12);
    glasses.forEach(g => {
      if (!paused) g.fill = moving ? THREE.MathUtils.damp(g.fill, Math.min(g.target, 1), 4, dt) : Math.min(g.target, 1);
      g.liquid.scale.y = g.fill;
      g.liquid.position.y = 0.035 + 0.2 * g.fill;
      g.foam.position.y = 0.05 + 0.4 * g.fill;
      g.foam.visible = g.fill > 0.025;
    });
    stream.visible = !paused && !reducedMotion && (state.demo ? elapsed % 15 < 12 : state.pours.length > 0 && tapGlass.target < 1 && now - lastPourChangedAt < 5000);
    if (moving) {
      if (state.demo || [...characters.values()].some(c => locationName(c.data.room || c.data.location) === 'pool')) {
        balls[0].object.position.x = balls[0].x + Math.sin(elapsed * 0.21) * 0.42;
        balls[0].object.position.z = balls[0].z + Math.sin(elapsed * 0.14) * 0.13;
      }
      const positions = moteGeo.attributes.position;
      moteOrigins.forEach((p, i) => {
        positions.setXYZ(i, p[0] + Math.sin(elapsed * 0.17 + i) * 0.14, p[1] + Math.sin(elapsed * 0.3 + i * 2) * 0.2, p[2]);
      });
      positions.needsUpdate = true;
      moon.rotation.z = Math.sin(elapsed * 0.15) * 0.08;
    }
    pins.forEach(p => {
      projected.copy(p.point).project(camera);
      const visible = projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < 1.1 && Math.abs(projected.y) < 1.1;
      p.element.style.visibility = visible ? 'visible' : 'hidden';
      p.element.style.left = `${(projected.x * 0.5 + 0.5) * width}px`;
      p.element.style.top = `${(-projected.y * 0.5 + 0.5) * height}px`;
    });
    renderer.render(scene, camera);
  }
  setState({});
  frame = requestAnimationFrame(animate);
  onReady({ ok: true });

  return {
    setState,
    focus,
    setPaused(value) { paused = Boolean(value); },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); resizeObserver.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener('pointermove', pointerMove);
      renderer.domElement.removeEventListener('pointerdown', pointerDown);
      renderer.domElement.removeEventListener('pointerup', pointerUp);
      renderer.domElement.removeEventListener('pointerleave', pointerLeave);
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
      environment.dispose(); renderer.dispose();
      renderer.domElement.remove(); overlay.remove(); style.remove();
    },
  };
}
