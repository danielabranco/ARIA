# Push 10 app profiles to ARIA
$ARIA_API = "http://localhost:4001"
$entries = Get-Content -Path "$PSScriptRoot\aria_10_apps.json" -Raw | ConvertFrom-Json

Write-Host "=== Pushing 10 app profiles to ARIA ===" -ForegroundColor Cyan
$ok = 0; $fail = 0
foreach ($entry in $entries) {
    $body  = $entry | ConvertTo-Json -Depth 5
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
    try {
        Invoke-RestMethod -Uri "$ARIA_API/api/knowledge" -Method Post -Body $bytes -ContentType "application/json; charset=utf-8" | Out-Null
        Write-Host "[OK] $($entry.topic)" -ForegroundColor Green
        $ok++
    } catch {
        Write-Host "[FAIL] $($entry.topic): $($_.Exception.Message)" -ForegroundColor Red
        $fail++
    }
}
Write-Host "`n=== Done: $ok pushed, $fail failed ===" -ForegroundColor Cyan
