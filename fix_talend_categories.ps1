# Fix Talend Job entries stored under wrong category 'dataflow'
# Run: powershell -ExecutionPolicy Bypass -File fix_talend_categories.ps1

$ARIA = "http://localhost:4001"

Write-Host "=== Finding Talend entries with wrong category ===" -ForegroundColor Cyan

$all = Invoke-RestMethod -Uri "$ARIA/api/knowledge" -Method Get
$wrong = $all | Where-Object { $_.topic -like "*Talend Job*" -and $_.category -ne "talend-job" }

Write-Host "Found $($wrong.Count) entries to fix." -ForegroundColor Yellow

foreach ($entry in $wrong) {
    try {
        $body = @{ category = "talend-job" } | ConvertTo-Json
        Invoke-RestMethod -Uri "$ARIA/api/knowledge/$($entry.id)" -Method Put -Body $body -ContentType "application/json" | Out-Null
        Write-Host "[FIXED] $($entry.topic)" -ForegroundColor Green
    } catch {
        Write-Host "[FAIL] $($entry.topic): $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "=== Done ===" -ForegroundColor Cyan
