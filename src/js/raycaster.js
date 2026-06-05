import * as THREE from 'three';
import { state } from './state.js';
import { showNotification } from './ui.js';

export function onPointerDown(event) {
  state.pointerDownX = event.clientX;
  state.pointerDownY = event.clientY;
  state.mouseDownTime = performance.now();
}

export function onPointerUp(event) {
  const deltaX = Math.abs(event.clientX - state.pointerDownX);
  const deltaY = Math.abs(event.clientY - state.pointerDownY);
  const clickDuration = performance.now() - state.mouseDownTime;

  if (deltaX < 4 && deltaY < 4 && clickDuration < 300) {
    const rect = state.renderer.domElement.getBoundingClientRect();
    state.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    state.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    performRaycast();
  }
}

function performRaycast() {
  if (!state.activeMesh) return;

  state.raycaster.setFromCamera(state.mouse, state.camera);
  const intersects = state.raycaster.intersectObject(state.activeMesh);
  if (intersects.length === 0) return;

  const { face } = intersects[0];
  const posAttr = state.activeMesh.geometry.attributes.position;
  const vA = new THREE.Vector3().fromBufferAttribute(posAttr, face.a).applyMatrix4(state.activeMesh.matrixWorld);
  const vB = new THREE.Vector3().fromBufferAttribute(posAttr, face.b).applyMatrix4(state.activeMesh.matrixWorld);
  const vC = new THREE.Vector3().fromBufferAttribute(posAttr, face.c).applyMatrix4(state.activeMesh.matrixWorld);

  const normal = face.normal.clone()
    .applyMatrix3(new THREE.Matrix3().getNormalMatrix(state.activeMesh.matrixWorld))
    .normalize();

  if (!state.selectionMesh) {
    const highlightGeom = new THREE.BufferGeometry();
    highlightGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
    state.selectionMesh = new THREE.Mesh(highlightGeom, new THREE.MeshBasicMaterial({
      color: 0x10b981,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      depthTest: false,
    }));
    state.scene.add(state.selectionMesh);
  }

  const selPos = state.selectionMesh.geometry.attributes.position;
  selPos.setXYZ(0, vA.x, vA.y, vA.z);
  selPos.setXYZ(1, vB.x, vB.y, vB.z);
  selPos.setXYZ(2, vC.x, vC.y, vC.z);
  selPos.needsUpdate = true;
  state.selectionMesh.visible = true;

  const edgeAB = new THREE.Vector3().subVectors(vB, vA);
  const edgeAC = new THREE.Vector3().subVectors(vC, vA);
  const area = new THREE.Vector3().crossVectors(edgeAB, edgeAC).length() * 0.5;

  const fmt = (v) => `${v.x.toFixed(3)}, ${v.y.toFixed(3)}, ${v.z.toFixed(3)}`;
  document.getElementById('ins-face-idx').innerText = Math.floor(face.a / 3);
  document.getElementById('ins-vA').innerText = fmt(vA);
  document.getElementById('ins-vB').innerText = fmt(vB);
  document.getElementById('ins-vC').innerText = fmt(vC);
  document.getElementById('ins-normal').innerText = fmt(normal);
  document.getElementById('ins-area').innerText = `${area.toFixed(3)} mm²`;
  document.getElementById('inspector-card').classList.remove('hidden');

  showNotification('Selected triangle coordinates loaded!', 'info');
}

export function clearSelection() {
  if (state.selectionMesh) state.selectionMesh.visible = false;
  document.getElementById('inspector-card').classList.add('hidden');
}
