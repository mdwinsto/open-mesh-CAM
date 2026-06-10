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

export function buildWeldedOffsetGeometry(srcGeo, radius) {
  // Strip normals before merging — mergeVertices hashes ALL attributes,
  // so face normals from different triangles would prevent welding.
  const stripped = srcGeo.clone();
  stripped.deleteAttribute('normal');
  const merged = mergeVertices(stripped);       // weld on position only
  merged.computeVertexNormals();                // averaged normals at shared verts

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
