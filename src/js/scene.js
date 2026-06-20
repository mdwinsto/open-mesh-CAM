import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { state, config } from './state.js';

export function initThree() {
  const container = document.getElementById('canvas-container');
  const initialWidth = Math.max(container.clientWidth, 400);
  const initialHeight = Math.max(container.clientHeight, 300);

  state.scene = new THREE.Scene();
  state.scene.background = new THREE.Color(config.bgColor);

  state.camera = new THREE.PerspectiveCamera(45, initialWidth / initialHeight, 0.1, 1000);
  state.camera.up.set(0, 0, 1);
  state.camera.position.set(50, -80, 50);

  state.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  state.renderer.setSize(initialWidth, initialHeight);
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  state.renderer.shadowMap.enabled = true;
  state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(state.renderer.domElement);

  state.controls = new OrbitControls(state.camera, state.renderer.domElement);
  state.controls.enableDamping = true;
  state.controls.dampingFactor = 0.05;
  state.controls.maxDistance = 600;
  state.controls.minDistance = 5;

  state.ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
  state.scene.add(state.ambientLight);

  state.dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
  state.dirLight.position.set(80, -80, 150);
  state.dirLight.castShadow = true;
  state.dirLight.shadow.mapSize.width = 2048;
  state.dirLight.shadow.mapSize.height = 2048;
  state.dirLight.shadow.camera.near = 0.5;
  state.dirLight.shadow.camera.far = 400;
  const d = 100;
  state.dirLight.shadow.camera.left = -d;
  state.dirLight.shadow.camera.right = d;
  state.dirLight.shadow.camera.top = d;
  state.dirLight.shadow.camera.bottom = -d;
  state.dirLight.shadow.bias = -0.0005;
  state.scene.add(state.dirLight);

  state.cameraLight = new THREE.DirectionalLight(0xffffff, 0.35);
  state.scene.add(state.cameraLight);

  state.gridHelper = new THREE.GridHelper(200, 100, 0x312e81, 0x1f2937);
  state.gridHelper.rotation.x = Math.PI / 2;
  state.gridHelper.position.z = -0.01;
  state.scene.add(state.gridHelper);

  state.raycaster = new THREE.Raycaster();
  state.mouse = new THREE.Vector2();

  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const width = Math.floor(entry.contentRect.width || container.clientWidth);
      const height = Math.floor(entry.contentRect.height || container.clientHeight);
      if (width > 0 && height > 0) {
        state.camera.aspect = width / height;
        state.camera.updateProjectionMatrix();
        state.renderer.setSize(width, height);
      }
    }
  });
  resizeObserver.observe(container);

  window.addEventListener('resize', () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w > 0 && h > 0) {
      state.camera.aspect = w / h;
      state.camera.updateProjectionMatrix();
      state.renderer.setSize(w, h);
    }
  });

  animate();
}

function animate() {
  requestAnimationFrame(animate);

  state.cameraLight.position.copy(state.camera.position);
  state.controls.update();
  state.renderer.render(state.scene, state.camera);
}
