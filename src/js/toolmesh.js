import * as THREE from 'three';
import { state } from './state.js';
import { showNotification } from './ui.js';

export function generateToolMesh() {
  if (!state.activeMesh) {
    showNotification('No mesh loaded.', 'error');
    return;
  }

  clearToolMesh();

  const offset = parseFloat(document.getElementById('tool-mesh-offset').value) || 3.175;
  if (offset <= 0) {
    showNotification('Tool mesh offset must be greater than 0.', 'error');
    return;
  }

  // Geometry is already welded and has smooth normals from the load pipeline;
  // clone it so we can offset positions without modifying the original
  const geom = state.activeMesh.geometry.clone();

  const pos = geom.attributes.position;
  const norm = geom.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(
      i,
      pos.getX(i) + norm.getX(i) * offset,
      pos.getY(i) + norm.getY(i) * offset,
      pos.getZ(i) + norm.getZ(i) * offset,
    );
  }
  pos.needsUpdate = true;
  geom.computeBoundingBox();
  geom.computeBoundingSphere();

  const mat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
    roughness: 0.6,
    metalness: 0.1,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.copy(state.activeMesh.position);
  mesh.rotation.copy(state.activeMesh.rotation);
  mesh.scale.copy(state.activeMesh.scale);

  state.toolMesh = mesh;
  state.scene.add(mesh);

  showNotification(`Tool mesh generated (offset: ${offset} mm).`);
}

export function clearToolMesh() {
  if (state.toolMesh) {
    state.scene.remove(state.toolMesh);
    state.toolMesh.geometry.dispose();
    state.toolMesh.material.dispose();
    state.toolMesh = null;
  }
}
