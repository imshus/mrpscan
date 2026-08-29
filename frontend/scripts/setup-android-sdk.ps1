param(
  [string]$SdkRoot = $(
    if ($env:ANDROID_HOME) { $env:ANDROID_HOME }
    elseif ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT }
    else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
  )
)

$ErrorActionPreference = 'Stop'

$toolsArchive = 'commandlinetools-win-15859902_latest.zip'
$toolsUri = "https://dl.google.com/android/repository/$toolsArchive"
$expectedSha256 = '90ae805d20434428bffcb699c290860f19bb5f66a67e6b330067e3de801fb04a'
$javaHome = $env:JAVA_HOME

if (-not $javaHome -or -not (Test-Path (Join-Path $javaHome 'bin\java.exe'))) {
  $javaHome = 'C:\Program Files\Android\Android Studio\jbr'
}

if (-not (Test-Path (Join-Path $javaHome 'bin\java.exe'))) {
  throw 'Java 21 was not found. Install Android Studio or set JAVA_HOME.'
}

$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = $SdkRoot
$env:ANDROID_SDK_ROOT = $SdkRoot

$sdkManager = Join-Path $SdkRoot 'cmdline-tools\latest\bin\sdkmanager.bat'

if (-not (Test-Path $sdkManager)) {
  $tempRoot = Join-Path ([IO.Path]::GetTempPath()) "pratham-android-sdk-$([guid]::NewGuid())"
  $archivePath = Join-Path $tempRoot $toolsArchive
  $extractPath = Join-Path $tempRoot 'extracted'
  $latestToolsPath = Join-Path $SdkRoot 'cmdline-tools\latest'

  New-Item -ItemType Directory -Force -Path $tempRoot, $extractPath, $latestToolsPath | Out-Null
  Write-Host "Downloading Android command-line tools to $archivePath"
  & curl.exe --fail --location --retry 3 --output $archivePath $toolsUri
  if ($LASTEXITCODE -ne 0) {
    throw "Android command-line tools download failed with exit code $LASTEXITCODE."
  }

  $archiveStream = [IO.File]::OpenRead($archivePath)
  try {
    $sha256 = [Security.Cryptography.SHA256]::Create()
    try {
      $actualSha256 = -join ($sha256.ComputeHash($archiveStream) | ForEach-Object { $_.ToString('x2') })
    }
    finally {
      $sha256.Dispose()
    }
  }
  finally {
    $archiveStream.Dispose()
  }
  if ($actualSha256 -ne $expectedSha256) {
    throw "Android command-line tools checksum mismatch. Expected $expectedSha256, got $actualSha256."
  }

  Expand-Archive -LiteralPath $archivePath -DestinationPath $extractPath
  Copy-Item -Path (Join-Path $extractPath 'cmdline-tools\*') -Destination $latestToolsPath -Recurse -Force
}

$sdkRootArgument = "--sdk_root=$SdkRoot"
$licenseAnswers = ((1..100 | ForEach-Object { 'y' }) -join [Environment]::NewLine)
$licenseAnswers | & $sdkManager $sdkRootArgument --licenses
if ($LASTEXITCODE -ne 0) {
  throw "Android license acceptance failed with exit code $LASTEXITCODE."
}

& $sdkManager $sdkRootArgument `
  'platform-tools' `
  'platforms;android-36' `
  'build-tools;36.0.0' `
  'ndk;27.1.12297006'
if ($LASTEXITCODE -ne 0) {
  throw "Android SDK package installation failed with exit code $LASTEXITCODE."
}

Write-Host "Android SDK is ready at $SdkRoot"
