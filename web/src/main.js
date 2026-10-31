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
import { LayerPanel } from './ui/layers.js';
import { DossierPanel } from './ui/dossier.js';
import { initMouseInput } from './input/mouse.js';
import { clock } from './core/clock.js';
import { state } from './core/state.js';
import { events } from './core/events.js';
import { api } from './data/api.js';
import { SatellitesLayer } from './layers/satellites.js';
import { AircraftLayer } from './layers/aircraft.js';
import { QuakesLayer } from './layers/quakes.js';
import { FiresLayer } from './layers/fires.js';

async function bootstrap() {
  const container = document.getElementById('cesiumContainer');
  const appRoot = document.getElementById('app');

  if (!container || !appRoot) {
    console.error('DOM containers missing');
    return;
  }

  // 1. Initialize Cesium Globe
  const viewer = initViewer(container);

  // 2. Initialize HUD overlay, Layer Panel, and Dossier Panel
  initHUD(appRoot);
  const layerPanel = new LayerPanel(appRoot);
  const dossierPanel = new DossierPanel(appRoot);

  // 3. Initialize intent-based mouse input
  initMouseInput(viewer);

  // 4. Start UTC Clock
  clock.start();

  // 5. Initialize Layers (Satellites, Aircraft, Quakes, Fires)
  const satLayer = new SatellitesLayer(viewer);
  const aircraftLayer = new AircraftLayer(viewer);
  const quakesLayer = new QuakesLayer(viewer);
  const firesLayer = new FiresLayer(viewer);

  // 6. Fetch initial health & live data feeds
  await api.fetchHealth();

  const satData = await api.fetchSatellites('all');
  if (satData && satData.items) {
    satLayer.loadSatellites(satData.items);
  }

  const flightData = await api.fetchFlights();
  if (flightData && flightData.items) {
    aircraftLayer.updateFlights(flightData.items);
  }

  const quakeData = await api.fetchQuakes(2.5, 'day');
  if (quakeData && quakeData.items) {
    quakesLayer.loadQuakes(quakeData.items);
  }

  const fireData = await api.fetchFires(1);
  if (fireData && fireData.items) {
    firesLayer.loadFires(fireData.items);
  }

  // Poll live flights every 5 seconds
  setInterval(async () => {
    const data = await api.fetchFlights();
    if (data && data.items) {
      aircraftLayer.updateFlights(data.items);
    }
  }, 5000);

  // Poll quakes every 60 seconds
  setInterval(async () => {
    const data = await api.fetchQuakes(2.5, 'day');
    if (data && data.items) {
      quakesLayer.loadQuakes(data.items);
    }
  }, 60000);

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
    aircraftLayer,
    quakesLayer,
    firesLayer,
    layerPanel,
    dossierPanel,
    api,
  };

  console.log('NETRA Earth Command Center initialized.');
}

window.addEventListener('DOMContentLoaded', bootstrap);

