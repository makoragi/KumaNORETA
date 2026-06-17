import { mockCurrentPosition } from '../mocks/mockData'
import type { Coordinates } from '../types'

export async function getCurrentPosition(): Promise<Coordinates> {
  if (!('geolocation' in navigator)) {
    return mockCurrentPosition
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
          capturedAt: new Date(position.timestamp),
        })
      },
      () => resolve(mockCurrentPosition),
      { enableHighAccuracy: true, timeout: 5_000, maximumAge: 10_000 },
    )
  })
}
