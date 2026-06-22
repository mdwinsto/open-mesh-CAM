import * as THREE from 'three';
import { state, config } from './state.js';
import { calculateMetadata } from './analytics.js';
import { clearSelection } from './raycaster.js';
import { clearSlices } from './slicing.js';
import { clearToolMesh } from './toolmesh.js';

export function displaySTL(geometry, filename, fileSize, isBinary) {
  clearActiveModels();

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const material = new THREE.MeshStandardMaterial({
    color: 0x374151,
    roughness: 0.4,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });
  state.activeMesh = new THREE.Mesh(geometry, material);
  state.activeMesh.castShadow = true;
  state.activeMesh.receiveShadow = true;

  const wireframeMat = new THREE.LineBasicMaterial({
    color: 0x6366f1,
    transparent: true,
    opacity: 0.8,
  });
  state.activeWireframe = new THREE.LineSegments(new THREE.WireframeGeometry(geometry), wireframeMat);

  state.scene.add(state.activeMesh);
  state.scene.add(state.activeWireframe);

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
}

export function centerAndScaleModel() {
  if (!state.activeMesh) return;

  // The mesh keeps its native STL coordinates (no geometry.center() applied),
  // so camera framing and the grid must target the bounding box's actual
  // center/bottom instead of assuming the model sits at the world origin.
  const box = state.activeMesh.geometry.boundingBox;
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);

  state.activeMesh.position.set(0, 0, 0);
  if (state.activeWireframe) state.activeWireframe.position.set(0, 0, 0);

  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = state.camera.fov * (Math.PI / 180);
  let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.45;

  state.camera.position.set(center.x + cameraZ * 0.7, center.y - cameraZ * 1.1, center.z + cameraZ * 0.7);
  state.camera.up.set(0, 0, 1);
  state.camera.lookAt(center.x, center.y, center.z);
  state.controls.target.copy(center);
  state.camera.far = Math.max(1000, cameraZ * 6);
  state.camera.updateProjectionMatrix();

  if (state.gridHelper) state.scene.remove(state.gridHelper);
  state.gridHelper = new THREE.GridHelper(maxDim * 3.5, 80, 0x312e81, 0x1f2937);
  state.gridHelper.rotation.x = Math.PI / 2;
  state.gridHelper.position.set(center.x, center.y, box.min.z - 1.0);
  state.scene.add(state.gridHelper);
  state.gridHelper.visible = config.showGrid;
}

export function applyRenderSettings() {
  if (!state.activeMesh) return;

  const showEdges = config.renderMode !== 'mesh';
  const showMesh = config.renderMode !== 'edges';

  state.activeMesh.visible = showMesh && config.showStlMesh;
  if (state.activeWireframe) state.activeWireframe.visible = showEdges && config.showStlMesh;

  if (state.gridHelper) state.gridHelper.visible = config.showGrid;
  if (state.boundaryConnectors) state.boundaryConnectors.visible = config.showBoundaryConnectors;
  if (state.toolMesh) state.toolMesh.visible = config.showToolMesh;
  state.activeSlices.forEach((slice) => { slice.visible = config.showSlices; });
  state.activeToolpaths.forEach((tp) => { tp.visible = config.showToolpaths; });
  if (state.gcodeVisualization) state.gcodeVisualization.visible = config.showGcodePath;
}
