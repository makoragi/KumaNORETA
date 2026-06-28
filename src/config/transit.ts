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

export type TransitOperatorTheme = {
  primary: string
  deep: string
  soft: string
  onPrimary: string
}

type ConfigOperatorId = (typeof transitOperatorsConfig.operators)[number]['id']
export type TransitOperatorId = ConfigOperatorId
export type TransitDatasetId = TransitOperatorId | 'all'

const config = transitOperatorsConfig as TransitOperatorsConfig

export const transitOperators = config.operators
export const defaultTransitDatasetId = config.defaultDatasetId
export const combinedStaticFile = config.combinedStaticFile

const transitOperatorThemes: Record<TransitOperatorId, TransitOperatorTheme> = {
  kumabus: {
    primary: '#c6362d',
    deep: '#92231d',
    soft: '#f7d9d5',
    onPrimary: '#fff8f4',
  },
  sankobus: {
    primary: '#1f5fbf',
    deep: '#17468c',
    soft: '#dce8fb',
    onPrimary: '#f7fbff',
  },
  dentetsu: {
    primary: '#f2c230',
    deep: '#a87700',
    soft: '#fff0b8',
    onPrimary: '#3a2a00',
  },
  toshibus: {
    primary: '#2f8f4e',
    deep: '#21683a',
    soft: '#dbf0e0',
    onPrimary: '#f5fff8',
  },
}

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

export function getTransitOperatorTheme(operatorId: TransitOperatorId): TransitOperatorTheme {
  return transitOperatorThemes[operatorId]
}

export function getStaticGtfsFile(datasetId: TransitDatasetId): string {
  if (datasetId === 'all') {
    return combinedStaticFile
  }

  return getTransitOperator(datasetId).staticFile
}
