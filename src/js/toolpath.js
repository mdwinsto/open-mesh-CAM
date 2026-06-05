import * as THREE from 'three';
import { state } from './state.js';
import { showNotification } from './ui.js';

// Chain unordered segment pairs into polylines by matching endpoints.
function chainSegments(segments, tol = 0.01) {
  const remaining = segments.slice();
  const chains = [];

  while (remaining.length > 0) {
    const first = remaining.splice(0, 1)[0];
    const chain = [first.p1.clone(), first.p2.clone()];

    let extended = true;
    while (extended) {
      extended = false;
      for (let i = remaining.length - 1; i >= 0; i--) {
        const seg = remaining[i];
        const head = chain[0];
        const tail = chain[chain.length - 1];

        if (tail.distanceTo(seg.p1) < tol) {
          chain.push(seg.p2.clone());
          remaining.splice(i, 1);
          extended = true;
        } else if (tail.distanceTo(seg.p2) < tol) {
          chain.push(seg.p1.clone());
          remaining.splice(i, 1);
          extended = true;
        } else if (head.distanceTo(seg.p2) < tol) {
          chain.unshift(seg.p1.clone());
          remaining.splice(i, 1);
          extended = true;
        } else if (head.distanceTo(seg.p1) < tol) {
          chain.unshift(seg.p2.clone());
          remaining.splice(i, 1);
          extended = true;
        }
      }
    }

    chains.push(chain);
  }

  return chains;
}

export function generateToolpaths() {
  if (!state.layerSegments || state.layerSegments.length === 0) {
    showNotification('Generate slices first.', 'error');
    return;
  }

  clearToolpaths();

  // Sort layers by slice value ascending
  const sorted = state.layerSegments.slice().sort((a, b) => a.sliceVal - b.sliceVal);

  // Build contour objects per layer
  const layers = sorted.map((layer, idx) => ({
    idx,
    contours: chainSegments(layer.segments).map(pts => ({
      pts,
      cZ: pts.reduce((s, p) => s + p.z, 0) / pts.length,
      visited: false,
      layerIdx: idx,
    })),
  }));

  // All contours sorted: centroid Z descending, then layer index ascending
  const allContours = layers.flatMap(l => l.contours)
    .sort((a, b) => b.cZ - a.cZ || a.layerIdx - b.layerIdx);

  const rawPaths = [];

  while (true) {
    const start = allContours.find(c => !c.visited);
    if (!start) break;

    const pts = [...start.pts];
    start.visited = true;
    let current = start;

    while (true) {
      const tail = pts[pts.length - 1];

      // Candidates: unvisited contours in immediately adjacent layers
      const candidates = [];
      for (const di of [-1, +1]) {
        const li = current.layerIdx + di;
        if (li >= 0 && li < layers.length) {
          for (const c of layers[li].contours) {
            if (!c.visited) candidates.push(c);
          }
        }
      }
      if (!candidates.length) break;

      // Pick the candidate whose nearest endpoint is closest to tail
      let best = null, bestDist = Infinity;
      for (const c of candidates) {
        const d = Math.min(tail.distanceTo(c.pts[0]), tail.distanceTo(c.pts[c.pts.length - 1]));
        if (d < bestDist) { bestDist = d; best = c; }
      }

      // Append in the orientation that connects from tail
      const d0 = tail.distanceTo(best.pts[0]);
      const dN = tail.distanceTo(best.pts[best.pts.length - 1]);
      pts.push(...(d0 <= dN ? best.pts : [...best.pts].reverse()));
      best.visited = true;
      current = best;
    }

    rawPaths.push(pts);
  }

  // Render each toolpath as a continuous line in a distinct color
  const palette = [0x00ff88, 0x00ccff, 0xff8800, 0xff00cc];
  rawPaths.forEach((pts, i) => {
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: palette[i % palette.length],
      linewidth: 2,
      depthTest: false,
    });
    const line = new THREE.Line(geom, mat);
    if (state.activeMesh) {
      line.position.copy(state.activeMesh.position);
      line.rotation.copy(state.activeMesh.rotation);
      line.scale.copy(state.activeMesh.scale);
    }
    state.scene.add(line);
    state.activeToolpaths.push(line);
  });

  document.getElementById('clear-toolpaths-btn').classList.remove('hidden');
  showNotification(`Generated ${rawPaths.length} toolpath${rawPaths.length !== 1 ? 's' : ''}.`);
}

export function clearToolpaths() {
  state.activeToolpaths.forEach(tp => {
    state.scene.remove(tp);
    tp.geometry.dispose();
    tp.material.dispose();
  });
  state.activeToolpaths = [];

  const btn = document.getElementById('clear-toolpaths-btn');
  if (btn) btn.classList.add('hidden');
}
