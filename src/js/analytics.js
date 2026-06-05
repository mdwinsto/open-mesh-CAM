import * as THREE from 'three';

export function calculateMetadata(geometry, isBinary) {
  const pos = geometry.attributes.position;
  const count = pos.count;

  let totalArea = 0;
  let totalVolume = 0;

  const p1 = new THREE.Vector3();
  const p2 = new THREE.Vector3();
  const p3 = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const cross = new THREE.Vector3();

  for (let i = 0; i < count; i += 3) {
    p1.fromBufferAttribute(pos, i);
    p2.fromBufferAttribute(pos, i + 1);
    p3.fromBufferAttribute(pos, i + 2);

    ab.subVectors(p2, p1);
    ac.subVectors(p3, p1);
    cross.crossVectors(ab, ac);
    totalArea += cross.length() * 0.5;

    const cx = p2.y * p3.z - p2.z * p3.y;
    const cy = p2.z * p3.x - p2.x * p3.z;
    const cz = p2.x * p3.y - p2.y * p3.x;
    totalVolume += (p1.x * cx + p1.y * cy + p1.z * cz) / 6.0;
  }

  const size = new THREE.Vector3();
  geometry.boundingBox.getSize(size);

  document.getElementById('stats-unloaded').classList.add('hidden');
  document.getElementById('stats-loaded').classList.remove('hidden');
  document.getElementById('stat-format').innerText = isBinary ? 'Binary STL' : 'ASCII STL';
  document.getElementById('stat-triangles').innerText = (count / 3).toLocaleString();
  document.getElementById('stat-area').innerText =
    totalArea.toLocaleString(undefined, { maximumFractionDigits: 1 }) + ' mm²';
  document.getElementById('stat-volume').innerText =
    Math.abs(totalVolume).toLocaleString(undefined, { maximumFractionDigits: 1 }) + ' mm³';
  document.getElementById('stat-bbox-x').innerText = size.x.toFixed(2);
  document.getElementById('stat-bbox-y').innerText = size.y.toFixed(2);
  document.getElementById('stat-bbox-z').innerText = size.z.toFixed(2);
}
