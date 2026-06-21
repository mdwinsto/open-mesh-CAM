import { state } from './state.js';
import { showNotification } from './ui.js';

function fmt(n) {
  return n.toFixed(3);
}

// Walk each threaded toolpath (state.toolPaths, built by makeToolpaths) into
// G0 rapids/retracts plus G1 cutting moves, downloaded as a .gcode file.
export function generateGCode() {
  if (!state.toolPaths || state.toolPaths.length === 0) {
    showNotification('Generate toolpaths first.', 'error');
    return;
  }

  const feedRate = parseFloat(document.getElementById('gcode-feed-rate').value);
  const plungeRate = parseFloat(document.getElementById('gcode-plunge-rate').value);
  const safeZ = parseFloat(document.getElementById('gcode-safe-z').value);
  if (!(feedRate > 0) || !(plungeRate > 0) || Number.isNaN(safeZ)) {
    showNotification('Enter valid feed rate, plunge rate, and safe Z values.', 'error');
    return;
  }

  if (state.toolRadius == null) {
    showNotification('No tool radius recorded — regenerate the tool mesh before exporting G-code.', 'error');
    return;
  }

  // state.toolPaths points are cutter-location (ball-center) positions, offset
  // from the part surface along its normal by the tool radius. Machine tool
  // length offset is referenced to the tip, which sits exactly toolRadius
  // straight below the ball center regardless of the local surface normal —
  // so the tip Z is a flat per-point subtraction, applied to Z only.
  const toolRadius = state.toolRadius;
  const mesh = state.activeMesh;
  mesh.updateMatrixWorld();
  const toWorld = (p) => {
    const w = p.clone().applyMatrix4(mesh.matrixWorld);
    w.z -= toolRadius;
    return w;
  };

  const lines = ['G21 ; millimeters', 'G90 ; absolute positioning'];

  for (const path of state.toolPaths) {
    if (path.length === 0) continue;
    const pts = path.map(toWorld);

    lines.push(`G0 Z${fmt(safeZ)}`);
    lines.push(`G0 X${fmt(pts[0].x)} Y${fmt(pts[0].y)}`);
    lines.push(`G1 Z${fmt(pts[0].z)} F${fmt(plungeRate)}`);

    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      const feed = i === 1 ? ` F${fmt(feedRate)}` : '';
      lines.push(`G1 X${fmt(p.x)} Y${fmt(p.y)} Z${fmt(p.z)}${feed}`);
    }
  }

  lines.push(`G0 Z${fmt(safeZ)}`);
  lines.push('M2 ; program end');

  const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'toolpath.gcode';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showNotification(`Generated G-code for ${state.toolPaths.length} toolpath${state.toolPaths.length !== 1 ? 's' : ''}.`);
}
