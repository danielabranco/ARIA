# ARIA Push — Hyperion Knowledge Entries
# Run: powershell -ExecutionPolicy Bypass -File aria_push_hyperion.ps1

$ARIA_API = "http://localhost:4001"
$entries = Get-Content -Path "$PSScriptRoot\aria_hyperion.json" -Raw | ConvertFrom-Json

Write-Host "=== Pushing Hyperion to ARIA ===" -ForegroundColor Cyan

foreach ($entry in $entries) {
    $body = $entry | ConvertTo-Json -Depth 5
    try {
        Invoke-RestMethod -Uri "$ARIA_API/api/knowledge" -Method Post -Body $body -ContentType "application/json" | Out-Null
        Write-Host "[OK] $($entry.topic)" -ForegroundColor Green
    } catch {
        Write-Host "[FAIL] $($entry.topic) - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== Done. Check ARIA Knowledge Base to review and approve. ===" -ForegroundColor Cyan
