import * as THREE from 'three';
import { state } from './state.js';
import { showNotification } from './ui.js';
import { clearToolpaths } from './toolpath.js';

export function performSlicing(axis) {
  // Guard: need a tool mesh and a valid increment before slicing. Slicing the
  // tool mesh (rather than the raw STL) is required so the resulting toolpaths
  // carry tool-radius compensation baked into every point.
  if (!state.toolMesh) {
    showNotification('Generate a tool mesh first.', 'error');
    return;
  }

  const increment = parseFloat(document.getElementById('slice-increment').value) || 5.0;
  if (increment <= 0) {
    showNotification('Slice increment must be greater than 0.', 'error');
    return;
  }

  clearSlices();
  state.layerSegments = [];
  state.sliceAxis = axis;

  const sourceMesh = state.toolMesh;

  // Determine the slicing range and plane normal for the chosen axis
  const { geometry } = sourceMesh;
  const posAttr = geometry.attributes.position;
  const idxAttr = geometry.index;
  const box = geometry.boundingBox;

  let min, max;
  const normal = new THREE.Vector3();
  if (axis === 'x') { min = box.min.x; max = box.max.x; normal.set(1, 0, 0); }
  else if (axis === 'y') { min = box.min.y; max = box.max.y; normal.set(0, 1, 0); }
  else { min = box.min.z; max = box.max.z; normal.set(0, 0, 1); }

  // Axis X → compare Y; axis Y or Z → compare X
  const sortKey = axis === 'x' ? 'y' : 'x';

  const sliceMat = new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 2, depthTest: false });

  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const linePoints = [];

  // Inset the range slightly and distribute layers evenly across the span
  // so the first/last slices don't land exactly on the mesh's bounding faces
  const sliceMin = min + 0.01;
  const sliceMax = max - 0.01;
  const span = sliceMax - sliceMin;
  const numIntervals = span > 0 ? Math.max(1, Math.round(span / increment)) : 1;
  const actualIncrement = span > 0 ? span / numIntervals : 0;
  const numSlices = span >= 0 ? numIntervals + 1 : 0;

  for (let sliceIdx = 0; sliceIdx < numSlices; sliceIdx++) {
    // Build the cutting plane for this layer
    const layerVal = sliceMin + sliceIdx * actualIncrement;
    const plane = new THREE.Plane(normal, -layerVal);
    const layerSegs = [];

    // Test every triangle in the mesh against the plane
    const triCount = idxAttr ? idxAttr.count : posAttr.count;
    for (let i = 0; i < triCount; i += 3) {
      const ai = idxAttr ? idxAttr.getX(i)     : i;
      const bi = idxAttr ? idxAttr.getX(i + 1) : i + 1;
      const ci = idxAttr ? idxAttr.getX(i + 2) : i + 2;
      vA.fromBufferAttribute(posAttr, ai);
      vB.fromBufferAttribute(posAttr, bi);
      vC.fromBufferAttribute(posAttr, ci);

      const pts = [vA, vB, vC];
      const outPts = [];

      // Walk the triangle's three edges; an edge that straddles the plane
      // contributes an interpolated intersection point, an edge with a
      // vertex lying exactly on the plane contributes that vertex
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

      // A triangle crossing the plane yields exactly one contour segment
      if (outPts.length >= 2) {
        layerSegs.push({ p1: outPts[0].clone(), p2: outPts[1].clone() });
      }
    }

    if (layerSegs.length > 0) {
      // Orient each segment so p1's sort coordinate ≤ p2's
      for (const seg of layerSegs) {
        if (seg.p2[sortKey] < seg.p1[sortKey]) {
          const tmp = seg.p1; seg.p1 = seg.p2; seg.p2 = tmp;
        }
      }

      // Sort segments within this layer by p1's sort coordinate
      layerSegs.sort((a, b) => a.p1[sortKey] - b.p1[sortKey]);

      // Build rendering data and structured layer data from the sorted segments
      for (const seg of layerSegs) {
        linePoints.push(seg.p1.x, seg.p1.y, seg.p1.z, seg.p2.x, seg.p2.y, seg.p2.z);
      }
      state.layerSegments.push({ sliceVal: layerVal, segments: layerSegs });
    }
  }

  // Build one merged LineSegments object for all layers and add it to the scene,
  // matching the active mesh's transform so the contours stay aligned with it
  if (linePoints.length > 0) {
    const sliceGeom = new THREE.BufferGeometry();
    sliceGeom.setAttribute('position', new THREE.Float32BufferAttribute(linePoints, 3));
    const sliceLines = new THREE.LineSegments(sliceGeom, sliceMat);
    sliceLines.position.copy(sourceMesh.position);
    sliceLines.rotation.copy(sourceMesh.rotation);
    sliceLines.scale.copy(sourceMesh.scale);
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
  // Remove and dispose all rendered slice contours, reset stored layer
  // data, and hide the buttons that depend on slices existing. Toolpaths
  // are derived from these slices, so they're invalidated too.
  clearToolpaths();

  state.activeSlices.forEach((slice) => {
    state.scene.remove(slice);
    slice.geometry.dispose();
    slice.material.dispose();
  });
  state.activeSlices = [];
  state.layerSegments = [];
  state.sliceAxis = null;

  const clearBtn = document.getElementById('clear-slices-btn');
  if (clearBtn) clearBtn.classList.add('hidden');
  const genBtn = document.getElementById('gen-toolpaths-btn');
  if (genBtn) genBtn.classList.add('hidden');
}
