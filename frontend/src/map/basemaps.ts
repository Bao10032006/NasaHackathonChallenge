/*
 * NASA GIBS (Global Imagery Browse Services) public WMTS tiles in Web Mercator — no API key.
 * GIBS Reference_Labels_15m is NOT used: some of its tiles are opaque black palette PNGs that covered
 * the map with black squares. Place names are drawn locally (PLACES).
 * FIRMS MAP_KEYs are for raw fire-detection downloads, which this product must not show
 * (capabilities.rawDetectionPointsAvailable = false), so none is used.
 */
const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'

export const BASEMAPS = {
  night: {
    label: 'Đêm',
    url: `${GIBS}/VIIRS_Black_Marble/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`,
    attribution: 'Ảnh nền © NASA EOSDIS GIBS · VIIRS Black Marble',
  },
  day: {
    label: 'Ngày',
    url: `${GIBS}/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg`,
    attribution: 'Ảnh nền © NASA EOSDIS GIBS · Blue Marble',
  },
} as const

export type BasemapId = keyof typeof BASEMAPS

export const BASEMAP_OPTIONS = (Object.keys(BASEMAPS) as BasemapId[]).map((id) => ({ value: id, label: BASEMAPS[id].label }))

export const COASTLINES_URL = `${GIBS}/Coastlines_15m/default/GoogleMapsCompatible_Level13/{z}/{y}/{x}.png`

/** Native resolution of the GIBS basemaps; deeper zoom only blurs them. */
export const NATIVE_ZOOM = 8

export const VIETNAM_BOUNDS = { west: 102.1, south: 8.2, east: 109.5, north: 23.4 } as const

/** Reference place names (centres of major cities), drawn as non-interactive labels. */
export const PLACES: Array<[string, number, number]> = [
  ['Hà Nội', 21.028, 105.854],
  ['Hải Phòng', 20.845, 106.688],
  ['Điện Biên Phủ', 21.386, 103.023],
  ['Vinh', 18.679, 105.681],
  ['Huế', 16.463, 107.59],
  ['Đà Nẵng', 16.054, 108.202],
  ['Pleiku', 13.983, 108.0],
  ['Buôn Ma Thuột', 12.667, 108.038],
  ['Nha Trang', 12.238, 109.196],
  ['Đà Lạt', 11.94, 108.458],
  ['TP. Hồ Chí Minh', 10.776, 106.701],
  ['Cần Thơ', 10.045, 105.747],
]
