# List all applications from GLPI App Structures
$GLPI_URL  = "https://de1vs076.om-digitalsolutions.com/apirest.php"
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

# Fetch apps
$apps = Invoke-RestMethod -Uri "$GLPI_URL/PluginArchiswSwcomponent?range=0-500&expand_dropdowns=true" -Method Get -Headers @{
    "Session-Token" = $token
    "App-Token"     = $APP_TOKEN
}

Write-Host "`n=== GLPI Applications ($($apps.Count) total) ===" -ForegroundColor Cyan
Write-Host ("{0,-6} {1,-40} {2,-20} {3}" -f "ID", "Name", "Type", "Status") -ForegroundColor Gray
Write-Host ("-" * 90) -ForegroundColor DarkGray

foreach ($a in $apps | Sort-Object name) {
    $type   = if ($a.plugin_archisw_swcomponenttypes_id) { $a.plugin_archisw_swcomponenttypes_id } elseif ($a.swcomponenttypes_id) { $a.swcomponenttypes_id } else { "" }
    $status = if ($a.states_id) { $a.states_id } else { "" }
    Write-Host ("{0,-6} {1,-40} {2,-20} {3}" -f $a.id, $a.name, $type, $status)
}

# Kill session
Invoke-RestMethod -Uri "$GLPI_URL/killSession" -Method Get -Headers @{
    "Session-Token" = $token
    "App-Token"     = $APP_TOKEN
} | Out-Null
