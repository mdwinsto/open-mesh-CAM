import * as THREE from 'three';
import { state } from './state.js';
import { showNotification } from './ui.js';

export function performSlicing(axis) {
  if (!state.activeMesh) {
    showNotification('No mesh loaded to slice.', 'error');
    return;
  }

  const increment = parseFloat(document.getElementById('slice-increment').value) || 5.0;
  if (increment <= 0) {
    showNotification('Slice increment must be greater than 0.', 'error');
    return;
  }

  clearSlices();
  state.layerSegments = [];

  const { geometry } = state.activeMesh;
  const posAttr = geometry.attributes.position;
  const box = geometry.boundingBox;

  let min, max;
  const normal = new THREE.Vector3();
  if (axis === 'x') { min = box.min.x; max = box.max.x; normal.set(1, 0, 0); }
  else if (axis === 'y') { min = box.min.y; max = box.max.y; normal.set(0, 1, 0); }
  else { min = box.min.z; max = box.max.z; normal.set(0, 0, 1); }

  const sliceMat = new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 2, depthTest: false });

  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const linePoints = [];

  const sliceMin = min + 0.01;
  const sliceMax = max - 0.01;
  const span = sliceMax - sliceMin;
  const numIntervals = span > 0 ? Math.max(1, Math.round(span / increment)) : 1;
  const actualIncrement = span > 0 ? span / numIntervals : 0;
  const numSlices = span >= 0 ? numIntervals + 1 : 0;

  for (let sliceIdx = 0; sliceIdx < numSlices; sliceIdx++) {
    const layerVal = sliceMin + sliceIdx * actualIncrement;
    const plane = new THREE.Plane(normal, -layerVal);
    const layerSegs = [];

    for (let i = 0; i < posAttr.count; i += 3) {
      vA.fromBufferAttribute(posAttr, i);
      vB.fromBufferAttribute(posAttr, i + 1);
      vC.fromBufferAttribute(posAttr, i + 2);

      const pts = [vA, vB, vC];
      const outPts = [];

      for (let j = 0; j < 3; j++) {
        const p1 = pts[j];
        const p2 = pts[(j + 1) % 3];
        const d1 = plane.distanceToPoint(p1);
        const d2 = plane.distanceToPoint(p2);

        if (d1 * d2 < 0) {
          outPts.push(p1.clone().lerp(p2, d1 / (d1 - d2)));
        } else if (d1 === 0) {
          outPts.push(p1.clone());
        }
      }

      if (outPts.length >= 2) {
        linePoints.push(outPts[0].x, outPts[0].y, outPts[0].z, outPts[1].x, outPts[1].y, outPts[1].z);
        layerSegs.push({ p1: outPts[0].clone(), p2: outPts[1].clone() });
      }
    }

    if (layerSegs.length > 0) {
      state.layerSegments.push({ sliceVal: layerVal, segments: layerSegs });
    }
  }

  if (linePoints.length > 0) {
    const sliceGeom = new THREE.BufferGeometry();
    sliceGeom.setAttribute('position', new THREE.Float32BufferAttribute(linePoints, 3));
    const sliceLines = new THREE.LineSegments(sliceGeom, sliceMat);
    sliceLines.position.copy(state.activeMesh.position);
    sliceLines.rotation.copy(state.activeMesh.rotation);
    sliceLines.scale.copy(state.activeMesh.scale);
    state.scene.add(sliceLines);
    state.activeSlices.push(sliceLines);

    document.getElementById('clear-slices-btn').classList.remove('hidden');
    document.getElementById('gen-toolpaths-btn').classList.remove('hidden');
    showNotification(`Successfully sliced along ${axis.toUpperCase()} axis into ${numSlices} layers.`);
  } else {
    showNotification('No slices generated (model too small or invalid increment).', 'error');
  }
}

export function clearSlices() {
  state.activeSlices.forEach((slice) => {
    state.scene.remove(slice);
    slice.geometry.dispose();
    slice.material.dispose();
  });
  state.activeSlices = [];
  state.layerSegments = [];

  const clearBtn = document.getElementById('clear-slices-btn');
  if (clearBtn) clearBtn.classList.add('hidden');
  const genBtn = document.getElementById('gen-toolpaths-btn');
  if (genBtn) genBtn.classList.add('hidden');
}
