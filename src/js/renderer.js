import * as THREE from 'three';
import { state, config } from './state.js';
import { calculateMetadata } from './analytics.js';
import { clearSelection } from './raycaster.js';
import { clearSlices } from './slicing.js';
import { clearToolMesh } from './toolmesh.js';

export function displaySTL(geometry, filename, fileSize, isBinary) {
  clearActiveModels();

  geometry.computeVertexNormals();
  geometry.center();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(config.meshColor),
    roughness: 0.4,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });
  state.activeMesh = new THREE.Mesh(geometry, material);
  state.activeMesh.castShadow = true;
  state.activeMesh.receiveShadow = true;

  const wireframeMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(config.edgeColor),
    transparent: true,
    opacity: 0.8,
  });
  state.activeWireframe = new THREE.LineSegments(new THREE.WireframeGeometry(geometry), wireframeMat);

  const edgesMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(config.edgeColor),
    transparent: true,
    opacity: 0.9,
  });
  state.activeEdgesLine = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, config.thresholdAngle),
    edgesMat
  );

  state.scene.add(state.activeMesh);
  state.scene.add(state.activeWireframe);
  state.scene.add(state.activeEdgesLine);

  centerAndScaleModel();
  applyRenderSettings();
  calculateMetadata(geometry, isBinary);

  document.getElementById('loader-badge').classList.add('hidden');
  document.getElementById('canvas-overlay').classList.add('hidden');
}

export function clearActiveModels() {
  clearSelection();
  clearSlices();
  clearToolMesh();

  const dispose = (obj, key) => {
    if (obj) {
      state.scene.remove(obj);
      obj.geometry.dispose();
      obj.material.dispose();
    }
    state[key] = null;
  };

  dispose(state.activeMesh, 'activeMesh');
  dispose(state.activeWireframe, 'activeWireframe');
  dispose(state.activeEdgesLine, 'activeEdgesLine');
}

export function centerAndScaleModel() {
  if (!state.activeMesh) return;

  const box = state.activeMesh.geometry.boundingBox;
  const size = new THREE.Vector3();
  box.getSize(size);

  state.activeMesh.position.set(0, 0, 0);
  if (state.activeWireframe) state.activeWireframe.position.set(0, 0, 0);
  if (state.activeEdgesLine) state.activeEdgesLine.position.set(0, 0, 0);

  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = state.camera.fov * (Math.PI / 180);
  let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.45;

  state.camera.position.set(cameraZ * 0.7, -cameraZ * 1.1, cameraZ * 0.7);
  state.camera.up.set(0, 0, 1);
  state.camera.lookAt(0, 0, 0);
  state.controls.target.set(0, 0, 0);
  state.camera.far = Math.max(1000, cameraZ * 6);
  state.camera.updateProjectionMatrix();

  if (state.gridHelper) state.scene.remove(state.gridHelper);
  state.gridHelper = new THREE.GridHelper(maxDim * 3.5, 80, 0x312e81, 0x1f2937);
  state.gridHelper.rotation.x = Math.PI / 2;
  state.gridHelper.position.z = -(size.z / 2) - 1.0;
  state.scene.add(state.gridHelper);
  state.gridHelper.visible = config.showGrid;
}

export function applyRenderSettings() {
  if (!state.activeMesh) return;

  const showEdges = config.renderMode !== 'mesh';
  const showMesh = config.renderMode !== 'edges';

  state.activeMesh.visible = showMesh;
  if (state.activeWireframe) state.activeWireframe.visible = showEdges && config.edgeType === 'all';
  if (state.activeEdgesLine) state.activeEdgesLine.visible = showEdges && config.edgeType === 'smart';

  state.activeMesh.material.color.set(config.meshColor);
  if (state.activeWireframe) state.activeWireframe.material.color.set(config.edgeColor);
  if (state.activeEdgesLine) state.activeEdgesLine.material.color.set(config.edgeColor);

  state.scene.background.set(config.bgColor);
  if (state.gridHelper) state.gridHelper.visible = config.showGrid;
  if (state.boundaryConnectors) state.boundaryConnectors.visible = config.showBoundaryConnectors;
}
