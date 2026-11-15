const radians = Math.PI / 180

export const worldX = (lon: number) => (lon + 180) / 360
export const worldY = (lat: number) => (1 - Math.asinh(Math.tan(lat * radians)) / Math.PI) / 2
export const longitude = (x: number) => x * 360 - 180
export const latitude = (y: number) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) / radians

const service = 'https://server.arcgisonline.com/ArcGIS/rest/services/'

export type Basemap = 'imagery' | 'topo'

/**
 * Tile keys are zoom/row/column in every service. `maxZoom` is the deepest level the layer publishes.
 * `labels` adds Esri's place-name overlay to layers that carry no names of their own.
 */
const basemaps: Record<Basemap, { href: (key: string) => string; maxZoom: number; className: string; labels: boolean }> = {
  imagery: { href: (key) => service + 'World_Imagery/MapServer/tile/' + key, maxZoom: 19, className: 'map-satellite', labels: true },
  /** Esri World Topographic Map, raster edition. NASA FIRMS also credits its Topographic background to Esri. */
  topo: { href: (key) => service + 'World_Topo_Map/MapServer/tile/' + key, maxZoom: 19, className: 'map-topo', labels: false },
}

export function SatelliteTiles({ basemap = 'imagery', viewport, pixels, projectX, projectY, onImageError }: {
  basemap?: Basemap
  viewport: { west: number; north: number; width: number; height: number }
  pixels: number
  projectX: (value: number) => number
  projectY: (value: number) => number
  onImageError: () => void
}) {
  const layer = basemaps[basemap]
  const zoom = Math.min(layer.maxZoom, Math.ceil(Math.log2(pixels / viewport.width / 256)))
  const tilesPerSide = 2 ** zoom
  /** Each tile overlaps the next by three quarters of a tile pixel, which hides the hairline renderers leave between images. */
  const overlap = 1 + 0.75 / 256
  const tiles = []

  for (let row = Math.floor(viewport.north * tilesPerSide); row < (viewport.north + viewport.height) * tilesPerSide; row++) {
    for (let column = Math.floor(viewport.west * tilesPerSide); column < (viewport.west + viewport.width) * tilesPerSide; column++) {
      tiles.push({
        key: `${zoom}/${row}/${column}`,
        x: projectX(column / tilesPerSide),
        y: projectY(row / tilesPerSide),
        width: (projectX((column + 1) / tilesPerSide) - projectX(column / tilesPerSide)) * overlap,
        height: (projectY((row + 1) / tilesPerSide) - projectY(row / tilesPerSide)) * overlap,
      })
    }
  }

  return (
    <g aria-hidden="true" pointerEvents="none">
      {tiles.map(({ key, ...frame }) => (
        <image key={basemap + '-' + key} {...frame} preserveAspectRatio="none" className={layer.className}
          href={layer.href(key)} onError={onImageError} />
      ))}
      {layer.labels && tiles.map(({ key, ...frame }) => (
        <image key={'labels-' + key} {...frame} preserveAspectRatio="none"
          href={service + 'Reference/World_Boundaries_and_Places/MapServer/tile/' + key} />
      ))}
    </g>
  )
}
