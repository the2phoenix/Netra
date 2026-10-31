// @ts-check
import * as Cesium from 'cesium';

/**
 * Creates NASA GIBS Blue Marble base provider.
 * Completely seamless, 100% full globe coverage with realistic oceans, topography, and landmass.
 *
 * @returns {Cesium.ImageryProvider}
 */
export function createBlueMarbleProvider() {
  try {
    return new Cesium.WebMapTileServiceImageryProvider({
      url: 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/BlueMarble_ShadedRelief_Bathymetry/default/default/500m/{TileMatrix}/{TileRow}/{TileCol}.jpeg',
      layer: 'BlueMarble_ShadedRelief_Bathymetry',
      style: 'default',
      format: 'image/jpeg',
      tileMatrixSetID: '500m',
      maximumLevel: 8,
      tilingScheme: new Cesium.GeographicTilingScheme(),
      credit: new Cesium.Credit('NASA GIBS / Blue Marble'),
    });
  } catch (err) {
    console.warn('GIBS Blue Marble failed, falling back to bundled Natural Earth:', err);
    return createNaturalEarthProvider();
  }
}

/**
 * Creates NOAA-20 (JPSS-1) VIIRS True-Color satellite imagery provider from NASA GIBS.
 * Ultra high-resolution daily true-color imagery from NOAA-20 polar satellite.
 *
 * @returns {Cesium.ImageryProvider|null}
 */
export function createNoaa20Provider() {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];

  try {
    return new Cesium.WebMapTileServiceImageryProvider({
      url: `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/${dateStr}/250m/{TileMatrix}/{TileRow}/{TileCol}.jpg`,
      layer: 'VIIRS_NOAA20_CorrectedReflectance_TrueColor',
      style: 'default',
      format: 'image/jpeg',
      tileMatrixSetID: '250m',
      maximumLevel: 9,
      tilingScheme: new Cesium.GeographicTilingScheme(),
      credit: new Cesium.Credit('NASA GIBS / NOAA-20 VIIRS'),
    });
  } catch (err) {
    console.warn('NOAA-20 VIIRS imagery unavailable:', err);
    return null;
  }
}

/**
 * Bundled offline Natural Earth II imagery provider fallback.
 *
 * @returns {Cesium.ImageryProvider}
 */
export function createNaturalEarthProvider() {
  return new Cesium.TileMapServiceImageryProvider({
    url: Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
  });
}
