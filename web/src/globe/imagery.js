// @ts-check
import * as Cesium from 'cesium';

/**
 * Creates the primary NASA GIBS true-color imagery layer with yesterday's UTC date.
 * Falls back to Cesium's bundled Natural Earth if network fails.
 *
 * @returns {Cesium.ImageryProvider}
 */
export function createGibsImageryProvider() {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];

  try {
    return new Cesium.WebMapTileServiceImageryProvider({
      url: `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${dateStr}/250m/{TileMatrix}/{TileRow}/{TileCol}.jpg`,
      layer: 'MODIS_Terra_CorrectedReflectance_TrueColor',
      style: 'default',
      format: 'image/jpeg',
      tileMatrixSetID: '250m',
      maximumLevel: 9,
      tilingScheme: new Cesium.GeographicTilingScheme(),
      credit: new Cesium.Credit('NASA GIBS'),
    });
  } catch (err) {
    console.warn('GIBS initialization failed, falling back to bundled Natural Earth:', err);
    return new Cesium.TileMapServiceImageryProvider({
      url: Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
    });
  }
}
