// @ts-check
import * as Cesium from 'cesium';
import {
  createBlueMarbleProvider,
  createEsriWorldImageryProvider,
  createWorldTerrainProvider,
  createCityLightsProvider,
  createNoaa20Provider,
  createBordersProvider,
} from './imagery.js';
import { setupCameraControls } from './camera.js';
import { events } from '../core/events.js';

/**
 * Initializes the customized Cesium 3D Globe Viewer.
 * High-definition sub-meter spatial command center:
 * - Sub-meter satellite imagery (ESRI World Imagery level 19)
 * - True 3D mountain elevation terrain (ArcGIS Terrain3D)
 * - Dynamic Day/Night terminator with golden city lights on night side
 * - Calibrated atmospheric limb and delicate weather clouds
 *
 * @param {string|HTMLElement} container
 * @returns {Cesium.Viewer}
 */
export function initViewer(container) {
  // Disable Cesium Ion default warning/token requirement
  Cesium.Ion.defaultAccessToken = '';

  const viewer = new Cesium.Viewer(container, {
    baseLayer: false,
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: false,
    selectionIndicator: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    vrButton: false,
    creditContainer: document.createElement('div'), // Off-screen credit container
    scene3DOnly: true,
  });

  const layers = viewer.imageryLayers;

  // 1. NASA Blue Marble Base Underlayer
  layers.addImageryProvider(createBlueMarbleProvider());

  // 2. High-Resolution Sub-Meter Satellite Imagery (ESRI World Imagery down to Level 19)
  createEsriWorldImageryProvider().then((esriProvider) => {
    if (esriProvider) {
      layers.addImageryProvider(esriProvider);
    }
  });

  // 3. True 3D Mountain & Elevation Terrain (Physical Topography)
  createWorldTerrainProvider().then((terrainProvider) => {
    if (terrainProvider) {
      viewer.terrainProvider = terrainProvider;
    }
  });

  // 4. NASA City Lights (Earth at Night) - Glowing golden lights on the night side
  let lightsLayer = null;
  const lightsProvider = createCityLightsProvider();
  if (lightsProvider) {
    lightsLayer = layers.addImageryProvider(lightsProvider);
    lightsLayer.dayAlpha = 0.0;
    lightsLayer.nightAlpha = 1.0;
  }

  // 5. NOAA-20 VIIRS True-Color Daily Satellite Imagery & Weather Clouds (Calibrated wisps)
  let noaa20Layer = null;
  const noaa20Provider = createNoaa20Provider();
  if (noaa20Provider) {
    noaa20Layer = layers.addImageryProvider(noaa20Provider);
    noaa20Layer.dayAlpha = 0.22; // Subtle realistic cloud wisps
    noaa20Layer.nightAlpha = 0.0; // Fade out on night side
  }

  // 6. NASA Geopolitical Borders & Coastlines Overlay
  let bordersLayer = null;
  const bordersProvider = createBordersProvider();
  if (bordersProvider) {
    bordersLayer = layers.addImageryProvider(bordersProvider);
    bordersLayer.alpha = 0.55;
  }

  // Imagery layer visibility subscription
  events.subscribe('imagery:toggle', ({ layer, visible }) => {
    if (layer === 'nightLights' && lightsLayer) lightsLayer.show = visible;
    if (layer === 'clouds' && noaa20Layer) noaa20Layer.show = visible;
    if (layer === 'borders' && bordersLayer) bordersLayer.show = visible;
  });

  // Visual Atmosphere & Space Lighting Calibration
  const scene = viewer.scene;
  const globe = scene.globe;

  // Day/Night dynamic sunlight calculation
  globe.enableLighting = true;
  globe.dynamicAtmosphereLighting = true;
  globe.dynamicAtmosphereLightingFromSun = true;

  // Night-side ambient twilight color (deep ocean blue, never pitch black)
  globe.ambientLightColor = new Cesium.Color(0.28, 0.32, 0.40, 1.0);
  globe.baseColor = Cesium.Color.fromCssColorString('#061426');

  // Glowing blue atmospheric halo around perimeter (Rayleigh limb scattering)
  globe.showGroundAtmosphere = true;
  globe.atmosphereLightIntensity = 2.5; // Crisp, high-contrast surface visibility
  globe.atmosphereRayleighScaleHeight = 10000;

  if (scene.skyAtmosphere) {
    scene.skyAtmosphere.show = true;
    scene.skyAtmosphere.atmosphereLightIntensity = 2.5;
  }

  // Disable default screen space controls; Netra's Intent Engine controls camera
  const controller = scene.screenSpaceCameraController;
  controller.enableRotate = false;
  controller.enableTranslate = false;
  controller.enableZoom = false;
  controller.enableTilt = false;
  controller.enableLook = false;

  // Bind custom intent camera controls
  setupCameraControls(viewer);

  // Set initial camera perspective (global orbit view showing full Earth)
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(20.0, 15.0, 22000000.0),
  });

  return viewer;
}
