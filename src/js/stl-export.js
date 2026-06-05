import * as THREE from 'three';

export function exportToBinarySTL(geom) {
  let tempGeom = geom;
  let isCloned = false;

  if (geom.index !== null) {
    tempGeom = geom.toNonIndexed();
    isCloned = true;
  }

  const posAttr = tempGeom.getAttribute('position');
  if (!posAttr) {
    if (isCloned) tempGeom.dispose();
    return new ArrayBuffer(0);
  }

  const numTriangles = Math.floor(posAttr.count / 3);
  const arrayBuffer = new ArrayBuffer(80 + 4 + numTriangles * 50);
  const output = new DataView(arrayBuffer);

  for (let i = 0; i < 80; i++) output.setUint8(i, 32);
  output.setUint32(80, numTriangles, true);

  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const cb = new THREE.Vector3();
  const ab = new THREE.Vector3();
  let offset = 84;

  for (let i = 0; i < numTriangles * 3; i += 3) {
    vA.fromBufferAttribute(posAttr, i);
    vB.fromBufferAttribute(posAttr, i + 1);
    vC.fromBufferAttribute(posAttr, i + 2);

    cb.subVectors(vC, vB);
    ab.subVectors(vA, vB);
    cb.cross(ab).normalize();

    output.setFloat32(offset, cb.x, true);
    output.setFloat32(offset + 4, cb.y, true);
    output.setFloat32(offset + 8, cb.z, true);
    offset += 12;

    for (const v of [vA, vB, vC]) {
      output.setFloat32(offset, v.x, true);
      output.setFloat32(offset + 4, v.y, true);
      output.setFloat32(offset + 8, v.z, true);
      offset += 12;
    }

    output.setUint16(offset, 0, true);
    offset += 2;
  }

  if (isCloned) tempGeom.dispose();
  return arrayBuffer;
}
