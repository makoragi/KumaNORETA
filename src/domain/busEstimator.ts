import type { BusCandidate, Coordinates, Route, Trip, VehiclePosition } from '../types'

const toRadians = (degree: number) => (degree * Math.PI) / 180

function distanceMeters(a: Coordinates, b: Pick<VehiclePosition, 'latitude' | 'longitude'>): number {
  const earthRadiusMeters = 6_371_000
  const deltaLat = toRadians(b.latitude - a.latitude)
  const deltaLon = toRadians(b.longitude - a.longitude)
  const lat1 = toRadians(a.latitude)
  const lat2 = toRadians(b.latitude)
  const haversine =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine))
}

export function estimateCurrentBus(
  position: Coordinates,
  vehicles: VehiclePosition[],
  trips: Trip[],
  routes: Route[],
): BusCandidate | undefined {
  const candidates = vehicles
    .map((vehicle) => {
      const trip = trips.find((item) => item.id === vehicle.tripId)
      const route = trip ? routes.find((item) => item.id === trip.routeId) : undefined
      if (!trip || !route) return undefined

      const distance = distanceMeters(position, vehicle)
      const confidence = Math.max(0.1, Math.min(0.98, 1 - distance / 1_000))
      return {
        trip,
        route,
        vehicle,
        confidence,
        reason: `GPS位置と車両位置の距離が約${Math.round(distance)}mです`,
      }
    })
    .filter((candidate): candidate is BusCandidate => candidate !== undefined)

  return candidates.sort((a, b) => b.confidence - a.confidence)[0]
}
