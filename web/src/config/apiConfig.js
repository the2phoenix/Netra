// @ts-check

/**
 * NETRA Tactical Intelligence API Configuration
 * Centralized API endpoints, authentication keys, and generous free-tier credentials.
 * Keys can be overridden via Vite environment variables (VITE_*) or browser localStorage.
 */

// Helper to resolve key from Vite env or localStorage or default fallback
function resolveKey(envVar, storageKey, defaultVal = '') {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[envVar]) {
      return import.meta.env[envVar];
    }
  } catch (e) {
    // Ignore env error
  }
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(storageKey)) {
      return localStorage.getItem(storageKey);
    }
  } catch (e) {
    // Ignore storage error
  }
  return defaultVal;
}

export const API_CONFIG = {
  /**
   * 1. Google Maps Photorealistic 3D Tiles API
   * Free Tier: $200/month recurring Google Cloud credit (~28,500 root tile sessions/mo)
   * Streams 3D buildings, city structures, and bridges directly into Cesium.
   */
  google3d: {
    name: 'Google Maps Photorealistic 3D Tiles',
    key: resolveKey('VITE_GOOGLE_MAPS_KEY', 'NETRA_GOOGLE_MAPS_KEY', 'AIzaSyAZu8mjUqiOqEaeNWVILfp2Tyd1vLkcexQ'),
    quota: '$200/mo recurring GCP credit (~28.5k sessions)',
    active: true,
  },

  /**
   * 2. Mapbox Vector & Satellite API
   * Free Tier: 50,000 free map loads every month
   * High-contrast tactical vector roads, building footprints, and hybrid borders.
   */
  mapbox: {
    name: 'Mapbox Vector & Satellite',
    token: resolveKey('VITE_MAPBOX_TOKEN', 'NETRA_MAPBOX_TOKEN', 'pk.eyJ1IjoibmV0cmEtdGFjdGljYWwiLCJhIjoiY2x1ZXN4ZTNjMDN4MjJxbnh1aW0yeG1kNSJ9.demo'),
    styles: {
      dark: 'mapbox://styles/mapbox/dark-v11',
      satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
      tactical: 'mapbox://styles/mapbox/navigation-night-v1',
    },
    quota: '50,000 free loads/month',
  },

  /**
   * 3. Windy Webcams / OpenWebcams API
   * Free Tier: 1,000 requests/day
   * Over 50,000 public highway, border, and city webcams globally.
   */
  windy: {
    name: 'Windy Webcams',
    key: resolveKey('VITE_WINDY_KEY', 'NETRA_WINDY_KEY', ''),
    endpoint: 'https://api.windy.com/api/webcams/v2',
    quota: '1,000 free requests/day',
  },

  /**
   * 4. NYC DOT & Caltrans Traffic Cameras
   * 100% Free & Keyless (Public Open Data)
   * Over 1,500 live traffic cameras in NYC & California updating every 2-5 seconds.
   */
  trafficCams: {
    name: 'NYC DOT & Caltrans Open Traffic Feeds',
    requiresKey: false,
    endpoints: {
      nycTimesSquare: 'https://webcams.nyctmc.org/api/cameras/d15e98bb-a0d0-40e9-9133-90d2e2b8eaef/image',
      nyc5thAve: 'https://webcams.nyctmc.org/api/cameras/1167664c-b169-42b7-83cf-eb8c89c7438d/image',
      nycBrooklynBridge: 'https://webcams.nyctmc.org/api/cameras/cf3c3c39-2b02-4ec4-9dfc-1f48652d2f70/image',
    },
  },

  /**
   * 5. OpenStreetMap Overpass & Nominatim Geocoding API
   * 100% Free & Keyless
   * Search any destination or monument globally; query military bases, radar domes, and runways.
   */
  osm: {
    name: 'OpenStreetMap Nominatim & Overpass',
    requiresKey: false,
    nominatimEndpoint: 'https://nominatim.openstreetmap.org/search',
    overpassEndpoint: 'https://overpass-api.de/api/interpreter',
  },

  /**
   * 6. OpenSky Network Live ADS-B API
   * 100% Free
   * Global commercial and military aircraft transponder telemetry.
   */
  opensky: {
    name: 'OpenSky Network ADS-B',
    username: resolveKey('VITE_OPENSKY_USER', 'NETRA_OPENSKY_USER', ''),
    password: resolveKey('VITE_OPENSKY_PASS', 'NETRA_OPENSKY_PASS', ''),
    endpoint: 'https://opensky-network.org/api/states/all',
    quota: 'Unlimited free queries (sampled)',
  },

  /**
   * 7. USGS Seismic & NASA FIRMS Thermal IR
   * 100% Free & Keyless
   * Global tectonic fault earthquakes and MODIS/VIIRS wildfire anomalies.
   */
  hazards: {
    usgsEndpoint: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary',
    firmsEndpoint: 'https://firms.modaps.eosdis.nasa.gov',
    requiresKey: false,
  },
};

