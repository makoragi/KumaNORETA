import { mockCurrentPosition } from '../mocks/mockData'
import type { Coordinates } from '../types'

export type PositionSource = 'browser' | 'mock-fallback' | 'debug-preset'
export type LocationDebugMode = 'device' | 'sakuramachi-kumamoto' | 'kuhonji-kosaten' | 'jokoji-kosaten'

export type LocationDebugOption = {
  description: string
  id: LocationDebugMode
  label: string
}

const LOCATION_DEBUG_STORAGE_KEY = 'kumanoreta:locationDebugMode'

const LOCATION_DEBUG_PRESETS: Record<Exclude<LocationDebugMode, 'device'>, Omit<Coordinates, 'capturedAt'>> = {
  'sakuramachi-kumamoto': {
    latitude: 32.80125,
    longitude: 130.702679,
    accuracyMeters: 10,
  },
  'kuhonji-kosaten': {
    latitude: 32.799691,
    longitude: 130.717553,
    accuracyMeters: 10,
  },
  'jokoji-kosaten': {
    latitude: 32.812726,
    longitude: 130.715938,
    accuracyMeters: 10,
  },
}

export const locationDebugOptions: LocationDebugOption[] = [
  { id: 'device', label: 'GPSを使う', description: 'ブラウザの現在地を利用' },
  {
    id: 'sakuramachi-kumamoto',
    label: 'サクラマチクマモト付近',
    description: '32.801250, 130.702679',
  },
  {
    id: 'kuhonji-kosaten',
    label: '九品寺交差点付近',
    description: '32.799691, 130.717553',
  },
  {
    id: 'jokoji-kosaten',
    label: '浄行寺交差点付近',
    description: '32.812726, 130.715938',
  },
]

function isLocationDebugMode(value: string | null): value is LocationDebugMode {
  return locationDebugOptions.some((option) => option.id === value)
}

export function loadLocationDebugMode(): LocationDebugMode {
  try {
    const value = window.localStorage.getItem(LOCATION_DEBUG_STORAGE_KEY)
    return isLocationDebugMode(value) ? value : 'device'
  } catch {
    return 'device'
  }
}

export function persistLocationDebugMode(mode: LocationDebugMode): void {
  try {
    window.localStorage.setItem(LOCATION_DEBUG_STORAGE_KEY, mode)
  } catch {
    // Ignore storage failures and keep the in-memory selection.
  }
}

function getDebugPresetPosition(mode: LocationDebugMode): Coordinates | undefined {
  if (mode === 'device') return undefined

  const preset = LOCATION_DEBUG_PRESETS[mode]
  return {
    ...preset,
    capturedAt: new Date(),
  }
}

export async function getCurrentPosition(
  mode: LocationDebugMode = 'device',
): Promise<{ position: Coordinates; source: PositionSource }> {
  const debugPresetPosition = getDebugPresetPosition(mode)
  if (debugPresetPosition) return { position: debugPresetPosition, source: 'debug-preset' }

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
