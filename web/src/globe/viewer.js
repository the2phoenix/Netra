// @ts-check
import * as Cesium from 'cesium';
import {
  createBlueMarbleProvider,
  createCityLightsProvider,
  createNoaa20Provider,
  createBordersProvider,
} from './imagery.js';
import { setupCameraControls } from './camera.js';
import { events } from '../core/events.js';

/**
 * Initializes the customized Cesium 3D Globe Viewer.
 * Calibrated to match NASA Eyes on the Earth & NASA Worldview:
 * - Glowing atmospheric limb (Rayleigh scattering)
 * - Deep-space starfield background
 * - Dynamic Day/Night terminator with golden city lights on the night side
 * - NOAA-20 VIIRS live weather clouds
 * - Geopolitical borders and coastline outlines
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

  // 1. NASA Blue Marble Base Layer (Full 360 degree coverage)
  layers.addImageryProvider(createBlueMarbleProvider());

  // 2. NASA City Lights (Earth at Night) - Glowing golden lights on the night side
  let lightsLayer = null;
  const lightsProvider = createCityLightsProvider();
  if (lightsProvider) {
    lightsLayer = layers.addImageryProvider(lightsProvider);
    lightsLayer.dayAlpha = 0.0;
    lightsLayer.nightAlpha = 1.0;
  }

  // 3. NOAA-20 VIIRS True-Color Daily Satellite Imagery & Weather Clouds
  let noaa20Layer = null;
  const noaa20Provider = createNoaa20Provider();
  if (noaa20Provider) {
    noaa20Layer = layers.addImageryProvider(noaa20Provider);
    noaa20Layer.dayAlpha = 0.85; // Vibrant clouds on day side
    noaa20Layer.nightAlpha = 0.0; // Fade out on night side so city lights shine
  }

  // 4. NASA Geopolitical Borders & Coastlines Overlay
  let bordersLayer = null;
  const bordersProvider = createBordersProvider();
  if (bordersProvider) {
    bordersLayer = layers.addImageryProvider(bordersProvider);
    bordersLayer.alpha = 0.65;
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
  globe.ambientLightColor = new Cesium.Color(0.20, 0.24, 0.32, 1.0);
  globe.baseColor = Cesium.Color.fromCssColorString('#061426');

  // Glowing blue atmospheric halo around the perimeter (NASA Rayleigh limb scattering)
  globe.showGroundAtmosphere = true;
  globe.atmosphereLightIntensity = 12.0;
  globe.atmosphereRayleighScaleHeight = 10000;

  if (scene.skyAtmosphere) {
    scene.skyAtmosphere.show = true;
    scene.skyAtmosphere.atmosphereLightIntensity = 12.0;
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
