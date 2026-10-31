// @ts-check
import '@fontsource/saira-condensed/400.css';
import '@fontsource/saira-condensed/500.css';
import '@fontsource/saira-condensed/600.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';

import { initViewer } from './globe/viewer.js';
import { initHUD } from './ui/hud.js';
import { initMouseInput } from './input/mouse.js';
import { clock } from './core/clock.js';
import { state } from './core/state.js';
import { events } from './core/events.js';
import { api } from './data/api.js';
import { SatellitesLayer } from './layers/satellites.js';

async function bootstrap() {
  const container = document.getElementById('cesiumContainer');
  const appRoot = document.getElementById('app');

  if (!container || !appRoot) {
    console.error('DOM containers missing');
    return;
  }

  // 1. Initialize Cesium Globe
  const viewer = initViewer(container);

  // 2. Initialize HUD overlay
  initHUD(appRoot);

  // 3. Initialize intent-based mouse input
  initMouseInput(viewer);

  // 4. Start UTC Clock
  clock.start();

  // 5. Initialize Satellite Layer
  const satLayer = new SatellitesLayer(viewer);

  // 6. Fetch initial data
  await api.fetchHealth();
  const satData = await api.fetchSatellites('stations');
  if (satData && satData.items) {
    satLayer.loadSatellites(satData.items);
  }

  // Periodic health check
  setInterval(() => {
    api.fetchHealth();
  }, 10000);

  // Diagnostic handle for testing and viva presentation
  // @ts-ignore
  window.__netra = {
    viewer,
    state,
    events,
    satLayer,
    api,
  };

  console.log('NETRA Earth Command Center initialized.');
}

window.addEventListener('DOMContentLoaded', bootstrap);

