// @ts-check
import * as Cesium from 'cesium';
import { createBlueMarbleProvider, createNoaa20Provider } from './imagery.js';
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

  // 1. Add seamless NASA Blue Marble base layer (100% full-globe coverage, zero gaps)
  viewer.imageryLayers.addImageryProvider(createBlueMarbleProvider());

  // 2. Add NOAA-20 (JPSS-1) VIIRS True-Color daily satellite imagery
  const noaa20Provider = createNoaa20Provider();
  if (noaa20Provider) {
    const noaa20Layer = viewer.imageryLayers.addImageryProvider(noaa20Provider);
    noaa20Layer.alpha = 0.8; // Blend cleanly with full-globe Blue Marble
  }

  // Globe visual tuning
  const globe = viewer.scene.globe;
  // Full 360 illumination so entire planet is brightly visible without night-side darkness
  globe.enableLighting = false;
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
