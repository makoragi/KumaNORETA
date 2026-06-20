export type Coordinates = {
  latitude: number
  longitude: number
  accuracyMeters: number
  capturedAt: Date
}

export type Stop = {
  id: string
  agencyId: string
  agencyName: string
  name: string
  latitude: number
  longitude: number
}

export type Route = {
  id: string
  agencyId: string
  agencyName: string
  shortName: string
  longName: string
  color: string
  parentRouteId?: string
}

export type Trip = {
  id: string
  agencyId: string
  routeId: string
  serviceId?: string
  headsign: string
  directionId?: string
  officeId?: string
  stopIds: string[]
  stopTimes?: TripStopTime[]
}

export type TripStopTime = {
  stopId: string
  stopSequence: number
  arrivalTime?: string
  departureTime?: string
}

export type GtfsFeedMetadata = {
  datasetId?: string
  agencyIds?: string[]
  publisherName: string
  publisherUrl?: string
  version: string
  startDate: string
  endDate: string
  sourceUrl: string
  fetchedAt: string
  routeCount: number
  stopCount: number
  tripCount: number
}

export type VehiclePosition = {
  vehicleId: string
  agencyId: string
  agencyName: string
  tripId: string
  latitude: number
  longitude: number
  bearing?: number
  timestamp: Date
}

export type StopTimeDelay = {
  stopId?: string
  stopSequence?: number
  arrivalDelaySeconds?: number
  departureDelaySeconds?: number
}

export type TripUpdate = {
  tripId: string
  agencyId: string
  agencyName: string
  vehicleId?: string
  delaySeconds?: number
  stopTimeDelays: StopTimeDelay[]
  timestamp: Date
}

export type BusCandidate = {
  trip: Trip
  route: Route
  vehicle: VehiclePosition
  distanceMeters: number
  score: number
  confidence: number
  reason: string
  isWithinMatchingRange: boolean
}

export type BusEstimationDiagnostics = {
  candidateCount: number
  matchedVehicles: number
  nearbyMatchedVehicles: number
  note?: string
  totalVehicles: number
  vehicleSource: 'gtfs-rt' | 'mock'
  positionSource: 'browser' | 'mock-fallback' | 'debug-preset'
  vehicleFetchedAt: Date
}

export type NearbyStop = {
  stop: Stop
  distanceMeters: number
}

export type EtaResult = {
  stop: Stop
  estimatedArrival: Date
  scheduledArrival?: Date
  minutesUntilArrival: number
  remainingDistanceMeters: number
  source: 'mock' | 'gtfs-rt' | 'distance-model'
}

export type TripProgress = {
  state: 'before-first-stop' | 'between-stops' | 'at-final-stop' | 'single-stop-trip'
  previousStop?: Stop
  nextStop?: Stop
  previousStopIndex: number
  nextStopIndex: number
  segmentProgress: number
  distanceFromPreviousStopMeters: number
  distanceToNextStopMeters: number
}
