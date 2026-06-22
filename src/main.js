import './app.css';
import { createIcons, icons } from 'lucide';
import { state, config } from './js/state.js';
import { initThree } from './js/scene.js';
import { displaySTL, applyRenderSettings, centerAndScaleModel } from './js/renderer.js';
import { parseSTLData } from './js/stl-parser.js';
import { showNotification, setRenderMode } from './js/ui.js';
import { onPointerDown, onPointerUp, clearSelection } from './js/raycaster.js';
import { performSlicing, clearSlices } from './js/slicing.js';
import { makeToolpaths, clearToolpaths } from './js/toolpath.js';
import { makeToolMesh } from './js/toolmesh.js';
import { previewGCode, downloadGCode } from './js/gcode.js';

function processFile(file) {
  if (!file) return;
  document.getElementById('loader-badge').classList.remove('hidden');

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const result = parseSTLData(e.target.result);
      displaySTL(result.geometry, file.name, file.size, result.binary);
      showNotification(`Successfully loaded "${file.name}"!`);
    } catch (err) {
      showNotification('Failed to parse STL file: ' + err.message, 'error');
      document.getElementById('loader-badge').classList.add('hidden');
    }
  };
  reader.onerror = () => {
    showNotification('Error loading the file from disk.', 'error');
    document.getElementById('loader-badge').classList.add('hidden');
  };
  reader.readAsArrayBuffer(file);
}

document.addEventListener('DOMContentLoaded', () => {
  createIcons({ icons });
  initThree();

  state.renderer.domElement.addEventListener('pointerdown', onPointerDown);
  state.renderer.domElement.addEventListener('pointerup', onPointerUp);

  // Inspector
  document.getElementById('btn-close-inspector').addEventListener('click', clearSelection);

  // Tool Mesh
  document.getElementById('tool-mesh-btn').addEventListener('click', makeToolMesh);

  // Slicing
  document.getElementById('slice-x-btn').addEventListener('click', () => performSlicing('x'));
  document.getElementById('slice-y-btn').addEventListener('click', () => performSlicing('y'));
  document.getElementById('slice-z-btn').addEventListener('click', () => performSlicing('z'));
  document.getElementById('clear-slices-btn').addEventListener('click', clearSlices);
  document.getElementById('gen-toolpaths-btn').addEventListener('click', makeToolpaths);
  document.getElementById('clear-toolpaths-btn').addEventListener('click', clearToolpaths);

  // G-Code
  document.getElementById('gen-gcode-btn').addEventListener('click', previewGCode);
  document.getElementById('download-gcode-btn').addEventListener('click', downloadGCode);

  // Render mode
  document.getElementById('mode-mesh-edges').addEventListener('click', () => setRenderMode('both'));
  document.getElementById('mode-edges-only').addEventListener('click', () => setRenderMode('edges'));
  document.getElementById('mode-mesh-only').addEventListener('click', () => setRenderMode('mesh'));

  // Viewport toggles
  document.getElementById('toggle-stl-mesh').addEventListener('change', (e) => {
    config.showStlMesh = e.target.checked;
    applyRenderSettings();
  });
  document.getElementById('toggle-tool-mesh').addEventListener('change', (e) => {
    config.showToolMesh = e.target.checked;
    applyRenderSettings();
  });
  document.getElementById('toggle-slices').addEventListener('change', (e) => {
    config.showSlices = e.target.checked;
    applyRenderSettings();
  });
  document.getElementById('toggle-toolpaths').addEventListener('change', (e) => {
    config.showToolpaths = e.target.checked;
    applyRenderSettings();
  });
  document.getElementById('toggle-gcode-path').addEventListener('change', (e) => {
    config.showGcodePath = e.target.checked;
    applyRenderSettings();
  });
  document.getElementById('toggle-grid').addEventListener('change', (e) => {
    config.showGrid = e.target.checked;
    applyRenderSettings();
  });
  document.getElementById('toggle-boundary-connectors').addEventListener('change', (e) => {
    config.showBoundaryConnectors = e.target.checked;
    applyRenderSettings();
  });

  // Camera controls
  document.getElementById('btn-reset-cam').addEventListener('click', centerAndScaleModel);
  document.getElementById('btn-fit-cam').addEventListener('click', () => {
    if (state.activeMesh) {
      state.controls.reset();
      centerAndScaleModel();
    }
  });

  // File input & drag-and-drop
  const fileInput = document.getElementById('file-input');
  const dropZone = document.getElementById('drop-zone');

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-indigo-500', 'bg-indigo-950/20');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('border-indigo-500', 'bg-indigo-950/20');
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-indigo-500', 'bg-indigo-950/20');
    if (e.dataTransfer.files.length > 0) processFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      processFile(e.target.files[0]);
      fileInput.value = '';
    }
  });
});
