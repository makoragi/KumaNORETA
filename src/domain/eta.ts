import { distanceMeters } from './busEstimator'
import type { BusCandidate, EtaResult, Stop, TripProgress, TripStopTime } from '../types'

const BUS_SPEED_METERS_PER_MINUTE = 250
const DWELL_MINUTES_PER_STOP = 0.75

type Point = { x: number; y: number }

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

function resolveTripStops(candidate: BusCandidate, stops: Stop[]): Stop[] {
  const stopsById = new Map(stops.map((stop) => [stop.id, stop]))

  return candidate.trip.stopIds
    .map((stopId) => stopsById.get(stopId))
    .filter((stop): stop is Stop => stop !== undefined)
}

function resolveScheduledStopTime(candidate: BusCandidate, stopId: string): TripStopTime | undefined {
  return candidate.trip.stopTimes?.find((stopTime) => stopTime.stopId === stopId)
}

function parseGtfsTimeToDate(time: string, referenceDate: Date): Date | undefined {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(time)
  if (!match) return undefined

  const hours = Number.parseInt(match[1], 10)
  const minutes = Number.parseInt(match[2], 10)
  const seconds = Number.parseInt(match[3] ?? '0', 10)
  if ([hours, minutes, seconds].some((value) => Number.isNaN(value))) return undefined

  const scheduled = new Date(referenceDate)
  scheduled.setHours(0, 0, 0, 0)
  scheduled.setTime(scheduled.getTime() + ((hours * 60 + minutes) * 60 + seconds) * 1_000)

  const halfDayMs = 12 * 60 * 60 * 1_000
  if (scheduled.getTime() - referenceDate.getTime() > halfDayMs) {
    scheduled.setDate(scheduled.getDate() - 1)
  } else if (referenceDate.getTime() - scheduled.getTime() > halfDayMs) {
    scheduled.setDate(scheduled.getDate() + 1)
  }

  return scheduled
}

export function estimateTripProgress(candidate: BusCandidate, stops: Stop[]): TripProgress | undefined {
  const tripStops = resolveTripStops(candidate, stops)
  if (tripStops.length === 0) return undefined

  if (tripStops.length === 1) {
    return {
      state: 'single-stop-trip',
      previousStop: tripStops[0],
      nextStop: tripStops[0],
      previousStopIndex: 0,
      nextStopIndex: 0,
      segmentProgress: 1,
      distanceFromPreviousStopMeters: 0,
      distanceToNextStopMeters: 0,
    }
  }

  const referenceLatitude = candidate.vehicle.latitude
  const vehiclePoint = toPoint(candidate.vehicle.latitude, candidate.vehicle.longitude, referenceLatitude)

  let bestSegment:
    | {
        index: number
        distance: number
        progress: number
        segmentLengthMeters: number
      }
    | undefined

  for (let index = 0; index < tripStops.length - 1; index += 1) {
    const previousStop = tripStops[index]
    const nextStop = tripStops[index + 1]
    const previousPoint = toPoint(previousStop.latitude, previousStop.longitude, referenceLatitude)
    const nextPoint = toPoint(nextStop.latitude, nextStop.longitude, referenceLatitude)
    const projection = projectPointOntoSegment(vehiclePoint, previousPoint, nextPoint)
    const segmentLengthMeters = distanceMeters(previousStop, nextStop)

    if (!bestSegment || projection.distance < bestSegment.distance) {
      bestSegment = {
        index,
        distance: projection.distance,
        progress: projection.progress,
        segmentLengthMeters,
      }
    }
  }

  if (!bestSegment) return undefined

  const previousStop = tripStops[bestSegment.index]
  const nextStop = tripStops[bestSegment.index + 1]
  const distanceFromPreviousStopMeters = bestSegment.segmentLengthMeters * bestSegment.progress
  const distanceToNextStopMeters = bestSegment.segmentLengthMeters - distanceFromPreviousStopMeters
  const isAtFinalStop =
    bestSegment.index === tripStops.length - 2 &&
    bestSegment.progress >= 0.97 &&
    distanceMeters(candidate.vehicle, nextStop) <= 80

  return {
    state: isAtFinalStop ? 'at-final-stop' : 'between-stops',
    previousStop,
    nextStop,
    previousStopIndex: bestSegment.index,
    nextStopIndex: bestSegment.index + 1,
    segmentProgress: bestSegment.progress,
    distanceFromPreviousStopMeters,
    distanceToNextStopMeters,
  }
}

export function calculateEta(
  candidate: BusCandidate,
  destinationStopId: string,
  stops: Stop[],
  tripProgress?: TripProgress,
): EtaResult | undefined {
  const stop = stops.find((item) => item.id === destinationStopId)
  const destinationStopIndex = candidate.trip.stopIds.indexOf(destinationStopId)
  if (!stop || destinationStopIndex < 0) return undefined

  const progress = tripProgress ?? estimateTripProgress(candidate, stops)
  if (!progress) return undefined

  const tripStops = resolveTripStops(candidate, stops)
  const currentIndex = progress.state === 'at-final-stop' ? progress.previousStopIndex : progress.nextStopIndex
  if (destinationStopIndex < currentIndex) return undefined

  let remainingDistanceMeters = progress.state === 'at-final-stop' ? 0 : progress.distanceToNextStopMeters

  for (let index = currentIndex; index < destinationStopIndex; index += 1) {
    const currentStop = tripStops[index]
    const nextStop = tripStops[index + 1]
    if (!currentStop || !nextStop) return undefined
    remainingDistanceMeters += distanceMeters(currentStop, nextStop)
  }

  const remainingStops = Math.max(0, destinationStopIndex - currentIndex)
  const minutesUntilArrival = Math.max(
    1,
    Math.ceil(remainingDistanceMeters / BUS_SPEED_METERS_PER_MINUTE + remainingStops * DWELL_MINUTES_PER_STOP),
  )
  const scheduledStopTime = resolveScheduledStopTime(candidate, destinationStopId)
  const scheduledArrival = scheduledStopTime?.arrivalTime
    ? parseGtfsTimeToDate(scheduledStopTime.arrivalTime, candidate.vehicle.timestamp)
    : undefined

  const etaReferenceTime = candidate.vehicle.timestamp

  return {
    stop,
    estimatedArrival: new Date(etaReferenceTime.getTime() + minutesUntilArrival * 60_000),
    scheduledArrival,
    minutesUntilArrival,
    remainingDistanceMeters,
    source: 'distance-model',
  }
}
