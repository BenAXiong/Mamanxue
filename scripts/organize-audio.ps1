Param(
  [string]$DeckDir = "public/decks",
  [string]$AudioDir = "public/audio",
  [switch]$CopyOnly
)

if (-not (Test-Path $DeckDir)) {
  Write-Error "Deck directory not found: $DeckDir"
  exit 1
}

if (-not (Test-Path $AudioDir)) {
  Write-Error "Audio directory not found: $AudioDir"
  exit 1
}

function Get-AudioReferences {
  param([string]$DeckFile)
  $json = Get-Content -Raw -Path $DeckFile | ConvertFrom-Json
  $deckId = $json.id
  $refs = @()
  foreach ($card in $json.cards) {
    if ($card.audio) {
      $refs += @{ deckId = $deckId; path = $card.audio; key = "audio" }
    }
    if ($card.audio_slow) {
      $refs += @{ deckId = $deckId; path = $card.audio_slow; key = "audio_slow" }
    }
  }
  return $refs
}

$deckFiles = Get-ChildItem -Path $DeckDir -Filter "*.json"

foreach ($deckFile in $deckFiles) {
  $references = Get-AudioReferences -DeckFile $deckFile.FullName
  if (-not $references.Count) {
    continue
  }

  $deckId = $references[0].deckId
  $deckAudioDir = Join-Path $AudioDir $deckId
  if (-not (Test-Path $deckAudioDir)) {
    New-Item -ItemType Directory -Path $deckAudioDir | Out-Null
  }

  $json = Get-Content -Raw -Path $deckFile.FullName | ConvertFrom-Json

  foreach ($ref in $references) {
    $relativePath = $ref.path
    if ([string]::IsNullOrWhiteSpace($relativePath)) {
      continue
    }
    $fileName = [System.IO.Path]::GetFileName($relativePath)
    $sourcePath = Join-Path $AudioDir $fileName
    $targetPath = Join-Path $deckAudioDir $fileName

    if (-not (Test-Path $sourcePath)) {
      Write-Warning "Missing source audio: $sourcePath (referenced in $($deckFile.Name))"
      continue
    }

    if (-not (Test-Path $targetPath)) {
      if ($CopyOnly) {
        Copy-Item -Path $sourcePath -Destination $targetPath
      } else {
        Move-Item -Path $sourcePath -Destination $targetPath
      }
    }

    $newRelative = "audio/$deckId/$fileName"

    foreach ($card in $json.cards) {
      if ($card.audio -eq $relativePath) {
        $card.audio = $newRelative
      }
      if ($card.audio_slow -eq $relativePath) {
        $card.audio_slow = $newRelative
      }
    }
  }

  $json | ConvertTo-Json -Depth 8 | Set-Content -Path $deckFile.FullName
}

