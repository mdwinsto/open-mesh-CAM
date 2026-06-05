import { createIcons, icons } from 'lucide';
import { config } from './state.js';
import { applyRenderSettings } from './renderer.js';

export function initIcons() {
  createIcons({ icons });
}

export function showNotification(message, type = 'success') {
  const toastBox = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className =
    'flex items-center gap-3 p-4 rounded-xl shadow-2xl border backdrop-blur-md pointer-events-auto ' +
    'transition-all duration-300 transform translate-y-4 opacity-0 max-w-sm';

  if (type === 'success') {
    toast.className += ' bg-emerald-950/90 border-emerald-500/30 text-emerald-300';
    toast.innerHTML = `
      <i data-lucide="check-circle" class="w-5 h-5 text-emerald-400 shrink-0"></i>
      <div class="text-xs font-medium">${message}</div>`;
  } else if (type === 'error') {
    toast.className += ' bg-rose-950/90 border-rose-500/30 text-rose-300';
    toast.innerHTML = `
      <i data-lucide="alert-triangle" class="w-5 h-5 text-rose-400 shrink-0"></i>
      <div class="text-xs font-medium">${message}</div>`;
  } else {
    toast.className += ' bg-indigo-950/90 border-indigo-500/30 text-indigo-300';
    toast.innerHTML = `
      <i data-lucide="info" class="w-5 h-5 text-indigo-400 shrink-0"></i>
      <div class="text-xs font-medium">${message}</div>`;
  }

  toastBox.appendChild(toast);
  createIcons({ icons });

  setTimeout(() => toast.classList.remove('translate-y-4', 'opacity-0'), 10);
  setTimeout(() => {
    toast.classList.add('translate-y-4', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

export function setRenderMode(mode) {
  config.renderMode = mode;
  document.getElementById('mode-mesh-edges').className =
    `py-1.5 text-xs font-semibold rounded-md transition-all ${mode === 'both' ? 'text-white bg-indigo-600 shadow-sm' : 'text-gray-400 hover:text-white'}`;
  document.getElementById('mode-edges-only').className =
    `py-1.5 text-xs font-semibold rounded-md transition-all ${mode === 'edges' ? 'text-white bg-indigo-600 shadow-sm' : 'text-gray-400 hover:text-white'}`;
  document.getElementById('mode-mesh-only').className =
    `py-1.5 text-xs font-semibold rounded-md transition-all ${mode === 'mesh' ? 'text-white bg-indigo-600 shadow-sm' : 'text-gray-400 hover:text-white'}`;
  applyRenderSettings();
}

export function setEdgeType(type) {
  config.edgeType = type;

  const allBtn = document.getElementById('edge-type-all');
  const smartBtn = document.getElementById('edge-type-smart');
  const sliderContainer = document.getElementById('threshold-slider-container');
  const sliderInput = document.getElementById('edge-threshold');

  const activeClass =
    'py-1.5 px-3 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-xs font-medium text-indigo-300 transition-all text-center flex items-center justify-center gap-1';
  const inactiveClass =
    'py-1.5 px-3 rounded-lg border border-gray-800 bg-gray-950/40 text-xs font-medium text-gray-400 hover:text-white hover:border-gray-700 transition-all text-center flex items-center justify-center gap-1';

  if (type === 'all') {
    allBtn.className = activeClass;
    smartBtn.className = inactiveClass;
    sliderContainer.className = 'space-y-1.5 opacity-50 pointer-events-none transition-all duration-300';
    sliderInput.disabled = true;
  } else {
    allBtn.className = inactiveClass;
    smartBtn.className = activeClass;
    sliderContainer.className = 'space-y-1.5 opacity-100 transition-all duration-300';
    sliderInput.disabled = false;
  }

  applyRenderSettings();
}
