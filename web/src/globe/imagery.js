// @ts-check
import * as Cesium from 'cesium';

/**
 * 1. NASA GIBS Blue Marble Base Layer
 * Seamless 100% full-globe coverage with topography and deep bathymetry.
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
 * 2. NASA GIBS Black Marble / Earth at Night (City Lights)
 * High-resolution golden city lights glowing on the nighttime hemisphere.
 *
 * @returns {Cesium.ImageryProvider|null}
 */
export function createCityLightsProvider() {
  try {
    return new Cesium.WebMapTileServiceImageryProvider({
      url: 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/VIIRS_CityLights_2012/default/default/500m/{TileMatrix}/{TileRow}/{TileCol}.jpg',
      layer: 'VIIRS_CityLights_2012',
      style: 'default',
      format: 'image/jpeg',
      tileMatrixSetID: '500m',
      maximumLevel: 8,
      tilingScheme: new Cesium.GeographicTilingScheme(),
      credit: new Cesium.Credit('NASA GIBS / Earth at Night'),
    });
  } catch (err) {
    console.warn('City Lights imagery unavailable:', err);
    return null;
  }
}

/**
 * 3. NOAA-20 (JPSS-1) VIIRS True-Color Daily Weather & Clouds
 * Ultra high-resolution daily true-color satellite imagery showing real weather and cloud systems.
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
 * 4. NASA GIBS Geopolitical Borders & Coastlines
 * Crisp geopolitical outlines and boundaries matching NASA Worldview.
 *
 * @returns {Cesium.ImageryProvider|null}
 */
export function createBordersProvider() {
  try {
    return new Cesium.WebMapTileServiceImageryProvider({
      url: 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/Reference_Features_15m/default/default/500m/{TileMatrix}/{TileRow}/{TileCol}.png',
      layer: 'Reference_Features_15m',
      style: 'default',
      format: 'image/png',
      tileMatrixSetID: '500m',
      maximumLevel: 8,
      tilingScheme: new Cesium.GeographicTilingScheme(),
      credit: new Cesium.Credit('NASA GIBS / Borders'),
    });
  } catch (err) {
    console.warn('Borders overlay unavailable:', err);
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
