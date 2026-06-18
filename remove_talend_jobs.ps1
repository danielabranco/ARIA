# Remove all talend-job knowledge entries
$ARIA = "http://localhost:4001"

$all = Invoke-RestMethod -Uri "$ARIA/api/knowledge" -Method Get
$talend = $all | Where-Object { $_.category -eq "talend-job" -or $_.topic -like "*Talend Job*" }

Write-Host "Found $($talend.Count) talend-job entries to remove." -ForegroundColor Yellow

foreach ($entry in $talend) {
    try {
        Invoke-RestMethod -Uri "$ARIA/api/knowledge/$($entry.id)" -Method Delete | Out-Null
        Write-Host "[DELETED] $($entry.topic)" -ForegroundColor Green
    } catch {
        Write-Host "[FAIL] $($entry.topic): $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "Done." -ForegroundColor Cyan
