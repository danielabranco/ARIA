# Cleanup duplicate BIBU entries and re-push correct ones
$ARIA_API = "http://localhost:4001"

Write-Host "=== Step 1: Delete all existing BIBU knowledge entries ===" -ForegroundColor Cyan

$all = Invoke-RestMethod -Uri "$ARIA_API/api/knowledge" -Method Get
$toDelete = $all | Where-Object { $_.topic -match "BIBU" }

foreach ($entry in $toDelete) {
    try {
        Invoke-RestMethod -Uri "$ARIA_API/api/knowledge/$($entry.id)" -Method Delete | Out-Null
        Write-Host "[DELETED] $($entry.topic)" -ForegroundColor Yellow
    } catch {
        Write-Host "[FAIL DELETE] $($entry.topic): $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== Step 2: Push clean BIBU entries ===" -ForegroundColor Cyan

$entries = Get-Content -Path "$PSScriptRoot\aria_bibu.json" -Raw | ConvertFrom-Json

foreach ($entry in $entries) {
    $body  = $entry | ConvertTo-Json -Depth 5
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
    try {
        Invoke-RestMethod -Uri "$ARIA_API/api/knowledge" -Method Post -Body $bytes -ContentType "application/json; charset=utf-8" | Out-Null
        Write-Host "[OK] $($entry.topic) [$($entry.category)]" -ForegroundColor Green
    } catch {
        Write-Host "[FAIL PUSH] $($entry.topic): $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
