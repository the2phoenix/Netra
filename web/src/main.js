// @ts-check
import '@fontsource/saira-condensed/400.css';
import '@fontsource/saira-condensed/500.css';
import '@fontsource/saira-condensed/600.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';

import * as satellite from 'satellite.js';
import { initViewer } from './globe/viewer.js';
import { initHUD } from './ui/hud.js';
import { LayerPanel } from './ui/layers.js';
import { DossierPanel } from './ui/dossier.js';
import { EventFeed } from './ui/feed.js';
import { ScanMode } from './ui/scan.js';
import { initMouseInput } from './input/mouse.js';
import { intents } from './input/intents.js';
import { clock } from './core/clock.js';
import { state } from './core/state.js';
import { events } from './core/events.js';
import { api } from './data/api.js';
import { SatellitesLayer } from './layers/satellites.js';
import { AircraftLayer } from './layers/aircraft.js';
import { QuakesLayer } from './layers/quakes.js';
import { FiresLayer } from './layers/fires.js';
import { GroundTrackLayer } from './layers/groundTrack.js';
import { GeofenceManager } from './geo/geofence.js';

async function bootstrap() {
  const container = document.getElementById('cesiumContainer');
  const appRoot = document.getElementById('app');

  if (!container || !appRoot) {
    console.error('DOM containers missing');
    return;
  }

  // 1. Initialize Cesium Globe
  const viewer = initViewer(container);

  // 2. Initialize HUD overlay, Panels, and Event Feed
  initHUD(appRoot);
  const layerPanel = new LayerPanel(appRoot);
  const dossierPanel = new DossierPanel(appRoot);
  const eventFeed = new EventFeed(appRoot);

  // 3. Initialize Geofence Manager and Scan Mode
  const geofenceManager = new GeofenceManager();
  // Default corridor for demonstration
  geofenceManager.addCircularZone('Delhi NCR Corridor', 28.6139, 77.2090, 75000);

  const scanMode = new ScanMode(appRoot, viewer, geofenceManager);

  // 4. Initialize intent-based mouse input
  initMouseInput(viewer);

  // 5. Start UTC Clock
  clock.start();

  // 6. Initialize Layers (Satellites, Aircraft, Quakes, Fires, Ground Track)
  const satLayer = new SatellitesLayer(viewer);
  const aircraftLayer = new AircraftLayer(viewer);
  const quakesLayer = new QuakesLayer(viewer);
  const firesLayer = new FiresLayer(viewer);
  const groundTrackLayer = new GroundTrackLayer(viewer);

  // Satellite ground track lifecycle
  events.subscribe('satellite:selected-item', (item) => {
    if (item && item.line1 && item.line2) {
      try {
        const satrec = satellite.twoline2satrec(item.line1, item.line2);
        groundTrackLayer.setSatellite(satrec, item.alt_km || 400);
      } catch (err) {
        // Skip malformed TLE
      }
    }
  });

  events.subscribe('satellite:deselected', () => {
    groundTrackLayer.clear();
  });

  events.subscribe('satellite:toggle-track', (id) => {
    if (groundTrackLayer.currentSatrec) {
      groundTrackLayer.clear();
    } else {
      const item = satLayer.itemMap.get(id);
      if (item && item.line1 && item.line2) {
        const satrec = satellite.twoline2satrec(item.line1, item.line2);
        groundTrackLayer.setSatellite(satrec, item.alt_km || 400);
      }
    }
  });

  // 7. Fetch initial health & live data feeds
  await api.fetchHealth();

  const satData = await api.fetchSatellites('all');
  if (satData && satData.items) {
    satLayer.loadSatellites(satData.items);
  }

  const flightData = await api.fetchFlights();
  if (flightData && flightData.items) {
    aircraftLayer.updateFlights(flightData.items);
    const zoneAlerts = geofenceManager.evaluateEntities(flightData.items, 'aircraft');
    for (const alert of zoneAlerts) {
      events.emit('geofence:alert', alert);
    }
  }

  const quakeData = await api.fetchQuakes(2.5, 'day');
  if (quakeData && quakeData.items) {
    quakesLayer.loadQuakes(quakeData.items);
    // Log notable initial quakes
    for (const q of quakeData.items) {
      if (q.mag >= 5.0) {
        events.emit('quake:new', q);
      }
    }
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
      const zoneAlerts = geofenceManager.evaluateEntities(data.items, 'aircraft');
      for (const alert of zoneAlerts) {
        events.emit('geofence:alert', alert);
      }
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

  // Diagnostic handle for testing, Playwright, and viva presentation
  // @ts-ignore
  window.__netra = {
    viewer,
    state,
    events,
    intents,
    satLayer,
    aircraftLayer,
    quakesLayer,
    firesLayer,
    groundTrackLayer,
    geofenceManager,
    scanMode,
    eventFeed,
    layerPanel,
    dossierPanel,
    api,
  };

  console.log('NETRA Earth Command Center initialized. Phase 5 Scan & Alerts operational.');
}

window.addEventListener('DOMContentLoaded', bootstrap);
