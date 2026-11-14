const radians = Math.PI / 180

export const worldX = (lon: number) => (lon + 180) / 360
export const worldY = (lat: number) => (1 - Math.asinh(Math.tan(lat * radians)) / Math.PI) / 2
export const longitude = (x: number) => x * 360 - 180
export const latitude = (y: number) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) / radians

const service = 'https://server.arcgisonline.com/ArcGIS/rest/services/'

export function SatelliteTiles({ viewport, pixels, projectX, projectY, onImageError }: {
  viewport: { west: number; north: number; width: number; height: number }
  pixels: number
  projectX: (value: number) => number
  projectY: (value: number) => number
  onImageError: () => void
}) {
  const zoom = Math.ceil(Math.log2(pixels / viewport.width / 256))
  const tilesPerSide = 2 ** zoom
  const tiles = []

  for (let row = Math.floor(viewport.north * tilesPerSide); row < (viewport.north + viewport.height) * tilesPerSide; row++) {
    for (let column = Math.floor(viewport.west * tilesPerSide); column < (viewport.west + viewport.width) * tilesPerSide; column++) {
      tiles.push({
        key: `${zoom}/${row}/${column}`,
        x: projectX(column / tilesPerSide),
        y: projectY(row / tilesPerSide),
        width: projectX((column + 1) / tilesPerSide) - projectX(column / tilesPerSide),
        height: projectY((row + 1) / tilesPerSide) - projectY(row / tilesPerSide),
      })
    }
  }

  return (
    <g aria-hidden="true" pointerEvents="none">
      {tiles.map(({ key, ...frame }) => (
        <image key={key} {...frame} preserveAspectRatio="none" className="map-satellite"
          href={service + 'World_Imagery/MapServer/tile/' + key} onError={onImageError} />
      ))}
      {tiles.map(({ key, ...frame }) => (
        <image key={'labels-' + key} {...frame} preserveAspectRatio="none"
          href={service + 'Reference/World_Boundaries_and_Places/MapServer/tile/' + key} />
      ))}
    </g>
  )
}
