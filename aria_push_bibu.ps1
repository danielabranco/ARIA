# Push BIBU knowledge to ARIA
$ARIA_API = "http://localhost:4001"
$entries = Get-Content -Path "$PSScriptRoot\aria_bibu.json" -Raw | ConvertFrom-Json

Write-Host "=== Pushing BIBU knowledge to ARIA ===" -ForegroundColor Cyan
foreach ($entry in $entries) {
    $body = $entry | ConvertTo-Json -Depth 5
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
    try {
        Invoke-RestMethod -Uri "$ARIA_API/api/knowledge" -Method Post -Body $bytes -ContentType "application/json; charset=utf-8" | Out-Null
        Write-Host "[OK] $($entry.topic)" -ForegroundColor Green
    } catch {
        Write-Host "[FAIL] $($entry.topic): $($_.Exception.Message)" -ForegroundColor Red
    }
}
Write-Host "=== Done ===" -ForegroundColor Cyan
