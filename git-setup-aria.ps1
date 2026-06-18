# ARIA — Initialize git repo + create GitHub repo + push
Set-Location C:\ARIA

$PAT   = $env:GITHUB_PAT   # set via environment variable — never hardcode tokens
$USER  = "danielabranco"
$REPO  = "aria_intelligence"

# Init local repo
git init
git config user.email "daniela.branco@om-digitalsolutions.com"
git config user.name "Daniela Branco"

# Create GitHub repo via API
$body = @{ name = $REPO; description = "ARIA — Architecture & Requirements Intelligence Assistant"; private = $true } | ConvertTo-Json
$headers = @{ Authorization = "token $PAT"; "Content-Type" = "application/json" }
try {
    $response = Invoke-RestMethod -Uri "https://api.github.com/user/repos" -Method POST -Headers $headers -Body $body
    Write-Host "GitHub repo created: $($response.html_url)" -ForegroundColor Green
} catch {
    Write-Host "Repo may already exist or API error: $_" -ForegroundColor Yellow
}

# Set remote
git remote remove origin 2>$null
git remote add origin "https://${USER}:${PAT}@github.com/${USER}/${REPO}.git"

# Stage all ARIA files
git add -A
git reset HEAD .git-setup-aria.ps1 2>$null  # don't commit the script itself

# Initial commit
git commit -m "chore: initial commit — ARIA Intelligence baseline"

# Push master
git push -u origin master

Write-Host ""
Write-Host "ARIA repo live at: https://github.com/$USER/$REPO" -ForegroundColor Cyan
