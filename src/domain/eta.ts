import type { BusCandidate, EtaResult, Stop } from '../types'

export function calculateEta(candidate: BusCandidate, destinationStopId: string, stops: Stop[]): EtaResult | undefined {
  const stop = stops.find((item) => item.id === destinationStopId)
  if (!stop) return undefined

  const tripStopIndex = candidate.trip.stopIds.indexOf(destinationStopId)
  const minutesUntilArrival = tripStopIndex >= 0 ? Math.max(3, (tripStopIndex + 1) * 4) : 12
  const estimatedArrival = new Date(Date.now() + minutesUntilArrival * 60_000)

  return {
    stop,
    estimatedArrival,
    minutesUntilArrival,
    source: 'mock',
  }
}
