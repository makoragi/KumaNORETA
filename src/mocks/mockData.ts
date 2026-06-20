import type { Coordinates, Route, Stop, Trip, TripUpdate, VehiclePosition } from '../types'

const mockAgencyId = 'mock'
const mockAgencyName = 'Mock Bus'

export const mockCurrentPosition: Coordinates = {
  latitude: 32.8031,
  longitude: 130.7079,
  accuracyMeters: 18,
  capturedAt: new Date(),
}

export const mockStops: Stop[] = [
  { id: 'stop-kumamoto-station', agencyId: mockAgencyId, agencyName: mockAgencyName, name: '熊本駅前', latitude: 32.7897, longitude: 130.6899 },
  { id: 'stop-sakuramachi', agencyId: mockAgencyId, agencyName: mockAgencyName, name: '桜町バスターミナル', latitude: 32.8002, longitude: 130.7041 },
  { id: 'stop-torichosuji', agencyId: mockAgencyId, agencyName: mockAgencyName, name: '通町筋', latitude: 32.8031, longitude: 130.7113 },
  { id: 'stop-suizenji', agencyId: mockAgencyId, agencyName: mockAgencyName, name: '水前寺公園前', latitude: 32.7891, longitude: 130.7338 },
]

export const mockRoutes: Route[] = [
  { id: 'route-a', agencyId: mockAgencyId, agencyName: mockAgencyName, shortName: 'A1-1', longName: '熊本駅前 → 水前寺公園前', color: '#0f766e' },
  { id: 'route-b', agencyId: mockAgencyId, agencyName: mockAgencyName, shortName: 'B2-3', longName: '桜町バスターミナル → 健軍町', color: '#ea580c' },
  { id: 'route-c', agencyId: mockAgencyId, agencyName: mockAgencyName, shortName: 'C4-2', longName: '熊本駅前 → 県庁前', color: '#2563eb' },
]

export const mockTrips: Trip[] = [
  {
    id: 'trip-a-morning',
    agencyId: mockAgencyId,
    routeId: 'route-a',
    headsign: '水前寺公園前 行き',
    stopIds: mockStops.map((stop) => stop.id),
    stopTimes: [
      { stopId: mockStops[0].id, stopSequence: 1, arrivalTime: '08:00:00', departureTime: '08:00:00' },
      { stopId: mockStops[1].id, stopSequence: 2, arrivalTime: '08:08:00', departureTime: '08:09:00' },
      { stopId: mockStops[2].id, stopSequence: 3, arrivalTime: '08:16:00', departureTime: '08:17:00' },
      { stopId: mockStops[3].id, stopSequence: 4, arrivalTime: '08:24:00', departureTime: '08:24:00' },
    ],
  },
  {
    id: 'trip-b-daytime',
    agencyId: mockAgencyId,
    routeId: 'route-b',
    headsign: '健軍町 行き',
    stopIds: [mockStops[1].id, mockStops[2].id, mockStops[3].id],
    stopTimes: [
      { stopId: mockStops[1].id, stopSequence: 1, arrivalTime: '12:10:00', departureTime: '12:10:00' },
      { stopId: mockStops[2].id, stopSequence: 2, arrivalTime: '12:18:00', departureTime: '12:19:00' },
      { stopId: mockStops[3].id, stopSequence: 3, arrivalTime: '12:27:00', departureTime: '12:27:00' },
    ],
  },
  {
    id: 'trip-c-daytime',
    agencyId: mockAgencyId,
    routeId: 'route-c',
    headsign: '県庁前 行き',
    stopIds: [mockStops[0].id, mockStops[1].id, mockStops[2].id],
    stopTimes: [
      { stopId: mockStops[0].id, stopSequence: 1, arrivalTime: '15:20:00', departureTime: '15:20:00' },
      { stopId: mockStops[1].id, stopSequence: 2, arrivalTime: '15:29:00', departureTime: '15:30:00' },
      { stopId: mockStops[2].id, stopSequence: 3, arrivalTime: '15:38:00', departureTime: '15:38:00' },
    ],
  },
]

export const mockVehicles: VehiclePosition[] = [
  {
    vehicleId: 'vehicle-096',
    agencyId: mockAgencyId,
    agencyName: mockAgencyName,
    tripId: 'trip-a-morning',
    latitude: 32.8025,
    longitude: 130.7098,
    bearing: 92,
    timestamp: new Date(),
  },
  {
    vehicleId: 'vehicle-104',
    agencyId: mockAgencyId,
    agencyName: mockAgencyName,
    tripId: 'trip-b-daytime',
    latitude: 32.8021,
    longitude: 130.7064,
    bearing: 75,
    timestamp: new Date(),
  },
  {
    vehicleId: 'vehicle-118',
    agencyId: mockAgencyId,
    agencyName: mockAgencyName,
    tripId: 'trip-c-daytime',
    latitude: 32.8046,
    longitude: 130.7129,
    bearing: 88,
    timestamp: new Date(),
  },
]

export const mockTripUpdates: TripUpdate[] = [
  {
    tripId: 'trip-a-morning',
    agencyId: mockAgencyId,
    agencyName: mockAgencyName,
    vehicleId: 'vehicle-096',
    delaySeconds: 240,
    stopTimeDelays: [],
    timestamp: new Date(),
  },
  {
    tripId: 'trip-b-daytime',
    agencyId: mockAgencyId,
    agencyName: mockAgencyName,
    vehicleId: 'vehicle-104',
    delaySeconds: 0,
    stopTimeDelays: [],
    timestamp: new Date(),
  },
  {
    tripId: 'trip-c-daytime',
    agencyId: mockAgencyId,
    agencyName: mockAgencyName,
    vehicleId: 'vehicle-118',
    delaySeconds: -120,
    stopTimeDelays: [],
    timestamp: new Date(),
  },
]
