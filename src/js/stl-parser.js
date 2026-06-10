import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export function parseSTLData(buffer) {
  if (buffer.byteLength < 84) {
    throw new Error('Invalid STL file: Too small to be valid.');
  }

  const reader = new DataView(buffer);
  const numFaces = reader.getUint32(80, true);
  const expectedBinarySize = 80 + 4 + numFaces * 50;
  let isBinary = expectedBinarySize === buffer.byteLength;

  if (!isBinary) {
    const charCheckLimit = Math.min(buffer.byteLength, 500);
    const bytes = new Uint8Array(buffer, 0, charCheckLimit);
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] > 127 || bytes[i] === 0) {
        isBinary = true;
        break;
      }
    }
  }

  let geometry;
  if (isBinary) {
    geometry = parseBinarySTL(buffer, numFaces);
  } else {
    const text = new TextDecoder('utf-8').decode(buffer);
    geometry = parseAsciiSTL(text);
  }

  // Weld coincident vertices so the geometry is indexed and shared edges
  // are connected — required for correct smooth normals and tool mesh offsets
  geometry = mergeVertices(geometry, 0.01);

  return { geometry, binary: isBinary };
}

function parseBinarySTL(buffer, declaredFaces) {
  const reader = new DataView(buffer);
  const physicalFaceCount = Math.floor((buffer.byteLength - 84) / 50);
  const numFaces = Math.min(declaredFaces, physicalFaceCount);

  const positions = new Float32Array(numFaces * 9);
  const normals = new Float32Array(numFaces * 9);

  let offset = 84;
  for (let i = 0; i < numFaces; i++) {
    const nx = reader.getFloat32(offset, true);
    const ny = reader.getFloat32(offset + 4, true);
    const nz = reader.getFloat32(offset + 8, true);
    offset += 12;

    for (let v = 0; v < 3; v++) {
      const vx = reader.getFloat32(offset, true);
      const vy = reader.getFloat32(offset + 4, true);
      const vz = reader.getFloat32(offset + 8, true);
      offset += 12;

      const index = i * 9 + v * 3;
      positions[index] = vx;
      positions[index + 1] = vy;
      positions[index + 2] = vz;
      normals[index] = nx;
      normals[index + 1] = ny;
      normals[index + 2] = nz;
    }

    offset += 2; // attribute byte count
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return geometry;
}

function parseAsciiSTL(text) {
  const lines = text.split('\n');
  const positions = [];
  const normals = [];
  let currentNormal = [0, 0, 0];

  const normalRegex = /facet\s+normal\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)/i;
  const vertexRegex = /vertex\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)/i;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith('facet normal') || line.startsWith('FACET NORMAL')) {
      const match = line.match(normalRegex);
      if (match) {
        currentNormal = [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])];
      }
    } else if (line.startsWith('vertex') || line.startsWith('VERTEX')) {
      const match = line.match(vertexRegex);
      if (match) {
        positions.push(parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3]));
        normals.push(currentNormal[0], currentNormal[1], currentNormal[2]);
      }
    }
  }

  if (positions.length === 0 || positions.length % 9 !== 0) {
    throw new Error('Invalid ASCII STL structure or file has no triangles.');
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
  return geometry;
}
