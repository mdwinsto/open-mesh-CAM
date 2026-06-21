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
