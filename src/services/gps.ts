import { mockCurrentPosition } from '../mocks/mockData'
import type { Coordinates } from '../types'

export type PositionSource = 'browser' | 'last-known' | 'mock-fallback' | 'debug-preset'
export type LocationDebugMode = 'device' | 'sakuramachi-kumamoto' | 'kuhonji-kosaten' | 'jokoji-kosaten'

export type LocationDebugOption = {
  description: string
  id: LocationDebugMode
  label: string
}

const LOCATION_DEBUG_STORAGE_KEY = 'kumanoreta:locationDebugMode'
const LAST_KNOWN_POSITION_STORAGE_KEY = 'kumanoreta:lastKnownPosition'
const LAST_KNOWN_POSITION_MAX_AGE_MS = 1000 * 60 * 30
const ACCEPTABLE_ACCURACY_METERS = 150
const GEOLOCATION_WATCH_TIMEOUT_MS = 15_000
const GEOLOCATION_STABLE_WAIT_MS = 2_500

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

type StoredPosition = {
  accuracyMeters: number
  capturedAt: string
  latitude: number
  longitude: number
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function loadLastKnownPosition(): Coordinates | undefined {
  try {
    const raw = window.localStorage.getItem(LAST_KNOWN_POSITION_STORAGE_KEY)
    if (!raw) return undefined

    const parsed = JSON.parse(raw) as Partial<StoredPosition>
    if (
      !isFiniteNumber(parsed.latitude) ||
      !isFiniteNumber(parsed.longitude) ||
      !isFiniteNumber(parsed.accuracyMeters) ||
      typeof parsed.capturedAt !== 'string'
    ) {
      return undefined
    }

    const capturedAt = new Date(parsed.capturedAt)
    if (Number.isNaN(capturedAt.getTime())) return undefined
    if (Date.now() - capturedAt.getTime() > LAST_KNOWN_POSITION_MAX_AGE_MS) return undefined

    return {
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      accuracyMeters: parsed.accuracyMeters,
      capturedAt,
    }
  } catch {
    return undefined
  }
}

function persistLastKnownPosition(position: Coordinates): void {
  try {
    const payload: StoredPosition = {
      latitude: position.latitude,
      longitude: position.longitude,
      accuracyMeters: position.accuracyMeters,
      capturedAt: position.capturedAt.toISOString(),
    }
    window.localStorage.setItem(LAST_KNOWN_POSITION_STORAGE_KEY, JSON.stringify(payload))
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

function toCoordinates(position: GeolocationPosition): Coordinates {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracyMeters: position.coords.accuracy,
    capturedAt: new Date(position.timestamp),
  }
}

function chooseBetterPosition(currentBest: Coordinates | undefined, candidate: Coordinates): Coordinates {
  if (!currentBest) return candidate

  if (candidate.accuracyMeters < currentBest.accuracyMeters) return candidate
  if (candidate.accuracyMeters === currentBest.accuracyMeters && candidate.capturedAt > currentBest.capturedAt) {
    return candidate
  }

  return currentBest
}

async function resolveBrowserPosition(): Promise<Coordinates | undefined> {
  return new Promise((resolve) => {
    let bestPosition: Coordinates | undefined
    let resolved = false
    let stableTimer: number | undefined

    const finalize = () => {
      if (resolved) return
      resolved = true
      if (stableTimer !== undefined) {
        window.clearTimeout(stableTimer)
      }
      navigator.geolocation.clearWatch(watchId)
      resolve(bestPosition)
    }

    const scheduleFinalize = () => {
      if (stableTimer !== undefined) {
        window.clearTimeout(stableTimer)
      }
      stableTimer = window.setTimeout(finalize, GEOLOCATION_STABLE_WAIT_MS)
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        bestPosition = chooseBetterPosition(bestPosition, toCoordinates(position))
        if (bestPosition.accuracyMeters <= ACCEPTABLE_ACCURACY_METERS) {
          finalize()
          return
        }
        scheduleFinalize()
      },
      () => {
        finalize()
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: GEOLOCATION_WATCH_TIMEOUT_MS,
      },
    )

    window.setTimeout(finalize, GEOLOCATION_WATCH_TIMEOUT_MS)
  })
}

export async function getCurrentPosition(
  mode: LocationDebugMode = 'device',
): Promise<{ position: Coordinates; source: PositionSource }> {
  const debugPresetPosition = getDebugPresetPosition(mode)
  if (debugPresetPosition) return { position: debugPresetPosition, source: 'debug-preset' }

  if (!('geolocation' in navigator)) {
    const lastKnownPosition = loadLastKnownPosition()
    if (lastKnownPosition) return { position: lastKnownPosition, source: 'last-known' }
    return { position: mockCurrentPosition, source: 'mock-fallback' }
  }

  const browserPosition = await resolveBrowserPosition()
  if (browserPosition) {
    persistLastKnownPosition(browserPosition)
    return { position: browserPosition, source: 'browser' }
  }

  const lastKnownPosition = loadLastKnownPosition()
  if (lastKnownPosition) return { position: lastKnownPosition, source: 'last-known' }

  return { position: mockCurrentPosition, source: 'mock-fallback' }
}
