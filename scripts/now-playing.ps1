param(
    [string] $PreferredSource = '',
    [string] $IgnoredSourcesBase64 = ''
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -Path (Join-Path $PSScriptRoot 'GenrePolice.ThumbnailReader.dll')

$script:asTaskMethods = [System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 }

function Await-WinRT {
    param(
        [Parameter(Mandatory = $true)] $Operation,
        [Parameter(Mandatory = $true)] [Type] $ResultType,
        [int] $TimeoutMs = 4500
    )

    $method = $script:asTaskMethods[0].MakeGenericMethod($ResultType)
    $task = $method.Invoke($null, @($Operation))
    if (-not $task.Wait($TimeoutMs)) {
        throw [System.TimeoutException]::new("Windows media operation timed out after $TimeoutMs ms")
    }
    return $task.Result
}

$managerType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$propertiesType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType = WindowsRuntime]
$thumbnailStreamType = [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime]
$script:lastThumbnailKey = ''
$script:lastThumbnailData = ''
$script:ignoredSources = @{}
if (-not [string]::IsNullOrWhiteSpace($IgnoredSourcesBase64)) {
    try {
        $ignoredJson = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($IgnoredSourcesBase64))
        @($ignoredJson | ConvertFrom-Json) | ForEach-Object {
            $cleanSource = [string] $_
            if (-not [string]::IsNullOrWhiteSpace($cleanSource)) { $script:ignoredSources[$cleanSource] = $true }
        }
    }
    catch { }
}

function Test-MediaSourceAllowed {
    param([string] $Source)
    return -not $script:ignoredSources.ContainsKey([string] $Source)
}

function Select-MediaSession {
    param(
        [Parameter(Mandatory = $true)] $Manager,
        [Parameter(Mandatory = $true)] $Sessions
    )

    if (-not [string]::IsNullOrWhiteSpace($PreferredSource)) {
        $preferred = $null
        $preferredUpdated = [DateTimeOffset]::MinValue
        for ($index = 0; $index -lt $Sessions.Count; $index += 1) {
            $candidate = $Sessions[$index]
            try {
                if ($candidate.SourceAppUserModelId -ne $PreferredSource) { continue }
                if (-not (Test-MediaSourceAllowed -Source $candidate.SourceAppUserModelId)) { continue }
                $updated = $candidate.GetTimelineProperties().LastUpdatedTime
                if ($null -eq $preferred -or $updated -gt $preferredUpdated) {
                    $preferred = $candidate
                    $preferredUpdated = $updated
                }
            }
            catch { }
        }
        if ($null -ne $preferred) { return $preferred }
    }

    $current = $Manager.GetCurrentSession()
    if ($null -ne $current) {
        try {
            if ((Test-MediaSourceAllowed -Source $current.SourceAppUserModelId) -and
                $current.GetPlaybackInfo().PlaybackStatus.ToString() -eq 'Playing') { return $current }
        }
        catch { }
    }

    # GetCurrentSession can remain pinned to a paused browser/previous player
    # while another desktop client (notably NetEase Cloud Music) is already
    # playing. Enumerate all SMTC sessions and prefer the freshest playing one.
    $best = $null
    $bestUpdated = [DateTimeOffset]::MinValue
    for ($index = 0; $index -lt $Sessions.Count; $index += 1) {
        $candidate = $Sessions[$index]
        try {
            if (-not (Test-MediaSourceAllowed -Source $candidate.SourceAppUserModelId)) { continue }
            if ($candidate.GetPlaybackInfo().PlaybackStatus.ToString() -ne 'Playing') { continue }
            $updated = $candidate.GetTimelineProperties().LastUpdatedTime
            if ($null -eq $best -or $updated -gt $bestUpdated) {
                $best = $candidate
                $bestUpdated = $updated
            }
        }
        catch { }
    }
    if ($null -ne $best) { return $best }
    if ($null -ne $current -and (Test-MediaSourceAllowed -Source $current.SourceAppUserModelId)) { return $current }
    for ($index = 0; $index -lt $Sessions.Count; $index += 1) {
        if (Test-MediaSourceAllowed -Source $Sessions[$index].SourceAppUserModelId) { return $Sessions[$index] }
    }
    return $null
}

function Get-ThumbnailDataUri {
    param([Parameter(Mandatory = $true)] $Properties)

    if ($null -eq $Properties.Thumbnail) { return '' }
    $randomAccessStream = $null
    try {
        $randomAccessStream = Await-WinRT -Operation ($Properties.Thumbnail.OpenReadAsync()) -ResultType $thumbnailStreamType
        $bytes = [GenrePoliceThumbnailReader]::Read($randomAccessStream)
        if ($bytes.Length -eq 0) { return '' }
        $contentType = [GenrePoliceThumbnailReader]::GetContentType($randomAccessStream)
        $contentType = (($contentType -split '[,;]')[0]).Trim()
        if ([string]::IsNullOrWhiteSpace($contentType)) { $contentType = 'image/jpeg' }
        return "data:$contentType;base64,$([Convert]::ToBase64String($bytes))"
    }
    catch {
        return ''
    }
    finally {
        # WinRT exposes this object as a COM wrapper in Windows PowerShell; the
        # strongly typed bridge owns the underlying handle and disposes it.
    }
}

$stage = 'request-manager'
try {
    # Request one manager for the lifetime of this worker. Re-requesting the
    # global broker every polling interval can eventually wedge the WinRT
    # activation path, especially after repeated app restarts.
    $manager = Await-WinRT -Operation ($managerType::RequestAsync()) -ResultType $managerType
}
catch {
    @{
        playing = $false
        status = 'Error'
        errorStage = $stage
        error = $_.Exception.Message
    } | ConvertTo-Json -Compress
    exit 2
}

while ($true) {
    try {
        $stage = 'current-session'
        # Materialize WinRT's vector view. With multiple active players,
        # Windows PowerShell can otherwise member-enumerate `.Count` into
        # values such as `1 1 1` instead of returning one collection length.
        $sessions = @($manager.GetSessions())
        $availableSources = @(
            for ($index = 0; $index -lt $sessions.Count; $index += 1) {
                [string] $sessions[$index].SourceAppUserModelId
            }
        ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Sort-Object -Unique
        $session = Select-MediaSession -Manager $manager -Sessions $sessions

        if ($null -eq $session) {
            @{ playing = $false; status = 'NoSession'; sources = @($availableSources) } | ConvertTo-Json -Compress -Depth 4
            Start-Sleep -Milliseconds 1200
            continue
        }

        $stage = 'media-properties'
        $properties = Await-WinRT -Operation ($session.TryGetMediaPropertiesAsync()) -ResultType $propertiesType
        $stage = 'playback-timeline'
        $playback = $session.GetPlaybackInfo()
        $timeline = $session.GetTimelineProperties()
        $isPlaying = $playback.PlaybackStatus.ToString() -eq 'Playing'
        $playbackRate = 1.0
        if ($null -ne $playback.PlaybackRate) {
            $playbackRate = [double]$playback.PlaybackRate
        }
        $sampledAt = [DateTimeOffset]::UtcNow
        $timelineAgeMs = 0.0
        $positionMs = [double]$timeline.Position.TotalMilliseconds
        if ($isPlaying) {
            $timelineAgeMs = ($sampledAt - $timeline.LastUpdatedTime).TotalMilliseconds
            # SMTC Position is explicitly the position at LastUpdatedTime, not
            # at the instant GetTimelineProperties() is called. Advance it to
            # "now" so lyrics do not inherit the player's stale timeline age.
            # Some players (including Apple Music in some states) leave the
            # same valid anchor in place for much longer than ten seconds. The
            # old 10 s cutoff therefore made position jump back to stale SMTC
            # time. Reject only obviously invalid/default timestamps.
            if ($timeline.LastUpdatedTime.Year -ge 2000 -and $timelineAgeMs -ge 0 -and $timelineAgeMs -lt 86400000) {
                $positionMs += $timelineAgeMs * $playbackRate
            }
        }
        $positionMs = [Math]::Max(0, [Math]::Min($timeline.EndTime.TotalMilliseconds, $positionMs))
        $thumbnailKey = "$($properties.Artist)::$($properties.Title)::$($properties.AlbumTitle)"
        $thumbnailForOutput = ''
        if ($thumbnailKey -ne $script:lastThumbnailKey) {
            $script:lastThumbnailKey = $thumbnailKey
            $script:lastThumbnailData = Get-ThumbnailDataUri -Properties $properties
            $thumbnailForOutput = $script:lastThumbnailData
        }
        elseif ([string]::IsNullOrWhiteSpace($script:lastThumbnailData)) {
            $script:lastThumbnailData = Get-ThumbnailDataUri -Properties $properties
            $thumbnailForOutput = $script:lastThumbnailData
        }

        @{
            playing = $isPlaying
            status = $playback.PlaybackStatus.ToString()
            source = $session.SourceAppUserModelId
            title = $properties.Title
            artist = $properties.Artist
            album = $properties.AlbumTitle
            albumArtist = $properties.AlbumArtist
            artwork = $thumbnailForOutput
            genres = @($properties.Genres)
            trackNumber = $properties.TrackNumber
            positionMs = [Math]::Floor($positionMs)
            durationMs = [Math]::Floor($timeline.EndTime.TotalMilliseconds)
            playbackRate = $playbackRate
            timelineAgeMs = [Math]::Floor($timelineAgeMs)
            sampledAtMs = $sampledAt.ToUnixTimeMilliseconds()
            sources = @($availableSources)
        } | ConvertTo-Json -Compress -Depth 4
    }
    catch {
        @{
            playing = $false
            status = 'Error'
            errorStage = $stage
            error = $_.Exception.Message
        } | ConvertTo-Json -Compress
        # A stuck WinRT request can poison this PowerShell process. Exit after
        # reporting it; Electron's watchdog starts a clean monitor instance.
        if ($_.Exception -is [System.TimeoutException]) { exit 2 }
    }

    Start-Sleep -Milliseconds 1200
}
