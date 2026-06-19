import type { BusCandidate, Coordinates, NearbyStop, Route, Stop, Trip, VehiclePosition } from '../types'

const BASE_MATCHING_RANGE_METERS = 2_000
const MAX_CANDIDATES = 3
const MAX_NEARBY_STOPS = 3

const toRadians = (degree: number) => (degree * Math.PI) / 180

export function distanceMeters(
  a: Pick<Coordinates, 'latitude' | 'longitude'>,
  b: Pick<VehiclePosition, 'latitude' | 'longitude'>,
): number {
  const earthRadiusMeters = 6_371_000
  const deltaLat = toRadians(b.latitude - a.latitude)
  const deltaLon = toRadians(b.longitude - a.longitude)
  const lat1 = toRadians(a.latitude)
  const lat2 = toRadians(b.latitude)
  const haversine =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2

  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine))
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function calculateCandidateScore(distance: number, accuracyMeters: number, timestamp: Date): number {
  const matchingRange = BASE_MATCHING_RANGE_METERS + accuracyMeters
  const distanceScore = clamp(1 - distance / matchingRange, 0, 1)
  const accuracyPenalty = clamp(accuracyMeters / 200, 0, 0.25)
  const vehicleAgeSeconds = Math.max(0, (Date.now() - timestamp.getTime()) / 1_000)
  const freshnessScore = clamp(1 - vehicleAgeSeconds / 180, 0.2, 1)

  return clamp(distanceScore * 0.8 + freshnessScore * 0.2 - accuracyPenalty, 0.1, 0.99)
}

export function rankBusCandidates(
  position: Coordinates,
  vehicles: VehiclePosition[],
  trips: Trip[],
  routes: Route[],
): BusCandidate[] {
  const tripsById = new Map(trips.map((trip) => [trip.id, trip]))
  const routesById = new Map(routes.map((route) => [route.id, route]))

  return vehicles
    .map((vehicle) => {
      const trip = tripsById.get(vehicle.tripId)
      const route = trip ? routesById.get(trip.routeId) : undefined
      if (!trip || !route) return undefined

      const distance = distanceMeters(position, vehicle)
      const score = calculateCandidateScore(distance, position.accuracyMeters, vehicle.timestamp)
      const matchingRange = BASE_MATCHING_RANGE_METERS + position.accuracyMeters
      const isWithinMatchingRange = distance <= matchingRange

      return {
        trip,
        route,
        vehicle,
        distanceMeters: distance,
        score,
        confidence: score,
        isWithinMatchingRange,
        reason: isWithinMatchingRange
          ? `現在地の推定範囲である約${Math.round(matchingRange)}m以内にいます`
          : '推定範囲外ですが、取得できた車両の中では現在地に近い候補です',
      }
    })
    .filter((candidate): candidate is BusCandidate => candidate !== undefined)
    .sort((a, b) => {
      if (a.distanceMeters !== b.distanceMeters) return a.distanceMeters - b.distanceMeters
      if (b.score !== a.score) return b.score - a.score
      return b.vehicle.timestamp.getTime() - a.vehicle.timestamp.getTime()
    })
    .slice(0, MAX_CANDIDATES)
}

export function collectBusEstimationDiagnostics(
  position: Coordinates,
  vehicles: VehiclePosition[],
  trips: Trip[],
  routes: Route[],
): Pick<import('../types').BusEstimationDiagnostics, 'candidateCount' | 'matchedVehicles' | 'nearbyMatchedVehicles' | 'totalVehicles'> {
  const tripsById = new Map(trips.map((trip) => [trip.id, trip]))
  const routesById = new Map(routes.map((route) => [route.id, route]))

  let matchedVehicles = 0
  let nearbyMatchedVehicles = 0

  for (const vehicle of vehicles) {
    const trip = tripsById.get(vehicle.tripId)
    const route = trip ? routesById.get(trip.routeId) : undefined
    if (!trip || !route) continue

    matchedVehicles += 1

    if (distanceMeters(position, vehicle) <= BASE_MATCHING_RANGE_METERS + position.accuracyMeters) {
      nearbyMatchedVehicles += 1
    }
  }

  return {
    totalVehicles: vehicles.length,
    matchedVehicles,
    nearbyMatchedVehicles,
    candidateCount: Math.min(nearbyMatchedVehicles, MAX_CANDIDATES),
  }
}

export function findNearbyStops(position: Coordinates, stops: Stop[]): NearbyStop[] {
  return stops
    .map((stop) => ({ stop, distanceMeters: distanceMeters(position, stop) }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, MAX_NEARBY_STOPS)
}

export function estimateCurrentBus(
  position: Coordinates,
  vehicles: VehiclePosition[],
  trips: Trip[],
  routes: Route[],
): BusCandidate | undefined {
  return rankBusCandidates(position, vehicles, trips, routes)[0]
}
