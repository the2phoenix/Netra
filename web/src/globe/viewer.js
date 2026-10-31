// @ts-check
import * as Cesium from 'cesium';
import { createGibsImageryProvider } from './imagery.js';
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

  // Add GIBS true-color imagery layer
  viewer.imageryLayers.addImageryProvider(createGibsImageryProvider());

  // Globe visual tuning
  const globe = viewer.scene.globe;
  globe.enableLighting = true; // Day/night sun shading
  globe.baseColor = Cesium.Color.fromCssColorString('#05070A');
  viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#05070A');

  // Disable default screen space controls; let Netra's Intent Engine control the camera
  const controller = viewer.scene.screenSpaceCameraController;
  controller.enableRotate = false;
  controller.enableTranslate = false;
  controller.enableZoom = false;
  controller.enableTilt = false;
  controller.enableLook = false;

  // Bind custom intent camera controls
  setupCameraControls(viewer);

  // Set initial camera perspective (global orbit view)
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(20.0, 10.0, 20000000.0),
  });

  return viewer;
}
