import type { Coordinates, Route, Stop, Trip, VehiclePosition } from '../types'

export const mockCurrentPosition: Coordinates = {
  latitude: 32.8031,
  longitude: 130.7079,
  accuracyMeters: 18,
  capturedAt: new Date(),
}

export const mockStops: Stop[] = [
  { id: 'stop-kumamoto-station', name: '熊本駅前', latitude: 32.7897, longitude: 130.6899 },
  { id: 'stop-sakuramachi', name: '桜町バスターミナル', latitude: 32.8002, longitude: 130.7041 },
  { id: 'stop-torichosuji', name: '通町筋', latitude: 32.8031, longitude: 130.7113 },
  { id: 'stop-suizenji', name: '水前寺公園前', latitude: 32.7891, longitude: 130.7338 },
]

export const mockRoutes: Route[] = [
  { id: 'route-a', shortName: 'A1-1', longName: '熊本駅前 → 水前寺公園前', color: '#0f766e' },
]

export const mockTrips: Trip[] = [
  {
    id: 'trip-a-morning',
    routeId: 'route-a',
    headsign: '水前寺公園前 行き',
    stopIds: mockStops.map((stop) => stop.id),
  },
]

export const mockVehicles: VehiclePosition[] = [
  {
    vehicleId: 'vehicle-096',
    tripId: 'trip-a-morning',
    latitude: 32.8025,
    longitude: 130.7098,
    bearing: 92,
    timestamp: new Date(),
  },
]
