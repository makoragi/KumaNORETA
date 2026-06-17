import { mockRoutes, mockStops, mockTrips } from '../mocks/mockData'
import type { Route, Stop, Trip } from '../types'

export type StaticGtfsData = {
  routes: Route[]
  stops: Stop[]
  trips: Trip[]
}

export async function loadStaticGtfsData(): Promise<StaticGtfsData> {
  // TODO: data/gtfs-jp 配下に配置したGTFS-JPのCSVを読み込み、正規化する。
  return {
    routes: mockRoutes,
    stops: mockStops,
    trips: mockTrips,
  }
}
