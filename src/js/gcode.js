import * as THREE from 'three';
import { state, config } from './state.js';
import { showNotification } from './ui.js';

function fmt(n) {
  return n.toFixed(3);
}

// Build the exact sequence of machine moves a generated program will make —
// rapid retract, rapid reposition, feed-rate plunge, and feed-rate cutting —
// shared by the text emitter and the 3D preview so they can't drift apart.
//
// state.toolPaths points are cutter-location (ball-center) positions, offset
// from the part surface along its normal by the tool radius. Machine tool
// length offset is referenced to the tip, which sits exactly toolRadius
// straight below the ball center regardless of the local surface normal —
// so the tip Z is a flat per-point subtraction, applied to Z only.
function buildMoveSegments(safeZ) {
  const toolRadius = state.toolRadius;
  const mesh = state.activeMesh;
  mesh.updateMatrixWorld();
  const toTip = (p) => {
    const w = p.clone().applyMatrix4(mesh.matrixWorld);
    w.z -= toolRadius;
    return w;
  };

  const segments = [];
  let prevPoint = null;

  for (const path of state.toolPaths) {
    if (path.length === 0) continue;
    const pts = path.map(toTip);
    const start = pts[0];

    const retractFrom = prevPoint ?? start;
    const retract = new THREE.Vector3(retractFrom.x, retractFrom.y, safeZ);
    const reposition = new THREE.Vector3(start.x, start.y, safeZ);

    // The very first path has no known prior machine position to draw a
    // retract from — the G0 Z command is still required (and emitted
    // unconditionally below), it just isn't meaningful to draw in 3D.
    segments.push({ type: 'retract', a: prevPoint, b: retract, draw: prevPoint !== null });
    segments.push({ type: 'reposition', a: retract, b: reposition, draw: true });
    segments.push({ type: 'plunge', a: reposition, b: start, draw: true });

    for (let i = 1; i < pts.length; i++) {
      segments.push({ type: 'cut', a: pts[i - 1], b: pts[i], draw: true });
    }

    prevPoint = pts[pts.length - 1];
  }

  if (prevPoint) {
    segments.push({ type: 'retract', a: prevPoint, b: new THREE.Vector3(prevPoint.x, prevPoint.y, safeZ), draw: true });
  }

  return segments;
}

function segmentsToGCode(segments, feedRate, plungeRate) {
  const lines = ['G21 ; millimeters', 'G90 ; absolute positioning'];
  let lastType = null;

  for (const seg of segments) {
    if (seg.type === 'retract') {
      lines.push(`G0 Z${fmt(seg.b.z)}`);
    } else if (seg.type === 'reposition') {
      lines.push(`G0 X${fmt(seg.b.x)} Y${fmt(seg.b.y)}`);
    } else if (seg.type === 'plunge') {
      lines.push(`G1 X${fmt(seg.b.x)} Y${fmt(seg.b.y)} Z${fmt(seg.b.z)} F${fmt(plungeRate)}`);
    } else {
      const feed = lastType !== 'cut' ? ` F${fmt(feedRate)}` : '';
      lines.push(`G1 X${fmt(seg.b.x)} Y${fmt(seg.b.y)} Z${fmt(seg.b.z)}${feed}`);
    }
    lastType = seg.type;
  }

  lines.push('M30 ; program end');
  return lines.join('\n') + '\n';
}

// Solid green for anything cutting/feeding into material (plunge + cut),
// dashed gray for non-cutting rapid travel (retract + reposition).
function buildGCodeVisualization(segments) {
  const cutPoints = [];
  const rapidPoints = [];

  for (const seg of segments) {
    if (!seg.draw) continue;
    const bucket = seg.type === 'retract' || seg.type === 'reposition' ? rapidPoints : cutPoints;
    bucket.push(seg.a.x, seg.a.y, seg.a.z, seg.b.x, seg.b.y, seg.b.z);
  }

  const group = new THREE.Group();

  if (cutPoints.length > 0) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(cutPoints, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0x39ff14, depthTest: false });
    group.add(new THREE.LineSegments(geom, mat));
  }

  if (rapidPoints.length > 0) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(rapidPoints, 3));
    const mat = new THREE.LineDashedMaterial({ color: 0x9ca3af, dashSize: 1, gapSize: 0.6, depthTest: false });
    const lines = new THREE.LineSegments(geom, mat);
    lines.computeLineDistances();
    group.add(lines);
  }

  group.visible = config.showGcodePath;
  return group;
}

export function clearGCodeVisualization() {
  if (state.gcodeVisualization) {
    state.scene.remove(state.gcodeVisualization);
    state.gcodeVisualization.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
    state.gcodeVisualization = null;
  }
}

// Validate inputs and build the move sequence shared by preview and download,
// always read fresh from the current UI/state so either action reflects
// whatever feed/plunge/safe-Z/tool-radius is currently set, independent of
// whether the other action has run yet.
function prepareGCode() {
  if (!state.toolPaths || state.toolPaths.length === 0) {
    showNotification('Generate toolpaths first.', 'error');
    return null;
  }

  const feedRate = parseFloat(document.getElementById('gcode-feed-rate').value);
  const plungeRate = parseFloat(document.getElementById('gcode-plunge-rate').value);
  const safeZ = parseFloat(document.getElementById('gcode-safe-z').value);
  if (!(feedRate > 0) || !(plungeRate > 0) || Number.isNaN(safeZ)) {
    showNotification('Enter valid feed rate, plunge rate, and safe Z values.', 'error');
    return null;
  }

  if (state.toolRadius == null) {
    showNotification('No tool radius recorded — regenerate the tool mesh before exporting G-code.', 'error');
    return null;
  }

  return { segments: buildMoveSegments(safeZ), feedRate, plungeRate };
}

// Render the move sequence as a 3D overlay (solid = cutting, dashed = rapid)
// without writing anything to disk.
export function previewGCode() {
  const prepared = prepareGCode();
  if (!prepared) return;

  clearGCodeVisualization();
  state.gcodeVisualization = buildGCodeVisualization(prepared.segments);
  state.scene.add(state.gcodeVisualization);

  showNotification(`Previewed G-code for ${state.toolPaths.length} toolpath${state.toolPaths.length !== 1 ? 's' : ''}.`);
}

// Write the move sequence out as a .gcode file. Independent of previewGCode —
// works whether or not a preview has been generated yet.
export function downloadGCode() {
  const prepared = prepareGCode();
  if (!prepared) return;

  const text = segmentsToGCode(prepared.segments, prepared.feedRate, prepared.plungeRate);
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'toolpath.gcode';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showNotification(`Downloaded G-code for ${state.toolPaths.length} toolpath${state.toolPaths.length !== 1 ? 's' : ''}.`);
}
