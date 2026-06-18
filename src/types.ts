export type Coordinates = {
  latitude: number
  longitude: number
  accuracyMeters: number
  capturedAt: Date
}

export type Stop = {
  id: string
  name: string
  latitude: number
  longitude: number
}

export type Route = {
  id: string
  shortName: string
  longName: string
  color: string
}

export type Trip = {
  id: string
  routeId: string
  headsign: string
  stopIds: string[]
}

export type VehiclePosition = {
  vehicleId: string
  tripId: string
  latitude: number
  longitude: number
  bearing?: number
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
}

export type BusEstimationDiagnostics = {
  candidateCount: number
  matchedVehicles: number
  nearbyMatchedVehicles: number
  note?: string
  totalVehicles: number
  vehicleSource: 'gtfs-rt' | 'mock'
  positionSource: 'browser' | 'mock-fallback' | 'override'
}

export type EtaResult = {
  stop: Stop
  estimatedArrival: Date
  minutesUntilArrival: number
  source: 'mock' | 'gtfs-rt'
}
