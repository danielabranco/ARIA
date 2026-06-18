# ARIA Training Script - IT.WI.019/R03 Dataflows
# Run: powershell -ExecutionPolicy Bypass -File aria_train_dataflows.ps1

$ARIA_API = "http://localhost:4001"
$entries = Get-Content -Path "$PSScriptRoot\aria_knowledge.json" -Raw | ConvertFrom-Json

Write-Host "=== Training ARIA: Dataflows (IT.WI.019/R03) ===" -ForegroundColor Cyan

foreach ($entry in $entries) {
    $body = $entry | ConvertTo-Json -Depth 5
    try {
        Invoke-RestMethod -Uri "$ARIA_API/api/knowledge" -Method Post -Body $body -ContentType "application/json" | Out-Null
        Write-Host "[OK] $($entry.title)" -ForegroundColor Green
    } catch {
        Write-Host "[FAIL] $($entry.title) - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
