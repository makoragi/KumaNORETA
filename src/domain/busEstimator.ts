import type { BusCandidate, Coordinates, NearbyStop, Route, Stop, Trip, VehiclePosition } from '../types'

const BASE_MATCHING_RANGE_METERS = 2_000
const MAX_CANDIDATES = 3
const MAX_NEARBY_STOPS = 3
const SEGMENT_ALIGNMENT_RANGE_METERS = 250
const STOP_ALIGNMENT_RANGE_METERS = 120

type Point = { x: number; y: number }

type VehicleStopContext =
  | {
      kind: 'segment'
      previousStop: Stop
      nextStop: Stop
      previousStopIndex: number
      nextStopIndex: number
      distanceMeters: number
      progress: number
    }
  | {
      kind: 'stop'
      stop: Stop
      stopIndex: number
      distanceMeters: number
    }

const toRadians = (degree: number) => (degree * Math.PI) / 180

function toPoint(latitude: number, longitude: number, originLatitude: number): Point {
  const metersPerLat = 111_320
  const metersPerLon = 111_320 * Math.cos((originLatitude * Math.PI) / 180)

  return {
    x: longitude * metersPerLon,
    y: latitude * metersPerLat,
  }
}

function projectPointOntoSegment(point: Point, start: Point, end: Point) {
  const segmentX = end.x - start.x
  const segmentY = end.y - start.y
  const segmentLengthSquared = segmentX ** 2 + segmentY ** 2

  if (segmentLengthSquared === 0) {
    return {
      distance: Math.hypot(point.x - start.x, point.y - start.y),
      progress: 0,
    }
  }

  const rawProgress =
    ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) / segmentLengthSquared
  const progress = Math.min(1, Math.max(0, rawProgress))
  const projectedX = start.x + segmentX * progress
  const projectedY = start.y + segmentY * progress

  return {
    distance: Math.hypot(point.x - projectedX, point.y - projectedY),
    progress,
  }
}

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

function indexTripStops(trip: Trip, stops: Stop[]) {
  const stopsById = new Map(stops.map((stop) => [stop.id, stop]))

  return trip.stopIds
    .map((stopId, index) => ({
      stop: stopsById.get(stopId),
      index,
    }))
    .filter((entry): entry is { stop: Stop; index: number } => entry.stop !== undefined)
}

function findTripStopIndex(trip: Trip, stopId?: string, stopSequence?: number) {
  if (stopId) {
    const stopIdIndex = trip.stopIds.indexOf(stopId)
    if (stopIdIndex >= 0) return stopIdIndex
  }

  if (stopSequence !== undefined) {
    const sequenceIndex = trip.stopTimes?.findIndex((stopTime) => stopTime.stopSequence === stopSequence) ?? -1
    if (sequenceIndex >= 0) return sequenceIndex

    const fallbackIndex = stopSequence - 1
    if (fallbackIndex >= 0 && fallbackIndex < trip.stopIds.length) {
      return fallbackIndex
    }
  }

  return -1
}

function resolveVehicleStopContext(
  position: Coordinates,
  vehicle: VehiclePosition,
  trip: Trip,
  stops: Stop[],
): VehicleStopContext | undefined {
  const stopIndex = findTripStopIndex(trip, vehicle.currentStopId, vehicle.currentStopSequence)
  if (stopIndex < 0) return undefined

  const tripStops = indexTripStops(trip, stops)
  const currentEntry = tripStops.find((entry) => entry.index === stopIndex)
  if (!currentEntry) return undefined

  const status = vehicle.currentStatus ?? 'in-transit-to'
  if (status === 'stopped-at' || status === 'incoming-at') {
    return {
      kind: 'stop',
      stop: currentEntry.stop,
      stopIndex,
      distanceMeters: distanceMeters(position, currentEntry.stop),
    }
  }

  const previousEntry = tripStops.find((entry) => entry.index === stopIndex - 1)
  if (!previousEntry) {
    return {
      kind: 'stop',
      stop: currentEntry.stop,
      stopIndex,
      distanceMeters: distanceMeters(position, currentEntry.stop),
    }
  }

  const referenceLatitude = position.latitude
  const riderPoint = toPoint(position.latitude, position.longitude, referenceLatitude)
  const previousPoint = toPoint(previousEntry.stop.latitude, previousEntry.stop.longitude, referenceLatitude)
  const nextPoint = toPoint(currentEntry.stop.latitude, currentEntry.stop.longitude, referenceLatitude)
  const projection = projectPointOntoSegment(riderPoint, previousPoint, nextPoint)

  return {
    kind: 'segment',
    previousStop: previousEntry.stop,
    nextStop: currentEntry.stop,
    previousStopIndex: previousEntry.index,
    nextStopIndex: currentEntry.index,
    distanceMeters: projection.distance,
    progress: projection.progress,
  }
}

function buildSegmentReason(context: VehicleStopContext | undefined) {
  if (!context) return 'GTFS-RT の停留所進捗は未使用'

  if (context.kind === 'stop') {
    return `GTFS-RT 上は「${context.stop.name}」付近`
  }

  return `GTFS-RT 上は「${context.previousStop.name} → ${context.nextStop.name}」の区間`
}

function calculateCandidateScore(
  distance: number,
  accuracyMeters: number,
  timestamp: Date,
  stopContext?: VehicleStopContext,
): number {
  const matchingRange = BASE_MATCHING_RANGE_METERS + accuracyMeters
  const distanceScore = clamp(1 - distance / matchingRange, 0, 1)
  const accuracyPenalty = clamp(accuracyMeters / 200, 0, 0.25)
  const vehicleAgeSeconds = Math.max(0, (Date.now() - timestamp.getTime()) / 1_000)
  const freshnessScore = clamp(1 - vehicleAgeSeconds / 180, 0.2, 1)
  const segmentAlignmentScore = stopContext
    ? stopContext.kind === 'segment'
      ? clamp(1 - stopContext.distanceMeters / (SEGMENT_ALIGNMENT_RANGE_METERS + accuracyMeters), 0, 1)
      : clamp(1 - stopContext.distanceMeters / (STOP_ALIGNMENT_RANGE_METERS + accuracyMeters), 0, 1)
    : 0.5

  return clamp(
    distanceScore * 0.55 + segmentAlignmentScore * 0.3 + freshnessScore * 0.15 - accuracyPenalty,
    0.1,
    0.99,
  )
}

function buildBusCandidates(
  position: Coordinates,
  vehicles: VehiclePosition[],
  trips: Trip[],
  routes: Route[],
  stops: Stop[],
): BusCandidate[] {
  const tripsById = new Map(trips.map((trip) => [trip.id, trip]))
  const routesById = new Map(routes.map((route) => [route.id, route]))

  return vehicles
    .map((vehicle) => {
      const trip = tripsById.get(vehicle.tripId)
      const route = trip ? routesById.get(trip.routeId) : undefined
      if (!trip || !route) return undefined

      const distance = distanceMeters(position, vehicle)
      const stopContext = resolveVehicleStopContext(position, vehicle, trip, stops)
      const score = calculateCandidateScore(distance, position.accuracyMeters, vehicle.timestamp, stopContext)
      const matchingRange = BASE_MATCHING_RANGE_METERS + position.accuracyMeters
      const isWithinMatchingRange = distance <= matchingRange
      const segmentReason = buildSegmentReason(stopContext)

      return {
        trip,
        route,
        vehicle,
        distanceMeters: distance,
        score,
        confidence: score,
        isWithinMatchingRange,
        reason: isWithinMatchingRange
          ? `現在地から約${Math.round(distance)}m。${segmentReason}`
          : `現在地から約${Math.round(distance)}mで候補範囲外。${segmentReason}`,
      }
    })
    .filter((candidate): candidate is BusCandidate => candidate !== undefined)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (a.distanceMeters !== b.distanceMeters) return a.distanceMeters - b.distanceMeters
      return b.vehicle.timestamp.getTime() - a.vehicle.timestamp.getTime()
    })
}

export function rankBusCandidates(
  position: Coordinates,
  vehicles: VehiclePosition[],
  trips: Trip[],
  routes: Route[],
  stops: Stop[],
): BusCandidate[] {
  return buildBusCandidates(position, vehicles, trips, routes, stops).slice(0, MAX_CANDIDATES)
}

export function findBusCandidateByTripId(
  tripId: string,
  position: Coordinates,
  vehicles: VehiclePosition[],
  trips: Trip[],
  routes: Route[],
  stops: Stop[],
): BusCandidate | undefined {
  return buildBusCandidates(position, vehicles, trips, routes, stops).find((candidate) => candidate.trip.id === tripId)
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
  stops: Stop[],
): BusCandidate | undefined {
  return rankBusCandidates(position, vehicles, trips, routes, stops)[0]
}
