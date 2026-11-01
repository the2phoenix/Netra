// @ts-check
import * as Cesium from 'cesium';
import { events } from '../core/events.js';

export const GLOBAL_CCTV_NODES = [
  {
    id: 'cctv-tokyo',
    name: 'CH 02 // TOKYO // SHIBUYA CROSSING',
    city: 'TOKYO, JAPAN',
    lat: 35.6595,
    lon: 139.7005,
    alt: 250,
    feedType: 'live',
    streamUrl: 'https://www.youtube-nocookie.com/embed/w_HXaW4iTj8?autoplay=1&mute=1&controls=0&modestbranding=1',
    description: 'Hachiko Pedestrian Scramble Intersection Recon',
  },
  {
    id: 'cctv-nyc',
    name: 'CH 03 // NEW YORK // TIMES SQUARE HUB',
    city: 'NEW YORK, USA',
    lat: 40.7580,
    lon: -73.9855,
    alt: 280,
    feedType: 'live',
    streamUrl: 'https://www.youtube-nocookie.com/embed/1-iS7LArMPA?autoplay=1&mute=1&controls=0&modestbranding=1',
    description: 'Broadway & 7th Avenue Midtown Surveillance Corridor',
  },
  {
    id: 'cctv-london',
    name: 'CH 04 // LONDON // WESTMINSTER PALACE',
    city: 'LONDON, UK',
    lat: 51.5007,
    lon: -0.1246,
    alt: 180,
    feedType: 'live',
    streamUrl: 'https://www.youtube-nocookie.com/embed/79_c9m7_1B4?autoplay=1&mute=1&controls=0&modestbranding=1',
    description: 'River Thames & Westminster Abbey Airway',
  },
  {
    id: 'cctv-venice',
    name: 'CH 05 // VENICE // GRAND CANAL',
    city: 'VENICE, ITALY',
    lat: 45.4381,
    lon: 12.3358,
    alt: 150,
    feedType: 'live',
    streamUrl: 'https://www.youtube-nocookie.com/embed/ph1vpnYgxJk?autoplay=1&mute=1&controls=0&modestbranding=1',
    description: 'Rialto Maritime Basin & Waterway Intercept',
  },
  {
    id: 'cctv-mumbai',
    name: 'CH 06 // MUMBAI // GATEWAY HARBOR',
    city: 'MUMBAI, INDIA',
    lat: 18.9220,
    lon: 72.8347,
    alt: 120,
    feedType: 'recon',
    streamUrl: '',
    description: 'Colaba Arabian Sea Coastal Port Surveillance',
  },
  {
    id: 'cctv-paris',
    name: 'CH 07 // PARIS // EIFFEL TOWER',
    city: 'PARIS, FRANCE',
    lat: 48.8584,
    lon: 2.2945,
    alt: 320,
    feedType: 'live',
    streamUrl: 'https://www.youtube-nocookie.com/embed/OzYpT3q6HdA?autoplay=1&mute=1&controls=0&modestbranding=1',
    description: 'Champ de Mars Aerospace Corridor',
  },
  {
    id: 'cctv-dubai',
    name: 'CH 08 // DUBAI // DOWNTOWN TOWER',
    city: 'DUBAI, UAE',
    lat: 25.1972,
    lon: 55.2744,
    alt: 500,
    feedType: 'recon',
    streamUrl: '',
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
        <circle cx="18" cy="18" r="16" fill="rgba(6, 182, 212, 0.25)" stroke="#00F0FF" stroke-width="2"/>
        <circle cx="18" cy="18" r="6" fill="#00F0FF"/>
        <path d="M18 4 L18 10 M18 26 L18 32 M4 18 L10 18 M26 18 L32 18" stroke="#00F0FF" stroke-width="2"/>
      </svg>
    `)}`;

    for (const node of GLOBAL_CCTV_NODES) {
      const pos = Cesium.Cartesian3.fromDegrees(node.lon, node.lat, node.alt);

      const billboard = this.collection.add({
        position: pos,
        image: iconSvg,
        width: 28,
        height: 28,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
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

    // Smoothly fly camera to city
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(camera.lon, camera.lat, 4500.0),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0,
      },
      duration: 2.2,
    });
  }
}
