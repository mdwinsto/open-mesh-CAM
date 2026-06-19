// Find indices of vertices that lie on the open boundary of a mesh —
// i.e. vertices touching an edge used by only one triangle.
export function findBoundaryVertexIndices(geometry) {
  const idx = geometry.index;
  const pos = geometry.attributes.position;
  const triCount = idx ? idx.count : pos.count;

  const edgeUse = new Map();
  for (let i = 0; i < triCount; i += 3) {
    const a = idx ? idx.getX(i) : i;
    const b = idx ? idx.getX(i + 1) : i + 1;
    const c = idx ? idx.getX(i + 2) : i + 2;
    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
      const key = u < v ? `${u}|${v}` : `${v}|${u}`;
      edgeUse.set(key, (edgeUse.get(key) || 0) + 1);
    }
  }

  const boundary = new Set();
  for (const [key, count] of edgeUse) {
    if (count !== 1) continue;
    const [u, v] = key.split('|').map(Number);
    boundary.add(u);
    boundary.add(v);
  }
  return boundary;
}
