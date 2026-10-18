import './style.css';
import { StudioViewer } from './viewer.js';
import { CONSOLES } from './models.js';

const canvas = document.querySelector('#scene');
const viewport = document.querySelector('#viewport');
const toastElement = document.querySelector('#toast');
let toastTimeout;
function toast(message) {
  clearTimeout(toastTimeout);
  toastElement.textContent = message;
  toastElement.classList.add('visible');
  toastTimeout = setTimeout(() => toastElement.classList.remove('visible'), 3200);
}

const references = document.querySelector('#references-dialog');
document.querySelector('#references-open').addEventListener('click', () => references.showModal());
document.querySelector('#references-close').addEventListener('click', () => references.close());
references.addEventListener('click', event => { if (event.target === references) { const bounds = references.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) references.close(); } });
document.querySelector('#reload').addEventListener('click', () => window.location.reload());

function showError(message) {
  document.querySelector('#loading').hidden = true;
  const error = document.querySelector('#viewer-error');
  error.hidden = false;
  if (message) error.querySelector('p').textContent = message;
  document.querySelectorAll('.model-option, .segmented button, .swatch, #controller-toggle, #rotate-toggle, #reset-view, #export-image, #fullscreen').forEach(button => { button.disabled = true; });
}

viewport.addEventListener('viewer-error', event => showError(event.detail));

try {
  const viewer = new StudioViewer(canvas, viewport);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const loading = document.querySelector('#loading');
    loading.classList.add('finished');
    loading.setAttribute('aria-hidden', 'true');
  }));

  function selectModel(variant) {
    viewer.setModel(variant);
    document.querySelectorAll('[data-model]').forEach(button => {
      const selected = button.dataset.model === variant;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    const config = CONSOLES[variant];
    document.querySelector('#caption-name').textContent = config.name;
    document.querySelector('#caption-detail').textContent = config.detail;
    document.querySelector('#object-number').textContent = config.number;
    document.querySelector('#object-name').textContent = variant === 'original' ? 'PLAYSTATION 5' : `PLAYSTATION 5 ${variant.toUpperCase()}`;
  }

  function selectOrientation(orientation) {
    viewer.setOrientation(orientation);
    document.querySelectorAll('[data-orientation]').forEach(button => {
      const selected = button.dataset.orientation === orientation;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  document.querySelectorAll('[data-model]').forEach(button => button.addEventListener('click', () => selectModel(button.dataset.model)));
  document.querySelectorAll('[data-orientation]').forEach(button => button.addEventListener('click', () => selectOrientation(button.dataset.orientation)));
  document.querySelector('#controller-toggle').addEventListener('change', event => viewer.setController(event.target.checked));
  document.querySelectorAll('[data-theme]').forEach(button => button.addEventListener('click', () => {
    viewer.setTheme(button.dataset.theme);
    document.body.dataset.theme = button.dataset.theme;
    document.querySelectorAll('[data-theme].swatch').forEach(swatch => {
      const selected = swatch === button;
      swatch.classList.toggle('active', selected);
      swatch.setAttribute('aria-pressed', String(selected));
    });
  }));
  document.querySelector('#rotate-toggle').addEventListener('click', event => {
    const button = event.currentTarget;
    viewer.controls.autoRotate = !viewer.controls.autoRotate;
    button.classList.toggle('active', viewer.controls.autoRotate);
    button.setAttribute('aria-pressed', String(viewer.controls.autoRotate));
    button.setAttribute('aria-label', `${viewer.controls.autoRotate ? 'Pause' : 'Start'} auto rotation`);
    button.title = viewer.controls.autoRotate ? 'Pause rotation' : 'Auto rotate';
  });
  document.querySelector('#reset-view').addEventListener('click', () => { viewer.resetView(); toast('View reset'); });
  document.querySelector('#fullscreen').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (viewport.requestFullscreen) await viewport.requestFullscreen();
      else toast('Fullscreen is unavailable in this browser');
    } catch { toast('Fullscreen is unavailable in this browser'); }
  });
  document.addEventListener('fullscreenchange', () => {
    const button = document.querySelector('#fullscreen');
    button.setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen');
    button.title = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
    viewer.resize();
    viewer.resetView(false);
  });
  document.querySelector('#export-image').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try { await viewer.saveImage(); toast('Image saved'); }
    catch { toast('Could not save the image. Please try again.'); }
    finally { button.disabled = false; }
  });
  document.querySelectorAll('[data-reference-model]').forEach(button => button.addEventListener('click', () => {
    selectModel(button.dataset.referenceModel);
    selectOrientation(button.dataset.referenceOrientation ?? 'vertical');
    references.close();
  }));
} catch (error) {
  console.error('Unable to initialize the 3D studio:', error);
  showError();
}
