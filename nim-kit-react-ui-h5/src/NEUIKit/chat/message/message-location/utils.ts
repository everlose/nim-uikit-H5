export interface LocationDisplayData {
  latitude: number | null
  longitude: number | null
  title: string
  address: string
}

const toCoordinate = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string' || !value.trim()) return null
  const coordinate = Number(value.trim())
  return Number.isFinite(coordinate) ? coordinate : null
}

const readCoordinate = (primary: unknown, fallback: unknown, min: number, max: number) => {
  for (const value of [primary, fallback]) {
    const coordinate = toCoordinate(value)
    if (coordinate !== null && coordinate >= min && coordinate <= max) return coordinate
  }
  return null
}

export const normalizeLocationMessage = (messageText: unknown, attachment: unknown): LocationDisplayData => {
  const data = (attachment || {}) as Record<string, unknown>
  const latitude = readCoordinate(data.lat, data.latitude, -90, 90)
  const longitude = readCoordinate(data.lng, data.longitude, -180, 180)
  const title = typeof messageText === 'string' ? messageText : ''
  const address = typeof data.address === 'string' ? data.address : ''

  return {
    latitude,
    longitude,
    title,
    address,
  }
}
