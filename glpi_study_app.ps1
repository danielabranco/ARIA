# Fetch full profile for a single app + its dataflows
param([int]$AppId = 866)

$GLPI_URL   = "https://de1vs076.om-digitalsolutions.com/apirest.php"
$USER_TOKEN = "U4VTeCIFvquTWsqFamZwBbBxV2HyoYRlsNC4D9Sr"
$APP_TOKEN  = "rcWjLWx6G5N4ZRsWffpimrDYfFpiu77MSnKdSZzE"

Add-Type @"
using System.Net;
using System.Security.Cryptography.X509Certificates;
public class TrustAll : ICertificatePolicy {
    public bool CheckValidationResult(ServicePoint sp, X509Certificate cert, WebRequest req, int problem) { return true; }
}
"@
[System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAll

# Init session
$session = Invoke-RestMethod -Uri "$GLPI_URL/initSession" -Method Get -Headers @{
    "Authorization" = "user_token $USER_TOKEN"
    "App-Token"     = $APP_TOKEN
}
$token = $session.session_token
$h = @{ "Session-Token" = $token; "App-Token" = $APP_TOKEN }

# App structure
$app = Invoke-RestMethod -Uri "$GLPI_URL/PluginArchiswSwcomponent/$($AppId)?expand_dropdowns=true" -Method Get -Headers $h
Write-Host "`n=== APPLICATION: $($app.name) (ID: $AppId) ===" -ForegroundColor Cyan
$app | ConvertTo-Json -Depth 3

# All dataflows - fetch in bulk then filter
Write-Host "`n=== DATAFLOWS ===" -ForegroundColor Cyan
$flows = Invoke-RestMethod -Uri "$GLPI_URL/PluginDataflowsDataflow?range=0-500&expand_dropdowns=true" -Method Get -Headers $h

$appName = $app.name
$related = $flows | Where-Object {
    $_.plugin_dataflows_fromswcomponents_id -eq $appName -or
    $_.plugin_dataflows_toswcomponents_id   -eq $appName
}

Write-Host "Found $($related.Count) dataflows involving $appName" -ForegroundColor Yellow
foreach ($f in $related) {
    $dir = if ($f.plugin_dataflows_fromswcomponents_id -eq $appName) { "OUT" } else { "IN " }
    Write-Host "[$dir] ID:$($f.id) | $($f.plugin_dataflows_fromswcomponents_id) -> $($f.plugin_dataflows_toswcomponents_id) | $($f.name) | $($f.plugin_dataflows_states_id)"
}

# Kill session
Invoke-RestMethod -Uri "$GLPI_URL/killSession" -Method Get -Headers $h | Out-Null
