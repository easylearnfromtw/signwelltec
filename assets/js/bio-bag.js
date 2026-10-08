/* A locally rendered, decorative pharmacy-sachet companion. THREE r169 (MIT). */
const stage = document.getElementById('bag-stage');
const chapters = [...document.querySelectorAll('[data-chapter]')];
const lanes = chapters.map(chapter => chapter.querySelector('.bag-anchor'));

if (stage && lanes.length && lanes.every(Boolean)) {
  startCompanion().catch(() => {
    document.body.classList.remove('bag-ready');
    stage.style.visibility = 'hidden';
  });
}

async function startCompanion() {
  // The static sachets remain visible until both the import and first GPU frame succeed.
  const THREE = await import('../vendor/three.module.min.js');
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = motionQuery.matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
      failIfMajorPerformanceCaveat: false,
    });
  } catch {
    return;
  }

  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none';
  stage.setAttribute('aria-hidden', 'true');
  stage.style.pointerEvents = 'none';
  stage.style.overflow = 'hidden';
  stage.appendChild(canvas);
  renderer.setClearColor(0xffffff, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.97;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-2, 2, 2.2, -2.2, 0.1, 30);
  camera.position.set(0, 0.1, 9);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xf5f8ff, 0xb3a389, 1.65));
  const keyLight = new THREE.DirectionalLight(0xfff3df, 2.25);
  keyLight.position.set(-3, 5, 6);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xc6daff, 0.70);
  fillLight.position.set(4, 1, 3);
  scene.add(fillLight);
  const rimLight = new THREE.DirectionalLight(0xffffff, 1.7);
  rimLight.position.set(2, 3, -4);
  scene.add(rimLight);

  const model = buildSachet(THREE);
  scene.add(model.root, model.orbit, model.shadow);

  const poses = [
    { y: -0.17, z: -0.075, left: -0.06, right: 0.13 },
    { y: 0.17, z: 0.075, left: 0.07, right: -0.15 },
    { y: -0.13, z: -0.045, left: -0.10, right: 0.04 },
    { y: 0.15, z: 0.05, left: 0.07, right: -0.10 },
    { y: -0.13, z: -0.07, left: -0.08, right: 0.11 },
    { y: 0.10, z: 0.02, left: 0.06, right: -0.08 },
  ];
  let active = -1;
  let destination = -1;
  let opacity = 0;
  let frame = 0;
  let failed = false;
  let ready = false;
  let layoutDirty = true;
  let lastFrame = 0;
  let lastWidth = 0;
  let lastHeight = 0;
  let poseY = poses[0].y;
  let poseZ = poses[0].z;
  let lastTime = 0;
  let visible = false;

  function inViewport(rect) {
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
  }

  function pickChapter() {
    const focus = innerHeight * 0.51;
    let closest = Infinity;
    let selected = -1;
    for (let i = 0; i < chapters.length; i++) {
      const rect = chapters[i].getBoundingClientRect();
      const lane = lanes[i].getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > innerHeight || !inViewport(lane)) continue;
      const distance = focus < rect.top ? rect.top - focus : focus > rect.bottom ? focus - rect.bottom : 0;
      // The second tie-breaker works for both ordinary and overlapping sticky chapters.
      const score = distance + Math.abs((rect.top + rect.bottom) / 2 - focus) * 0.01;
      if (score < closest) {
        closest = score;
        selected = i;
      }
    }
    destination = selected;
    visible = destination !== -1;
    layoutDirty = false;
  }

  function placeStage() {
    if (active < 0) return false;
    const rect = lanes[active].getBoundingClientRect();
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    if (!width || !height) return false;
    // Never interpolate the canvas through the text column. Its complete drawable
    // area is clipped to the actual, current visual lane on every scroll frame.
    stage.style.transform = `translate3d(${rect.left.toFixed(2)}px,${rect.top.toFixed(2)}px,0)`;
    stage.style.left = '0';
    stage.style.top = '0';
    stage.style.width = `${width}px`;
    stage.style.height = `${height}px`;
    if (width !== lastWidth || height !== lastHeight) {
      lastWidth = width;
      lastHeight = height;
      renderer.setSize(width, height, false);
      const aspect = width / height;
      const viewHeight = Math.max(3.95, 3.65 / aspect);
      camera.left = -viewHeight * aspect / 2;
      camera.right = viewHeight * aspect / 2;
      camera.top = viewHeight / 2;
      camera.bottom = -viewHeight / 2;
      camera.updateProjectionMatrix();
    }
    return inViewport(rect);
  }

  function render(now) {
    frame = 0;
    if (failed || document.hidden) return;
    if (layoutDirty) pickChapter();
    if (!visible) {
      stage.style.visibility = 'hidden';
      stage.style.opacity = '0';
      opacity = 0;
      lastTime = now;
      return;
    }
    const dt = Math.min((now - lastTime) / 1000 || 1 / 30, 0.075);
    lastTime = now;
    if (active < 0 || reducedMotion) active = destination;
    if (destination !== active) {
      // There is nothing to fade when the previous lane has already scrolled
      // away. Relocate invisibly now, then reveal the newly visible companion.
      if (!inViewport(lanes[active].getBoundingClientRect())) {
        opacity = 0;
        active = destination;
        poseY = poses[active % poses.length].y;
        poseZ = poses[active % poses.length].z;
      }
      opacity = Math.max(0, opacity - dt * 6);
      if (opacity < 0.035) {
        active = destination;
        poseY = poses[active % poses.length].y;
        poseZ = poses[active % poses.length].z;
      }
    } else {
      opacity = reducedMotion ? 1 : Math.min(1, opacity + dt * 4.2);
    }
    const onScreen = placeStage();
    if (!onScreen) {
      stage.style.visibility = 'hidden';
      stage.style.opacity = '0';
      opacity = 0;
      // Scroll, resize, and the lane ResizeObserver restart rendering when the
      // visual returns; a long text-only stretch needs no animation frames.
      return;
    }
    const pose = poses[active % poses.length];
    const ease = reducedMotion ? 1 : 1 - Math.exp(-dt * 5);
    poseY += (pose.y - poseY) * ease;
    poseZ += (pose.z - poseZ) * ease;
    const time = reducedMotion ? 0 : now / 1000;
    model.root.rotation.set(-0.045 + Math.sin(time * 0.75) * 0.016, poseY + Math.sin(time * 0.52) * 0.038, poseZ + Math.sin(time * 0.85) * 0.018);
    model.root.position.y = 0.06 + Math.sin(time * 1.2) * 0.038;
    model.leftArm.rotation.z = pose.left + Math.sin(time * 1.15) * 0.035;
    model.rightArm.rotation.z = pose.right + Math.sin(time * 1.1 + 1.4) * 0.03;
    model.leftFoot.rotation.z = Math.sin(time * 0.85) * 0.025;
    model.rightFoot.rotation.z = -Math.sin(time * 0.85) * 0.025;
    model.capsuleRed.position.y = 0.88 + Math.sin(time * 0.83 + 0.7) * 0.115;
    model.capsuleBlue.position.y = -0.16 + Math.sin(time * 0.73 + 2.1) * 0.11;
    model.capsuleRed.rotation.z = -0.58 + Math.sin(time * 0.54) * 0.09;
    model.capsuleBlue.rotation.z = 0.48 + Math.sin(time * 0.63) * 0.1;
    model.orbit.rotation.z = Math.sin(time * 0.3) * 0.022;
    model.shadow.material.opacity = 0.22 - Math.sin(time * 1.2) * 0.012;
    stage.style.opacity = opacity.toFixed(3);
    stage.style.visibility = 'visible';

    // Thirty GPU frames per second is enough for the gentle toy motion. Scroll
    // positioning remains on every animation frame, including between GPU frames.
    if (reducedMotion || !ready || now - lastFrame >= 1000 / 30) {
      try {
        renderer.render(scene, camera);
        lastFrame = now;
        if (!ready) {
          ready = true;
          document.body.classList.add('bag-ready');
        }
      } catch {
        fallback();
        return;
      }
    }
    if (!reducedMotion) frame = requestAnimationFrame(render);
  }

  function invalidate() {
    if (failed) return;
    layoutDirty = true;
    if (!frame && !document.hidden) frame = requestAnimationFrame(render);
  }

  function fallback() {
    if (failed) return;
    failed = true;
    cancelAnimationFrame(frame);
    document.body.classList.remove('bag-ready');
    stage.style.visibility = 'hidden';
    stage.style.opacity = '0';
    window.removeEventListener('scroll', invalidate);
    window.removeEventListener('resize', invalidate);
    document.removeEventListener('visibilitychange', onVisibility);
    motionQuery.removeEventListener('change', onMotion);
    sizeObserver?.disconnect();
    scene.traverse(object => {
      object.geometry?.dispose();
      const materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
      for (const material of materials) {
        material.map?.dispose();
        material.dispose();
      }
    });
    renderer.dispose();
    canvas.remove();
  }

  function onVisibility() {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else invalidate();
  }

  function onMotion(event) {
    reducedMotion = event.matches;
    cancelAnimationFrame(frame);
    frame = 0;
    invalidate();
  }

  const sizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(invalidate) : null;
  for (const lane of lanes) sizeObserver?.observe(lane);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    fallback();
  });
  window.addEventListener('scroll', invalidate, { passive: true });
  window.addEventListener('resize', invalidate, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  motionQuery.addEventListener('change', onMotion);
  invalidate();
}

function buildSachet(THREE) {
  const root = new THREE.Group();
  const orbit = new THREE.Group();
  const paper = new THREE.MeshStandardMaterial({ color: 0xf2e7cf, roughness: 0.83, metalness: 0 });
  const seamPaper = new THREE.MeshStandardMaterial({ color: 0xe5d3b2, roughness: 0.9, side: THREE.DoubleSide });
  const cream = new THREE.MeshStandardMaterial({ color: 0xfff3df, roughness: 0.58 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x214f95, roughness: 0.34, metalness: 0.06 });
  const red = new THREE.MeshStandardMaterial({ color: 0xe76248, roughness: 0.32 });
  const ink = new THREE.MeshStandardMaterial({ color: 0x183148, roughness: 0.36 });
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.32 });

  function surface(x, y) {
    const u = x / 1.01;
    const v = y / 1.13;
    const fullness = Math.pow(Math.max(0, (1 - u * u) * (1 - v * v)), 0.44);
    const fold = 0.009 * Math.sin(x * 29 + y * 3) * Math.pow(Math.abs(v), 7);
    return 0.035 + 0.37 * fullness + fold;
  }

  // Two gently inflated paper surfaces meet along a thin rounded edge. The
  // narrowing corners, tiny seal folds, and changing thickness read as a pouch.
  const vertices = [];
  const indices = [];
  const columns = 48;
  const rows = 62;
  const faceSize = (columns + 1) * (rows + 1);
  for (const side of [1, -1]) {
    for (let j = 0; j <= rows; j++) {
      const v = j / rows * 2 - 1;
      const y = v * 1.13;
      const halfWidth = 1.01 - 0.075 * Math.pow(Math.abs(v), 10);
      for (let i = 0; i <= columns; i++) {
        const u = i / columns * 2 - 1;
        const x = u * halfWidth;
        const z = surface(u * 1.01, y);
        vertices.push(x, y, side * z);
      }
    }
  }
  for (let face = 0; face < 2; face++) {
    const offset = face * faceSize;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < columns; i++) {
        const a = offset + j * (columns + 1) + i;
        const b = a + 1;
        const c = a + columns + 1;
        const d = c + 1;
        if (face === 0) indices.push(a, b, d, a, d, c);
        else indices.push(a, d, b, a, c, d);
      }
    }
  }
  const edge = [];
  for (let i = 0; i <= columns; i++) edge.push(i);
  for (let j = 1; j <= rows; j++) edge.push(j * (columns + 1) + columns);
  for (let i = columns - 1; i >= 0; i--) edge.push(rows * (columns + 1) + i);
  for (let j = rows - 1; j > 0; j--) edge.push(j * (columns + 1));
  for (let i = 0; i < edge.length; i++) {
    const a = edge[i];
    const b = edge[(i + 1) % edge.length];
    indices.push(a, a + faceSize, b, b, a + faceSize, b + faceSize);
  }
  const bagGeometry = new THREE.BufferGeometry();
  bagGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  bagGeometry.setIndex(indices);
  bagGeometry.computeVertexNormals();
  root.add(new THREE.Mesh(bagGeometry, paper));

  function makeSeal(y, direction) {
    const geometry = new THREE.PlaneGeometry(2.075, 0.205, 100, 5);
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const localY = position.getY(i);
      const edgeTooth = Math.abs(localY - direction * 0.1025) < 0.002 ? Math.cos(x * 150) * 0.012 : 0;
      position.setXYZ(i, x, localY + edgeTooth, 0.045 + Math.sin(x * 96) * 0.009);
    }
    geometry.computeVertexNormals();
    const seal = new THREE.Mesh(geometry, seamPaper);
    seal.position.y = y;
    root.add(seal);
    const reverse = new THREE.Mesh(geometry, seamPaper);
    reverse.position.set(0, y, -0.095);
    root.add(reverse);

    const lineGeometry = new THREE.CylinderGeometry(0.005, 0.005, 1.995, 5);
    const stitch = new THREE.Mesh(lineGeometry, cream);
    stitch.rotation.z = Math.PI / 2;
    stitch.position.set(0, y - direction * 0.063, 0.057);
    root.add(stitch);
  }
  makeSeal(1.195, 1);
  makeSeal(-1.195, -1);

  // Printed label is curved to follow the actual front surface, rather than a
  // floating flat card. Its texture is generated once and never needs a request.
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 1024;
  labelCanvas.height = 512;
  const label = labelCanvas.getContext('2d');
  label.fillStyle = '#faf6e9';
  label.strokeStyle = '#2b527a';
  label.lineWidth = 5;
  label.beginPath();
  label.roundRect(12, 12, 1000, 488, 31);
  label.fill();
  label.stroke();
  label.fillStyle = '#245589';
  label.font = 'bold 51px Arial, sans-serif';
  label.letterSpacing = '5px';
  label.fillText('SIGNWELL BIO', 62, 91);
  label.letterSpacing = '0px';
  label.fillStyle = '#e5674b';
  label.fillRect(844, 49, 34, 111);
  label.fillRect(806, 87, 110, 34);
  label.fillStyle = '#245589';
  label.font = 'bold 175px Georgia, serif';
  label.fillText('Rx', 66, 311);
  label.font = 'bold 29px Arial, sans-serif';
  label.fillText('A LITTLE CARE,', 347, 214);
  label.fillText('EVERY SINGLE DAY.', 347, 255);
  label.strokeStyle = '#bdc7c8';
  label.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    label.beginPath();
    label.moveTo(349, 289 + i * 31);
    label.lineTo(926 - i * 43, 289 + i * 31);
    label.stroke();
  }
  label.fillStyle = '#356385';
  label.font = '25px Arial, sans-serif';
  label.fillText('KNOWLEDGE  /  HEALTH  /  YOU', 65, 435);
  // A tiny, varied pharmacy barcode gives the label the familiar sachet detail.
  let barcodeX = 791;
  for (let i = 0; i < 27; i++) {
    const width = i % 4 === 0 ? 5 : 2;
    label.fillRect(barcodeX, 385, width, 51);
    barcodeX += width + 3;
  }
  const labelTexture = new THREE.CanvasTexture(labelCanvas);
  labelTexture.colorSpace = THREE.SRGBColorSpace;
  labelTexture.anisotropy = 2;
  const labelGeometry = new THREE.PlaneGeometry(1.63, 0.735, 24, 14);
  const labelPosition = labelGeometry.attributes.position;
  for (let i = 0; i < labelPosition.count; i++) {
    const x = labelPosition.getX(i);
    const y = labelPosition.getY(i) - 0.60;
    labelPosition.setXYZ(i, x, y, surface(x, y) + 0.007);
  }
  labelGeometry.computeVertexNormals();
  root.add(new THREE.Mesh(labelGeometry, new THREE.MeshStandardMaterial({ map: labelTexture, transparent: true, roughness: 0.87, depthWrite: false })));

  const sphere = new THREE.SphereGeometry(1, 20, 16);
  function ball(material, x, y, z, sx, sy = sx, sz = sx, parent = root) {
    const mesh = new THREE.Mesh(sphere, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    parent.add(mesh);
    return mesh;
  }

  for (const side of [-1, 1]) {
    const x = side * 0.283;
    const eyeZ = surface(x, 0.46);
    ball(ink, x, 0.46, eyeZ + 0.027, 0.082, 0.111, 0.053);
    ball(white, x - 0.022, 0.497, eyeZ + 0.073, 0.024, 0.029, 0.014);
    const cheek = new THREE.MeshStandardMaterial({ color: 0xe89c88, transparent: true, opacity: 0.65, roughness: 0.9 });
    ball(cheek, side * 0.50, 0.224, surface(side * 0.50, 0.224) + 0.008, 0.105, 0.058, 0.014);
    const eyebrowPath = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(x - 0.062, 0.672, surface(x - 0.062, 0.672) + 0.012),
      new THREE.Vector3(x, 0.704, surface(x, 0.704) + 0.012),
      new THREE.Vector3(x + 0.063, 0.672, surface(x + 0.063, 0.672) + 0.012),
    );
    root.add(new THREE.Mesh(new THREE.TubeGeometry(eyebrowPath, 14, 0.012, 6, false), ink));
  }
  const smilePath = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.15, 0.23, 0.41),
    new THREE.Vector3(0, 0.045, 0.43),
    new THREE.Vector3(0.15, 0.23, 0.41),
  );
  root.add(new THREE.Mesh(new THREE.TubeGeometry(smilePath, 22, 0.021, 8, false), ink));
  ball(ink, -0.15, 0.23, 0.411, 0.022);
  ball(ink, 0.15, 0.23, 0.411, 0.022);

  function makeArm(side) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.93, -0.34, 0.01);
    const end = side < 0 ? new THREE.Vector3(-0.37, 0.56, 0.13) : new THREE.Vector3(0.37, -0.08, 0.18);
    const path = new THREE.CubicBezierCurve3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(side * 0.20, side < 0 ? 0.06 : -0.14, 0.08),
      new THREE.Vector3(side * 0.39, side < 0 ? 0.29 : -0.18, 0.12),
      end,
    );
    arm.add(new THREE.Mesh(new THREE.TubeGeometry(path, 20, 0.055, 9, false), cream));
    ball(cream, end.x, end.y, end.z, 0.104, 0.121, 0.093, arm);
    ball(cream, end.x - side * 0.083, end.y - 0.031, end.z + 0.016, 0.05, 0.06, 0.048, arm);
    root.add(arm);
    return arm;
  }
  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  function makeFoot(side) {
    const foot = new THREE.Group();
    foot.position.set(side * 0.41, -1.21, 0.025);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.20, 4, 9), cream);
    leg.position.y = -0.085;
    foot.add(leg);
    ball(cream, side * 0.023, -0.252, 0.09, 0.237, 0.047, 0.293, foot);
    ball(blue, side * 0.023, -0.199, 0.094, 0.229, 0.116, 0.283, foot);
    root.add(foot);
    return foot;
  }
  const leftFoot = makeFoot(-1);
  const rightFoot = makeFoot(1);

  function makeCapsule(material) {
    const capsule = new THREE.Group();
    const halfCylinder = new THREE.CylinderGeometry(0.102, 0.102, 0.235, 20, 1, true);
    const upper = new THREE.Mesh(halfCylinder, material);
    upper.position.y = 0.1175;
    capsule.add(upper);
    const lower = new THREE.Mesh(halfCylinder, white);
    lower.position.y = -0.1175;
    capsule.add(lower);
    const upperEnd = new THREE.Mesh(new THREE.SphereGeometry(0.102, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), material);
    upperEnd.position.y = 0.235;
    capsule.add(upperEnd);
    const lowerEnd = new THREE.Mesh(new THREE.SphereGeometry(0.102, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), white);
    lowerEnd.position.y = -0.235;
    capsule.add(lowerEnd);
    const join = new THREE.Mesh(new THREE.TorusGeometry(0.102, 0.004, 5, 20), cream);
    join.rotation.x = Math.PI / 2;
    capsule.add(join);
    orbit.add(capsule);
    return capsule;
  }
  const capsuleRed = makeCapsule(red);
  capsuleRed.position.set(1.27, 0.94, -0.03);
  capsuleRed.rotation.set(-0.18, 0.25, -0.58);
  const capsuleBlue = makeCapsule(blue);
  capsuleBlue.position.set(-1.35, -0.15, -0.04);
  capsuleBlue.rotation.set(0.1, -0.18, 0.48);

  const points = [];
  for (let i = 0; i < 100; i++) {
    const angle = i / 100 * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * 1.49, Math.sin(angle) * 1.25 + 0.10, -0.50));
  }
  const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x74909e, transparent: true, opacity: 0.23 }));
  ring.rotation.z = -0.22;
  orbit.add(ring);
  ball(blue, 0.94, -1.12, -0.5, 0.031, 0.031, 0.031, orbit);
  ball(red, -0.95, 1.0, -0.5, 0.026, 0.026, 0.026, orbit);

  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 256;
  shadowCanvas.height = 64;
  const shadowContext = shadowCanvas.getContext('2d');
  shadowContext.scale(1, 0.25);
  const gradient = shadowContext.createRadialGradient(128, 128, 3, 128, 128, 120);
  gradient.addColorStop(0, 'rgba(58,65,75,.55)');
  gradient.addColorStop(0.5, 'rgba(58,65,75,.20)');
  gradient.addColorStop(1, 'rgba(58,65,75,0)');
  shadowContext.fillStyle = gradient;
  shadowContext.fillRect(0, 0, 256, 256);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.75, 0.45), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false }));
  shadow.position.set(0.02, -1.61, -0.25);

  return { root, orbit, shadow, leftArm, rightArm, leftFoot, rightFoot, capsuleRed, capsuleBlue };
}
