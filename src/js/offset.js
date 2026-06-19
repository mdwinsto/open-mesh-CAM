import * as THREE        from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Welds coincident vertices and recomputes smooth normals.
 * Use this for the display mesh so seam boundaries get averaged normals
 * instead of the face-normal jumps that cause shading artifacts.
 *
 * @param {THREE.BufferGeometry} srcGeo
 * @returns {THREE.BufferGeometry} Indexed geometry with smooth normals.
 */
export function weldGeometry(srcGeo) {
  const stripped = srcGeo.clone();
  stripped.deleteAttribute('normal');
  const merged = mergeVertices(stripped);
  merged.computeVertexNormals();
  return merged;
}

// Relax each vertex normal towards its 1-ring neighbors' average, re-normalizing
// after every pass. Reduces the faceting noise that makes adjacent offset rays
// (pos + normal * radius) cross each other in the welded offset mesh.
function smoothNormals(geometry, iterations) {
  if (iterations <= 0) return;

  const idx = geometry.index;
  const nrm = geometry.attributes.normal;
  const n = nrm.count;

  const adj = Array.from({ length: n }, () => []);
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i), b = idx.getX(i + 1), c = idx.getX(i + 2);
    adj[a].push(b, c);
    adj[b].push(a, c);
    adj[c].push(a, b);
  }

  let cur = nrm.array.slice();
  for (let pass = 0; pass < iterations; pass++) {
    const next = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) {
      let x = cur[v * 3], y = cur[v * 3 + 1], z = cur[v * 3 + 2];
      for (const nb of adj[v]) {
        x += cur[nb * 3]; y += cur[nb * 3 + 1]; z += cur[nb * 3 + 2];
      }
      const len = Math.hypot(x, y, z) || 1;
      next[v * 3] = x / len;
      next[v * 3 + 1] = y / len;
      next[v * 3 + 2] = z / len;
    }
    cur = next;
  }
  nrm.array.set(cur);
  nrm.needsUpdate = true;
}

export function buildWeldedOffsetGeometry(srcGeo, radius, smoothIterations = 0) {
  // Strip normals before merging — mergeVertices hashes ALL attributes,
  // so face normals from different triangles would prevent welding.
  const stripped = srcGeo.clone();
  stripped.deleteAttribute('normal');
  const merged = mergeVertices(stripped);       // weld on position only
  merged.computeVertexNormals();                // averaged normals at shared verts
  smoothNormals(merged, smoothIterations);

  const pos = merged.attributes.position;
  const nrm = merged.attributes.normal;
  const n   = pos.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3]     = pos.getX(i) + nrm.getX(i) * radius;
    arr[i * 3 + 1] = pos.getY(i) + nrm.getY(i) * radius;
    arr[i * 3 + 2] = pos.getZ(i) + nrm.getZ(i) * radius;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  geo.setIndex(merged.index.clone());
  geo.computeVertexNormals();
  return geo;
}
