import { mockVehicles } from '../mocks/mockData'
import type { VehiclePosition } from '../types'

export async function fetchVehiclePositions(): Promise<VehiclePosition[]> {
  // TODO: 熊本県内のGTFS-Realtime VehiclePositionsを取得してprotobufを解釈する。
  return mockVehicles
}
