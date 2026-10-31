// @ts-check
import * as Cesium from 'cesium';
import { createBlueMarbleProvider, createDailyModisProvider } from './imagery.js';
import { setupCameraControls } from './camera.js';

/**
 * Initializes the customized Cesium 3D Globe Viewer.
 * Strips out default widgets to fit the dark command center aesthetic.
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

  // 1. Add seamless NASA Blue Marble base layer (guarantees 100% full-globe coverage)
  viewer.imageryLayers.addImageryProvider(createBlueMarbleProvider());

  // 2. Add daily MODIS true-color cloud/swath overlay on top
  const dailyProvider = createDailyModisProvider();
  if (dailyProvider) {
    const dailyLayer = viewer.imageryLayers.addImageryProvider(dailyProvider);
    dailyLayer.alpha = 0.75; // subtle blend with base layer
  }

  // Globe visual tuning
  const globe = viewer.scene.globe;
  globe.enableLighting = true; // Day/night sun shading
  // Soft ambient lighting so nighttime side shows landmass & ocean outlines instead of pitch-black void
  globe.ambientLightColor = new Cesium.Color(0.35, 0.38, 0.45, 1.0);
  globe.baseColor = Cesium.Color.fromCssColorString('#0B0F14');
  globe.showGroundAtmosphere = true;
  viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#05070A');

  // Disable default screen space controls; Netra's Intent Engine controls the camera
  const controller = viewer.scene.screenSpaceCameraController;
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
