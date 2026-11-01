// @ts-check
import * as Cesium from 'cesium';
import { events } from '../core/events.js';

export const GLOBAL_CCTV_NODES = [
  {
    id: 'cctv-nyc-times-sq',
    name: 'CH 02 // NEW YORK // TIMES SQUARE HUB',
    city: 'NEW YORK, USA',
    lat: 40.7580,
    lon: -73.9855,
    alt: 280,
    feedType: 'traffic-cam',
    imageUrl: 'https://webcams.nyctmc.org/api/cameras/d15e98bb-a0d0-40e9-9133-90d2e2b8eaef/image',
    description: 'Broadway & 7th Ave NYC DOT Live Surveillance Corridor',
  },
  {
    id: 'cctv-nyc-5th-ave',
    name: 'CH 03 // NEW YORK // 5TH AVENUE RECON',
    city: 'NEW YORK, USA',
    lat: 40.7516,
    lon: -73.9822,
    alt: 250,
    feedType: 'traffic-cam',
    imageUrl: 'https://webcams.nyctmc.org/api/cameras/1167664c-b169-42b7-83cf-eb8c89c7438d/image',
    description: 'Midtown Manhattan 5th Ave & 42nd St Tactical Intersection',
  },
  {
    id: 'cctv-nyc-fdr',
    name: 'CH 04 // NEW YORK // BROOKLYN BRIDGE FDR',
    city: 'NEW YORK, USA',
    lat: 40.7061,
    lon: -73.9969,
    alt: 220,
    feedType: 'traffic-cam',
    imageUrl: 'https://webcams.nyctmc.org/api/cameras/cf3c3c39-2b02-4ec4-9dfc-1f48652d2f70/image',
    description: 'FDR Drive & Brooklyn Bridge Maritime Airway Corridor',
  },
  {
    id: 'cctv-tokyo',
    name: 'CH 05 // TOKYO // SHIBUYA METROPOLITAN',
    city: 'TOKYO, JAPAN',
    lat: 35.6595,
    lon: 139.7005,
    alt: 250,
    feedType: 'recon',
    imageUrl: '',
    description: 'Hachiko Pedestrian Scramble Intersection EO/IR Swath',
  },
  {
    id: 'cctv-london',
    name: 'CH 06 // LONDON // WESTMINSTER PALACE',
    city: 'LONDON, UK',
    lat: 51.5007,
    lon: -0.1246,
    alt: 180,
    feedType: 'recon',
    imageUrl: '',
    description: 'River Thames & Westminster Abbey Airway Intercept',
  },
  {
    id: 'cctv-mumbai',
    name: 'CH 07 // MUMBAI // GATEWAY HARBOR',
    city: 'MUMBAI, INDIA',
    lat: 18.9220,
    lon: 72.8347,
    alt: 120,
    feedType: 'recon',
    imageUrl: '',
    description: 'Colaba Arabian Sea Coastal Port Surveillance',
  },
  {
    id: 'cctv-paris',
    name: 'CH 08 // PARIS // EIFFEL TOWER',
    city: 'PARIS, FRANCE',
    lat: 48.8584,
    lon: 2.2945,
    alt: 320,
    feedType: 'recon',
    imageUrl: '',
    description: 'Champ de Mars Aerospace & Metropolitan Corridor',
  },
  {
    id: 'cctv-dubai',
    name: 'CH 09 // DUBAI // BURJ KHALIFA',
    city: 'DUBAI, UAE',
    lat: 25.1972,
    lon: 55.2744,
    alt: 500,
    feedType: 'recon',
    imageUrl: '',
    description: 'Burj Khalifa Metropolitan Observation Swath',
  },
];

/**
 * Tactical CCTV Cameras Layer
 * Renders interactive optical nodes across major global metropolitan centers.
 */
export class CCTVLayer {
  /**
   * @param {Cesium.Viewer} viewer
   */
  constructor(viewer) {
    this.viewer = viewer;
    this.collection = viewer.scene.primitives.add(new Cesium.BillboardCollection());
    this.labels = viewer.scene.primitives.add(new Cesium.LabelCollection());
    this.cameraMap = new Map();
    this.visible = true;

    this.createMarkers();
    this.setupPicking();

    // Layer toggle listener
    events.subscribe('state:layers', (layers) => {
      if (typeof layers.cctv !== 'undefined') {
        this.visible = layers.cctv;
        this.collection.show = this.visible;
        this.labels.show = this.visible;
      }
    });
  }

  createMarkers() {
    const iconSvg = `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="16" fill="rgba(6, 182, 212, 0.35)" stroke="#00F0FF" stroke-width="2"/>
        <circle cx="18" cy="18" r="6" fill="#00F0FF"/>
        <path d="M18 4 L18 10 M18 26 L18 32 M4 18 L10 18 M26 18 L32 18" stroke="#00F0FF" stroke-width="2"/>
      </svg>
    `)}`;

    for (const node of GLOBAL_CCTV_NODES) {
      const pos = Cesium.Cartesian3.fromDegrees(node.lon, node.lat, node.alt);

      const billboard = this.collection.add({
        position: pos,
        image: iconSvg,
        width: 30,
        height: 30,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      });

      const label = this.labels.add({
        position: pos,
        text: `CAM: ${node.city.split(',')[0]}`,
        font: '10px "JetBrains Mono", monospace',
        fillColor: Cesium.Color.fromCssColorString('#00F0FF'),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -22),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      });

      const entry = { billboard, label, data: node };
      billboard.id = node.id;
      this.cameraMap.set(node.id, entry);
    }
  }

  setupPicking() {
    const handler = new Cesium.ScreenSpaceEventHandler(this.viewer.canvas);
    handler.setInputAction((movement) => {
      if (!this.visible) return;
      const picked = this.viewer.scene.pick(movement.position);
      if (Cesium.defined(picked) && picked.primitive && picked.id && this.cameraMap.has(picked.id)) {
        const item = this.cameraMap.get(picked.id).data;
        this.selectCamera(item);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  /**
   * @param {typeof GLOBAL_CCTV_NODES[0]} camera
   */
  selectCamera(camera) {
    // Open surveillance feed and switch channel
    events.emit('cctv:selected', camera);

    // Smoothly fly camera to city with a 3D oblique angle
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(camera.lon, camera.lat, 3500.0),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-35), // 3D oblique angle
        roll: 0,
      },
      duration: 2.2,
    });
  }
}
