param(
  [string]$FeedUrl = "https://km.bus-vision.jp/gtfs/toshibus/gtfsFeed"
)

$ErrorActionPreference = "Stop"

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$downloadDir = Join-Path $workspaceRoot "data\gtfs-jp\_download"
$extractDir = Join-Path $workspaceRoot "data\gtfs-jp\toshibus"
$publicDir = Join-Path $workspaceRoot "public\gtfs"
$publicFile = Join-Path $publicDir "toshibus-static.json"
$zipPath = Join-Path $downloadDir "toshibus-gtfs.zip"

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

Ensure-Directory $downloadDir
Ensure-Directory $extractDir
Ensure-Directory $publicDir

Write-Host "Downloading GTFS-JP feed from $FeedUrl"
Invoke-WebRequest -Uri $FeedUrl -OutFile $zipPath

Write-Host "Expanding feed into $extractDir"
Remove-DirectoryContents $extractDir
Expand-Archive -LiteralPath $zipPath -DestinationPath $extractDir -Force

$agency = Import-Csv (Join-Path $extractDir "agency.txt") | Select-Object -First 1
$feedInfo = Import-Csv (Join-Path $extractDir "feed_info.txt") | Select-Object -First 1
$routesJpRows = Import-Csv (Join-Path $extractDir "routes_jp.txt")
$routesJpById = @{}
foreach ($row in $routesJpRows) {
  $routesJpById[$row.route_id] = $row
}

$stops = Import-Csv (Join-Path $extractDir "stops.txt") | ForEach-Object {
  [ordered]@{
    id = $_.stop_id
    name = $_.stop_name
    latitude = [double]$_.stop_lat
    longitude = [double]$_.stop_lon
  }
}

$routes = Import-Csv (Join-Path $extractDir "routes.txt") | ForEach-Object {
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
    id = $_.route_id
    shortName = $shortName
    longName = $longName
    color = $routeColor
    parentRouteId = $_.jp_parent_route_id
  }
}

$tripStopIds = @{}
$tripStopTimes = @{}
Import-Csv (Join-Path $extractDir "stop_times.txt") |
  Sort-Object trip_id, @{ Expression = { [int]$_.stop_sequence } } |
  ForEach-Object {
    if (-not $tripStopIds.ContainsKey($_.trip_id)) {
      $tripStopIds[$_.trip_id] = [System.Collections.Generic.List[string]]::new()
    }
    if (-not $tripStopTimes.ContainsKey($_.trip_id)) {
      $tripStopTimes[$_.trip_id] = [System.Collections.Generic.List[object]]::new()
    }

    $tripStopIds[$_.trip_id].Add($_.stop_id)
    $tripStopTimes[$_.trip_id].Add([ordered]@{
      stopId = $_.stop_id
      stopSequence = [int]$_.stop_sequence
      arrivalTime = if ([string]::IsNullOrWhiteSpace($_.arrival_time)) { $null } else { $_.arrival_time }
      departureTime = if ([string]::IsNullOrWhiteSpace($_.departure_time)) { $null } else { $_.departure_time }
    })
  }

$trips = Import-Csv (Join-Path $extractDir "trips.txt") | ForEach-Object {
  $headsign = if ([string]::IsNullOrWhiteSpace($_.trip_headsign)) { $_.trip_short_name } else { $_.trip_headsign }
  $directionId = if ([string]::IsNullOrWhiteSpace($_.direction_id)) { $null } else { $_.direction_id }
  $officeId = if ([string]::IsNullOrWhiteSpace($_.jp_office_id)) { $null } else { $_.jp_office_id }
  $stopIds = if ($tripStopIds.ContainsKey($_.trip_id)) { $tripStopIds[$_.trip_id].ToArray() } else { @() }
  $stopTimes = if ($tripStopTimes.ContainsKey($_.trip_id)) { $tripStopTimes[$_.trip_id].ToArray() } else { @() }

  [ordered]@{
    id = $_.trip_id
    routeId = $_.route_id
    serviceId = $_.service_id
    headsign = $headsign
    directionId = $directionId
    officeId = $officeId
    stopIds = $stopIds
    stopTimes = $stopTimes
  }
}

$generatedAt = (Get-Date).ToString("o")
$payload = [ordered]@{
  metadata = [ordered]@{
    publisherName = $agency.agency_name
    publisherUrl = $agency.agency_url
    version = $feedInfo.feed_version
    startDate = $feedInfo.feed_start_date
    endDate = $feedInfo.feed_end_date
    sourceUrl = $FeedUrl
    fetchedAt = $generatedAt
    routeCount = $routes.Count
    stopCount = $stops.Count
    tripCount = $trips.Count
  }
  routes = $routes
  stops = $stops
  trips = $trips
}

$json = $payload | ConvertTo-Json -Depth 8 -Compress
Set-Content -LiteralPath $publicFile -Value $json -Encoding utf8

Write-Host "Generated $publicFile"
Write-Host "Routes: $($routes.Count) / Stops: $($stops.Count) / Trips: $($trips.Count)"
