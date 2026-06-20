import transitOperatorsConfig from '../../config/transit-operators.json'

type TransitOperatorsConfig = {
  operators: TransitOperator[]
  combinedStaticFile: string
  defaultDatasetId: TransitOperatorId
}

export type TransitOperator = {
  id: string
  agencyName: string
  gtfsFeedUrl: string
  tripUpdatesUrl: string
  vehiclePositionsUrl: string
  alertsUrl: string
  staticFile: string
}

type ConfigOperatorId = (typeof transitOperatorsConfig.operators)[number]['id']
export type TransitOperatorId = ConfigOperatorId
export type TransitDatasetId = TransitOperatorId | 'all'

const config = transitOperatorsConfig as TransitOperatorsConfig

export const transitOperators = config.operators
export const defaultTransitDatasetId = config.defaultDatasetId
export const combinedStaticFile = config.combinedStaticFile

export function isTransitOperatorId(value: string): value is TransitOperatorId {
  return transitOperators.some((operator) => operator.id === value)
}

export function normalizeTransitDatasetId(value: string | undefined): TransitDatasetId {
  if (!value) return defaultTransitDatasetId
  if (value === 'all') return value
  if (isTransitOperatorId(value)) return value
  return defaultTransitDatasetId
}

export function getTransitDatasetOperators(datasetId: TransitDatasetId): TransitOperator[] {
  if (datasetId === 'all') {
    return transitOperators
  }

  return transitOperators.filter((operator) => operator.id === datasetId)
}

export function getTransitOperator(operatorId: TransitOperatorId): TransitOperator {
  const operator = transitOperators.find((item) => item.id === operatorId)
  if (!operator) {
    throw new Error(`Unknown transit operator: ${operatorId}`)
  }

  return operator
}

export function getStaticGtfsFile(datasetId: TransitDatasetId): string {
  if (datasetId === 'all') {
    return combinedStaticFile
  }

  return getTransitOperator(datasetId).staticFile
}
