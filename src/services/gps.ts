import { mockCurrentPosition } from '../mocks/mockData'
import type { Coordinates } from '../types'

export type PositionSource = 'browser' | 'mock-fallback' | 'override'

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function getOverridePosition(): Coordinates | undefined {
  if (import.meta.env.VITE_GPS_OVERRIDE_ENABLED !== 'true') return undefined

  const latitude = parseNumber(import.meta.env.VITE_GPS_OVERRIDE_LATITUDE)
  const longitude = parseNumber(import.meta.env.VITE_GPS_OVERRIDE_LONGITUDE)
  const accuracyMeters = parseNumber(import.meta.env.VITE_GPS_OVERRIDE_ACCURACY_METERS) ?? 10

  if (latitude === undefined || longitude === undefined) {
    console.warn('GPS override is enabled but latitude/longitude is missing.')
    return undefined
  }

  return {
    latitude,
    longitude,
    accuracyMeters,
    capturedAt: new Date(),
  }
}

export async function getCurrentPosition(): Promise<{ position: Coordinates; source: PositionSource }> {
  const overridePosition = getOverridePosition()
  if (overridePosition) return { position: overridePosition, source: 'override' }

  if (!('geolocation' in navigator)) {
    return { position: mockCurrentPosition, source: 'mock-fallback' }
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          position: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
            capturedAt: new Date(position.timestamp),
          },
          source: 'browser',
        })
      },
      () => resolve({ position: mockCurrentPosition, source: 'mock-fallback' }),
      { enableHighAccuracy: true, timeout: 5_000, maximumAge: 10_000 },
    )
  })
}
