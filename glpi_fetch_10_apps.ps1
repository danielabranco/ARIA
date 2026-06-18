# Fetch profile data for 10 key apps from GLPI
$GLPI_URL   = "https://de1vs076.om-digitalsolutions.com/apirest.php"
$USER_TOKEN = "U4VTeCIFvquTWsqFamZwBbBxV2HyoYRlsNC4D9Sr"
$APP_TOKEN  = "rcWjLWx6G5N4ZRsWffpimrDYfFpiu77MSnKdSZzE"

Add-Type @"
using System.Net;
using System.Security.Cryptography.X509Certificates;
public class TrustAll2 : ICertificatePolicy {
    public bool CheckValidationResult(ServicePoint sp, X509Certificate cert, WebRequest req, int problem) { return true; }
}
"@
[System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAll2

$session = Invoke-RestMethod -Uri "$GLPI_URL/initSession" -Method Get -Headers @{
    "Authorization" = "user_token $USER_TOKEN"; "App-Token" = $APP_TOKEN
}
$token = $session.session_token
$h = @{ "Session-Token" = $token; "App-Token" = $APP_TOKEN }

# Target apps: ID => Name
$apps = @{
    811 = "SAP ERP NALA"
    803 = "Mulesoft"
    792 = "MyOMSYSTEM"
    844 = "ExDB"
    812 = "SAP CRM Marketing"
    853 = "Adobe Commerce Cloud Magento"
    810 = "Office 365"
    813 = "Sales Force Marketing Cloud"
    756 = "Webtech"
    757 = "Service Tool"
}

# Fetch all dataflows once
Write-Host "Fetching all dataflows..." -ForegroundColor Gray
$allFlows = Invoke-RestMethod -Uri "$GLPI_URL/PluginDataflowsDataflow?range=0-500&expand_dropdowns=true" -Method Get -Headers $h

foreach ($id in ($apps.Keys | Sort-Object)) {
    $appName = $apps[$id]
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "APP: $appName (ID: $id)" -ForegroundColor Yellow

    # App structure
    $app = Invoke-RestMethod -Uri "$GLPI_URL/PluginArchiswSwcomponent/$($id)?expand_dropdowns=true" -Method Get -Headers $h

    Write-Host "Type:         $($app.plugin_archisw_swcomponenttypes_id)"
    Write-Host "Status:       $($app.states_id)"
    Write-Host "Owner:        $($app.groups_id)"
    Write-Host "Supplier:     $($app.suppliers_id)"
    Write-Host "SvcLevel:     $($app.plugin_archisw_swcomponentslas_id)"
    Write-Host "Instances:    $($app.plugin_archisw_swcomponentinstances_id)"
    Write-Host "Database:     $($app.plugin_archisw_swcomponentdbs_id)"
    Write-Host "DevLanguage:  $($app.plugin_archisw_swcomponenttechnics_id)"
    Write-Host "Targets:      $($app.plugin_archisw_swcomponenttargets_id)"
    Write-Host "Location:     $($app.locations_id)"
    Write-Host "URL Prod:     $($app.url_prod)"
    Write-Host "URL QA:       $($app.url_qa)"
    Write-Host "Description:  $($app.shortdescription -replace '\r?\n',' ')"
    Write-Host "InUseSince:   $($app.plugin_archisw_inusesinceyear)"

    # Dataflows
    $related = $allFlows | Where-Object {
        $_.plugin_dataflows_fromswcomponents_id -eq $appName -or
        $_.plugin_dataflows_toswcomponents_id   -eq $appName
    }
    Write-Host "Dataflows ($($related.Count) total):"
    foreach ($f in $related) {
        $dir = if ($f.plugin_dataflows_fromswcomponents_id -eq $appName) { "OUT" } else { "IN " }
        Write-Host "  [$dir] ID:$($f.id) | $($f.plugin_dataflows_fromswcomponents_id) -> $($f.plugin_dataflows_toswcomponents_id) | $($f.name) | $($f.plugin_dataflows_states_id)"
    }
}

Invoke-RestMethod -Uri "$GLPI_URL/killSession" -Method Get -Headers $h | Out-Null
Write-Host "`n=== Done ===" -ForegroundColor Cyan
