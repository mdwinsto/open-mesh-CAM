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

// Build contour polylines from all ordered segments across all layers.
// Extends the current polyline when p2 of the previous segment is within
// tolerance of p1 of the next; otherwise starts a new polyline.
export function buildContourPolylines(tol = 0.01) {
  const polylines = [];
  if (!state.layerSegments || state.layerSegments.length === 0) return polylines;

  let current = null;

  for (const layer of state.layerSegments) {
    for (const seg of layer.segments) {
      if (current === null) {
        current = [seg.p1.clone(), seg.p2.clone()];
      } else {
        const tail = current[current.length - 1];
        if (tail.distanceTo(seg.p1) <= tol) {
          current.push(seg.p2.clone());
        } else {
          polylines.push(current);
          current = [seg.p1.clone(), seg.p2.clone()];
        }
      }
    }
  }

  if (current !== null) polylines.push(current);

  return polylines;
}

// Build an ordered CCW array of boundary intersection points — one point per
// slice-plane/boundary-edge crossing — then rotate so the first point is
// nearest to contourPolylines[0][0].
export function buildBoundaryIntersections(contourPolylines) {
  if (!state.layerSegments?.length || !state.sliceAxis) return [];
  if (!contourPolylines?.length) return [];

  const axis = state.sliceAxis;
  const geometry = (state.toolMesh || state.activeMesh).geometry;
  const pos = geometry.attributes.position;
  const idx = geometry.index;
  const triCount = idx ? idx.count : pos.count;

  // ── 1. Count triangle uses per edge; boundary edges have count === 1 ───────
  const edgeUse = new Map();
  for (let i = 0; i < triCount; i += 3) {
    const a = idx ? idx.getX(i)     : i;
    const b = idx ? idx.getX(i + 1) : i + 1;
    const c = idx ? idx.getX(i + 2) : i + 2;
    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
      const key = u < v ? `${u}|${v}` : `${v}|${u}`;
      edgeUse.set(key, (edgeUse.get(key) || 0) + 1);
    }
  }

  // ── 2. Build vertex adjacency for boundary vertices and walk the loop ──────
  const adj = new Map();
  for (const [key, count] of edgeUse) {
    if (count !== 1) continue;
    const [u, v] = key.split('|').map(Number);
    if (!adj.has(u)) adj.set(u, []);
    if (!adj.has(v)) adj.set(v, []);
    adj.get(u).push(v);
    adj.get(v).push(u);
  }
  if (adj.size === 0) return [];

  const visited = new Set();
  const loopIdx = [];
  let cur = adj.keys().next().value;
  while (cur !== undefined) {
    loopIdx.push(cur);
    visited.add(cur);
    cur = adj.get(cur).find(n => !visited.has(n));
  }
  const loop = loopIdx.map(i => new THREE.Vector3().fromBufferAttribute(pos, i));

  // ── 3. Ensure CCW when viewed from +Z (positive signed area in XY) ─────────
  let area = 0;
  for (let i = 0; i < loop.length; i++) {
    const j = (i + 1) % loop.length;
    area += loop[i].x * loop[j].y - loop[j].x * loop[i].y;
  }
  if (area < 0) loop.reverse();

  // ── 4. Parameterise loop edges by cumulative arc length ────────────────────
  const arcLen = [0];
  for (let i = 1; i < loop.length; i++) {
    arcLen.push(arcLen[i - 1] + loop[i].distanceTo(loop[i - 1]));
  }
  // Closing edge (loop[N-1] → loop[0])
  arcLen.push(arcLen[arcLen.length - 1] + loop[0].distanceTo(loop[loop.length - 1]));

  // ── 5. Intersect every slice plane with every boundary edge ────────────────
  const hits = [];
  for (const layer of state.layerSegments) {
    const sv = layer.sliceVal;
    for (let i = 0; i < loop.length; i++) {
      const pA = loop[i];
      const pB = loop[(i + 1) % loop.length];
      const dA = pA[axis] - sv;
      const dB = pB[axis] - sv;
      if (dA * dB < 0) {
        const t = dA / (dA - dB);
        hits.push({ pt: pA.clone().lerp(pB, t), param: arcLen[i] + t * (arcLen[i + 1] - arcLen[i]) });
      } else if (Math.abs(dA) < 1e-9) {
        hits.push({ pt: pA.clone(), param: arcLen[i] });
      }
    }
  }

  // ── 6. Sort by arc length → CCW order around the boundary ─────────────────
  hits.sort((a, b) => a.param - b.param);
  const pts = hits.map(h => h.pt);

  // ── 7. Rotate so first element is nearest to contourPolylines[0][0] ────────
  const target = contourPolylines[0][0];
  let bestIdx = 0, bestDist = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const d = pts[i].distanceTo(target);
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  }
  return [...pts.slice(bestIdx), ...pts.slice(0, bestIdx)];
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
