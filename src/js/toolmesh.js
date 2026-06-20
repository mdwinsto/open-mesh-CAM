import * as THREE from 'three';
import { buildWeldedOffsetGeometry } from './offset.js';
import { findBoundaryVertexIndices } from './mesh-utils.js';
import { state, config } from './state.js';
import { showNotification } from './ui.js';

function createOffsetMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
    roughness: 0.6,
    metalness: 0.1,
    depthWrite: false,
  });
}

function readOffset() {
  const offset = parseFloat(document.getElementById('tool-mesh-offset').value) || 3.175;
  if (offset <= 0) {
    showNotification('Tool mesh offset must be greater than 0.', 'error');
    return null;
  }
  return offset;
}

export function makeToolMesh() {
  if (!state.activeMesh) {
    showNotification('No mesh loaded.', 'error');
    return;
  }

  clearToolMesh();

  const offset = readOffset();
  if (offset === null) return;

  const iterations = parseInt(document.getElementById('smooth-iterations').value, 10) || 0;

  // Re-weld on position only then offset — strips face normals before merging
  // so vertices that share a position always get merged regardless of normal direction.
  // Normals are relaxed over `iterations` passes first so the offset doesn't
  // amplify faceting noise into self-crossing geometry.
  const geom = buildWeldedOffsetGeometry(state.activeMesh.geometry, offset, iterations);
  geom.computeBoundingBox();
  geom.computeBoundingSphere();

  const mesh = new THREE.Mesh(geom, createOffsetMaterial(0xf97316));
  mesh.position.copy(state.activeMesh.position);
  mesh.rotation.copy(state.activeMesh.rotation);
  mesh.scale.copy(state.activeMesh.scale);

  state.toolMesh = mesh;
  state.scene.add(mesh);

  buildBoundaryConnectors();

  showNotification(`Tool mesh generated (offset: ${offset} mm, ${iterations} smoothing pass${iterations !== 1 ? 'es' : ''}).`);
}

// Draw a line between each STL mesh boundary vertex and its corresponding
// tool mesh vertex. buildWeldedOffsetGeometry re-welds on position only and
// preserves first-occurrence vertex order, so vertex i in the tool mesh is
// always the offset of vertex i in the (already welded) STL mesh.
function buildBoundaryConnectors() {
  if (!state.activeMesh || !state.toolMesh) return;

  const srcPos = state.activeMesh.geometry.attributes.position;
  const dstPos = state.toolMesh.geometry.attributes.position;
  const boundaryIdx = findBoundaryVertexIndices(state.activeMesh.geometry);
  if (boundaryIdx.size === 0) return;

  const linePoints = [];
  for (const i of boundaryIdx) {
    linePoints.push(srcPos.getX(i), srcPos.getY(i), srcPos.getZ(i));
    linePoints.push(dstPos.getX(i), dstPos.getY(i), dstPos.getZ(i));
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(linePoints, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xfacc15, depthTest: false });
  const lines = new THREE.LineSegments(geom, mat);
  lines.position.copy(state.activeMesh.position);
  lines.rotation.copy(state.activeMesh.rotation);
  lines.scale.copy(state.activeMesh.scale);
  lines.visible = config.showBoundaryConnectors;

  state.boundaryConnectors = lines;
  state.scene.add(lines);
}

function clearBoundaryConnectors() {
  if (state.boundaryConnectors) {
    state.scene.remove(state.boundaryConnectors);
    state.boundaryConnectors.geometry.dispose();
    state.boundaryConnectors.material.dispose();
    state.boundaryConnectors = null;
  }
}

export function clearToolMesh() {
  clearBoundaryConnectors();
  if (state.toolMesh) {
    state.scene.remove(state.toolMesh);
    state.toolMesh.geometry.dispose();
    state.toolMesh.material.dispose();
    state.toolMesh = null;
  }
}
