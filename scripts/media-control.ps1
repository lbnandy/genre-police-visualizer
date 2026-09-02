param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('previous', 'toggle', 'next')]
    [string] $Action,
    [string] $PreferredSource = '',
    [string] $IgnoredSourcesBase64 = ''
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime

$asTaskMethods = [System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 }

function Await-WinRT {
    param(
        [Parameter(Mandatory = $true)] $Operation,
        [Parameter(Mandatory = $true)] [Type] $ResultType
    )
    $method = $asTaskMethods[0].MakeGenericMethod($ResultType)
    $task = $method.Invoke($null, @($Operation))
    $task.Wait()
    return $task.Result
}

$managerType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$manager = Await-WinRT -Operation ($managerType::RequestAsync()) -ResultType $managerType
$ignoredSources = @{}
if (-not [string]::IsNullOrWhiteSpace($IgnoredSourcesBase64)) {
    try {
        $ignoredJson = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($IgnoredSourcesBase64))
        @($ignoredJson | ConvertFrom-Json) | ForEach-Object { $ignoredSources[[string] $_] = $true }
    }
    catch { }
}
# Materialize WinRT's vector view so indexing and Count stay scalar when more
# than one player publishes an SMTC session.
$sessions = @($manager.GetSessions())
$session = $null
if (-not [string]::IsNullOrWhiteSpace($PreferredSource)) {
    $preferred = $null
    $preferredUpdated = [DateTimeOffset]::MinValue
    for ($index = 0; $index -lt $sessions.Count; $index += 1) {
        $candidate = $sessions[$index]
        try {
            if ($candidate.SourceAppUserModelId -ne $PreferredSource) { continue }
            if ($ignoredSources.ContainsKey([string] $candidate.SourceAppUserModelId)) { continue }
            $updated = $candidate.GetTimelineProperties().LastUpdatedTime
            if ($null -eq $preferred -or $updated -gt $preferredUpdated) {
                $preferred = $candidate
                $preferredUpdated = $updated
            }
        }
        catch { }
    }
    if ($null -ne $preferred) { $session = $preferred }
}
$current = $manager.GetCurrentSession()
if ($null -eq $session) {
    if ($null -ne $current -and -not $ignoredSources.ContainsKey([string] $current.SourceAppUserModelId) -and
        $current.GetPlaybackInfo().PlaybackStatus.ToString() -eq 'Playing') {
        $session = $current
    }
}
if ($null -eq $session) {
    for ($index = 0; $index -lt $sessions.Count; $index += 1) {
        $candidate = $sessions[$index]
        if (-not $ignoredSources.ContainsKey([string] $candidate.SourceAppUserModelId) -and
            $candidate.GetPlaybackInfo().PlaybackStatus.ToString() -eq 'Playing') {
            $session = $candidate
            break
        }
    }
}
if ($null -eq $session -and $null -ne $current -and
    -not $ignoredSources.ContainsKey([string] $current.SourceAppUserModelId)) {
    # A paused current session is still the correct target for a resume command.
    $session = $current
}
if ($null -eq $session) {
    for ($index = 0; $index -lt $sessions.Count; $index += 1) {
        $candidate = $sessions[$index]
        if (-not $ignoredSources.ContainsKey([string] $candidate.SourceAppUserModelId)) {
            $session = $candidate
            break
        }
    }
}
if ($null -eq $session) {
    @{ ok = $false; reason = 'No active media session' } | ConvertTo-Json -Compress
    exit 1
}

$operation = switch ($Action) {
    'previous' { $session.TrySkipPreviousAsync() }
    'toggle' { $session.TryTogglePlayPauseAsync() }
    'next' { $session.TrySkipNextAsync() }
}
$success = Await-WinRT -Operation $operation -ResultType ([bool])
@{ ok = [bool]$success; action = $Action } | ConvertTo-Json -Compress
