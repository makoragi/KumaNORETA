param(
  [string]$DatasetId
)

$ErrorActionPreference = "Stop"

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$downloadDir = Join-Path $workspaceRoot "data\gtfs-jp\_download"
$dataRootDir = Join-Path $workspaceRoot "data\gtfs-jp"
$publicDir = Join-Path $workspaceRoot "public\gtfs"
$configPath = Join-Path $workspaceRoot "config\transit-operators.json"
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json

if ([string]::IsNullOrWhiteSpace($DatasetId)) {
  $DatasetId = [string]$config.defaultDatasetId
}

function Ensure-Directory([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

function Remove-DirectoryContents([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  $resolvedPath = (Resolve-Path -LiteralPath $Path).Path
  if (-not $resolvedPath.StartsWith($workspaceRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove path outside workspace: $resolvedPath"
  }

  Get-ChildItem -LiteralPath $resolvedPath -Force | Remove-Item -Recurse -Force
}

function Get-RouteColor([string]$Key) {
  $hash = 0
  foreach ($character in $Key.ToCharArray()) {
    $hash = (($hash * 31) + [int][char]$character) % 360
  }

  $hue = [double]$hash
  $saturation = 0.68
  $lightness = 0.46
  $chroma = (1 - [Math]::Abs((2 * $lightness) - 1)) * $saturation
  $segment = $hue / 60
  $x = $chroma * (1 - [Math]::Abs(($segment % 2) - 1))

  $red = 0.0
  $green = 0.0
  $blue = 0.0

  switch ([Math]::Floor($segment)) {
    0 { $red = $chroma; $green = $x; break }
    1 { $red = $x; $green = $chroma; break }
    2 { $green = $chroma; $blue = $x; break }
    3 { $green = $x; $blue = $chroma; break }
    4 { $red = $x; $blue = $chroma; break }
    default { $red = $chroma; $blue = $x; break }
  }

  $match = $lightness - ($chroma / 2)
  $r = [int][Math]::Round(($red + $match) * 255)
  $g = [int][Math]::Round(($green + $match) * 255)
  $b = [int][Math]::Round(($blue + $match) * 255)
  return ("#{0:X2}{1:X2}{2:X2}" -f $r, $g, $b)
}

function Prefix-Id([string]$OperatorId, [string]$Value, [bool]$PrefixIds) {
  if (-not $PrefixIds -or [string]::IsNullOrWhiteSpace($Value)) {
    return $Value
  }

  return "$OperatorId`:$Value"
}

function Convert-Feed([object]$Operator, [string]$ExtractDir, [bool]$PrefixIds) {
  $agency = Import-Csv (Join-Path $ExtractDir "agency.txt") | Select-Object -First 1
  $feedInfo = Import-Csv (Join-Path $ExtractDir "feed_info.txt") | Select-Object -First 1
  $routesJpPath = Join-Path $ExtractDir "routes_jp.txt"
  $routesJpRows = if (Test-Path -LiteralPath $routesJpPath) { Import-Csv $routesJpPath } else { @() }
  $routesJpById = @{}
  foreach ($row in $routesJpRows) {
    $routesJpById[$row.route_id] = $row
  }

  $stops = Import-Csv (Join-Path $ExtractDir "stops.txt") | ForEach-Object {
    $prefixedStopId = Prefix-Id $Operator.id $_.stop_id $PrefixIds
    [ordered]@{
      id = $prefixedStopId
      agencyId = [string]$Operator.id
      agencyName = [string]$Operator.agencyName
      name = $_.stop_name
      latitude = [double]$_.stop_lat
      longitude = [double]$_.stop_lon
    }
  }

  $routes = Import-Csv (Join-Path $ExtractDir "routes.txt") | ForEach-Object {
    $shortName = $_.route_short_name
    if ([string]::IsNullOrWhiteSpace($shortName) -and $_.route_long_name -match '^[^：:]+[：:]') {
      $shortName = ($_.route_long_name -split '[：:]', 2)[0]
    }
    if ([string]::IsNullOrWhiteSpace($shortName)) {
      $shortName = $_.jp_parent_route_id
    }

    $longName = $_.route_long_name
    if ([string]::IsNullOrWhiteSpace($longName) -and $routesJpById.ContainsKey($_.route_id)) {
      $routeJp = $routesJpById[$_.route_id]
      $viaSegment = if ([string]::IsNullOrWhiteSpace($routeJp.via_stop)) { "" } else { "→$($routeJp.via_stop)" }
      $longName = "$($routeJp.origin_stop)$viaSegment→$($routeJp.destination_stop)"
    }

    $routeColor = $_.route_color
    if ([string]::IsNullOrWhiteSpace($routeColor)) {
      $colorKey = if ([string]::IsNullOrWhiteSpace($_.jp_parent_route_id)) { $_.route_id } else { $_.jp_parent_route_id }
      $routeColor = Get-RouteColor $colorKey
    } else {
      $routeColor = "#$($routeColor.TrimStart('#'))"
    }

    [ordered]@{
      id = Prefix-Id $Operator.id $_.route_id $PrefixIds
      agencyId = [string]$Operator.id
      agencyName = [string]$Operator.agencyName
      shortName = $shortName
      longName = $longName
      color = $routeColor
      parentRouteId = if ([string]::IsNullOrWhiteSpace($_.jp_parent_route_id)) { $null } else { Prefix-Id $Operator.id $_.jp_parent_route_id $PrefixIds }
    }
  }

  $tripStopIds = @{}
  $tripStopTimes = @{}
  Import-Csv (Join-Path $ExtractDir "stop_times.txt") |
    Sort-Object trip_id, @{ Expression = { [int]$_.stop_sequence } } |
    ForEach-Object {
      $prefixedTripId = Prefix-Id $Operator.id $_.trip_id $PrefixIds
      if (-not $tripStopIds.ContainsKey($prefixedTripId)) {
        $tripStopIds[$prefixedTripId] = [System.Collections.Generic.List[string]]::new()
      }
      if (-not $tripStopTimes.ContainsKey($prefixedTripId)) {
        $tripStopTimes[$prefixedTripId] = [System.Collections.Generic.List[object]]::new()
      }

      $prefixedStopId = Prefix-Id $Operator.id $_.stop_id $PrefixIds
      $tripStopIds[$prefixedTripId].Add($prefixedStopId)
      $tripStopTimes[$prefixedTripId].Add([ordered]@{
        stopId = $prefixedStopId
        stopSequence = [int]$_.stop_sequence
        arrivalTime = if ([string]::IsNullOrWhiteSpace($_.arrival_time)) { $null } else { $_.arrival_time }
        departureTime = if ([string]::IsNullOrWhiteSpace($_.departure_time)) { $null } else { $_.departure_time }
      })
    }

  $trips = Import-Csv (Join-Path $ExtractDir "trips.txt") | ForEach-Object {
    $tripId = Prefix-Id $Operator.id $_.trip_id $PrefixIds
    $headsign = if ([string]::IsNullOrWhiteSpace($_.trip_headsign)) { $_.trip_short_name } else { $_.trip_headsign }
    $directionId = if ([string]::IsNullOrWhiteSpace($_.direction_id)) { $null } else { $_.direction_id }
    $officeId = if ([string]::IsNullOrWhiteSpace($_.jp_office_id)) { $null } else { $_.jp_office_id }
    $stopIds = if ($tripStopIds.ContainsKey($tripId)) { $tripStopIds[$tripId].ToArray() } else { @() }
    $stopTimes = if ($tripStopTimes.ContainsKey($tripId)) { $tripStopTimes[$tripId].ToArray() } else { @() }

    [ordered]@{
      id = $tripId
      agencyId = [string]$Operator.id
      routeId = Prefix-Id $Operator.id $_.route_id $PrefixIds
      serviceId = $_.service_id
      headsign = $headsign
      directionId = $directionId
      officeId = $officeId
      stopIds = $stopIds
      stopTimes = $stopTimes
    }
  }

  $generatedAt = (Get-Date).ToString("o")
  $version = if ([string]::IsNullOrWhiteSpace($feedInfo.feed_version)) { $generatedAt } else { $feedInfo.feed_version }
  $publisherName = if ([string]::IsNullOrWhiteSpace($agency.agency_name)) { $Operator.agencyName } else { $agency.agency_name }
  $publisherUrl = if ([string]::IsNullOrWhiteSpace($agency.agency_url)) { $Operator.gtfsFeedUrl } else { $agency.agency_url }

  return [ordered]@{
    metadata = [ordered]@{
      datasetId = [string]$Operator.id
      agencyIds = @([string]$Operator.id)
      publisherName = $publisherName
      publisherUrl = $publisherUrl
      version = $version
      startDate = $feedInfo.feed_start_date
      endDate = $feedInfo.feed_end_date
      sourceUrl = $Operator.gtfsFeedUrl
      fetchedAt = $generatedAt
      routeCount = $routes.Count
      stopCount = $stops.Count
      tripCount = $trips.Count
    }
    routes = $routes
    stops = $stops
    trips = $trips
  }
}

function Write-JsonFile([string]$Path, [object]$Payload) {
  $json = $Payload | ConvertTo-Json -Depth 8 -Compress
  Set-Content -LiteralPath $Path -Value $json -Encoding utf8
}

Ensure-Directory $downloadDir
Ensure-Directory $publicDir

$allOperators = @($config.operators)
$selectedOperators =
  if ($DatasetId -eq "all") {
    $allOperators
  } else {
    @($allOperators | Where-Object { $_.id -eq $DatasetId })
  }

if ($selectedOperators.Count -eq 0) {
  throw "Unknown DatasetId: $DatasetId"
}

$combinedStops = [System.Collections.Generic.List[object]]::new()
$combinedRoutes = [System.Collections.Generic.List[object]]::new()
$combinedTrips = [System.Collections.Generic.List[object]]::new()
$combinedSourceUrls = [System.Collections.Generic.List[string]]::new()
$combinedStartDates = [System.Collections.Generic.List[string]]::new()
$combinedEndDates = [System.Collections.Generic.List[string]]::new()
$combinedVersions = [System.Collections.Generic.List[string]]::new()
$combinedFetchedAt = (Get-Date).ToString("o")

foreach ($operator in $selectedOperators) {
  $extractDir = Join-Path $dataRootDir $operator.id
  $zipPath = Join-Path $downloadDir "$($operator.id)-gtfs.zip"
  $publicFile = Join-Path $publicDir $operator.staticFile

  Ensure-Directory $extractDir

  Write-Host "Downloading GTFS-JP feed for $($operator.agencyName) from $($operator.gtfsFeedUrl)"
  Invoke-WebRequest -Uri $operator.gtfsFeedUrl -OutFile $zipPath

  Write-Host "Expanding feed into $extractDir"
  Remove-DirectoryContents $extractDir
  Expand-Archive -LiteralPath $zipPath -DestinationPath $extractDir -Force

  $operatorPayload = Convert-Feed $operator $extractDir $false
  Write-JsonFile $publicFile $operatorPayload

  Write-Host "Generated $publicFile"
  Write-Host "Routes: $($operatorPayload.metadata.routeCount) / Stops: $($operatorPayload.metadata.stopCount) / Trips: $($operatorPayload.metadata.tripCount)"

  if ($DatasetId -eq "all") {
    $prefixedPayload = Convert-Feed $operator $extractDir $true
    $prefixedPayload.stops | ForEach-Object { $combinedStops.Add($_) }
    $prefixedPayload.routes | ForEach-Object { $combinedRoutes.Add($_) }
    $prefixedPayload.trips | ForEach-Object { $combinedTrips.Add($_) }
    $combinedSourceUrls.Add([string]$operator.gtfsFeedUrl)
    if (-not [string]::IsNullOrWhiteSpace($prefixedPayload.metadata.startDate)) {
      $combinedStartDates.Add([string]$prefixedPayload.metadata.startDate)
    }
    if (-not [string]::IsNullOrWhiteSpace($prefixedPayload.metadata.endDate)) {
      $combinedEndDates.Add([string]$prefixedPayload.metadata.endDate)
    }
    if (-not [string]::IsNullOrWhiteSpace($prefixedPayload.metadata.version)) {
      $combinedVersions.Add([string]$prefixedPayload.metadata.version)
    }
  }
}

if ($DatasetId -eq "all") {
  $combinedFile = Join-Path $publicDir $config.combinedStaticFile
  $combinedPayload = [ordered]@{
    metadata = [ordered]@{
      datasetId = "all"
      agencyIds = @($selectedOperators | ForEach-Object { [string]$_.id })
      publisherName = "KumaNORETA"
      publisherUrl = "https://github.com/"
      version = if ($combinedVersions.Count -gt 0) { ($combinedVersions -join ",") } else { $combinedFetchedAt }
      startDate = if ($combinedStartDates.Count -gt 0) { ($combinedStartDates | Measure-Object -Minimum).Minimum } else { "" }
      endDate = if ($combinedEndDates.Count -gt 0) { ($combinedEndDates | Measure-Object -Maximum).Maximum } else { "" }
      sourceUrl = ($combinedSourceUrls -join ",")
      fetchedAt = $combinedFetchedAt
      routeCount = $combinedRoutes.Count
      stopCount = $combinedStops.Count
      tripCount = $combinedTrips.Count
    }
    routes = $combinedRoutes.ToArray()
    stops = $combinedStops.ToArray()
    trips = $combinedTrips.ToArray()
  }

  Write-JsonFile $combinedFile $combinedPayload
  Write-Host "Generated $combinedFile"
  Write-Host "Routes: $($combinedPayload.metadata.routeCount) / Stops: $($combinedPayload.metadata.stopCount) / Trips: $($combinedPayload.metadata.tripCount)"
}
