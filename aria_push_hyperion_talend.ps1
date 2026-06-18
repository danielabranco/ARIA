# ARIA Push — Talend + Hyperion Talend Job Entries + tag update
# Run: powershell -ExecutionPolicy Bypass -File aria_push_hyperion_talend.ps1

$ARIA_API = "http://localhost:4001"

Write-Host "=== Pushing Talend knowledge to ARIA ===" -ForegroundColor Cyan

# 1. Push new entries
$entries = Get-Content -Path "$PSScriptRoot\aria_hyperion_talend.json" -Raw | ConvertFrom-Json

foreach ($entry in $entries) {
    $body = $entry | ConvertTo-Json -Depth 5
    try {
        Invoke-RestMethod -Uri "$ARIA_API/api/knowledge" -Method Post -Body $body -ContentType "application/json" | Out-Null
        Write-Host "[OK] $($entry.topic)" -ForegroundColor Green
    } catch {
        Write-Host "[FAIL] $($entry.topic) - $($_.Exception.Message)" -ForegroundColor Red
    }
}

# 2. Find and update the existing Hyperion dataflow entry to add 'talend' tag
Write-Host ""
Write-Host "=== Tagging existing Hyperion dataflow entry with 'talend' ===" -ForegroundColor Cyan

try {
    $all = Invoke-RestMethod -Uri "$ARIA_API/api/knowledge?category=dataflow&search=FINANCEDATASTORE" -Method Get
    $hyperionEntry = $all | Where-Object { $_.topic -like "*FINANCEDATASTORE*HYPERION*" -or $_.topic -like "*HYPERION*Reports*" } | Select-Object -First 1

    if ($hyperionEntry) {
        $currentTags = $hyperionEntry.tags
        if ($currentTags -notcontains "talend") {
            $newTags = @($currentTags) + "talend"
            $updateBody = @{ tags = $newTags } | ConvertTo-Json
            Invoke-RestMethod -Uri "$ARIA_API/api/knowledge/$($hyperionEntry.id)" -Method Put -Body $updateBody -ContentType "application/json" | Out-Null
            Write-Host "[OK] Added 'talend' tag to: $($hyperionEntry.topic)" -ForegroundColor Green
        } else {
            Write-Host "[SKIP] 'talend' tag already present on: $($hyperionEntry.topic)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "[WARN] Hyperion dataflow entry not found in knowledge base — run aria_push_hyperion.ps1 first" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[FAIL] Could not update Hyperion entry: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Done. Review entries in ARIA Knowledge Base. ===" -ForegroundColor Cyan
