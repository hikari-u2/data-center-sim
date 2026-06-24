$ErrorActionPreference = "Stop"

$Root = [System.IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$RootPrefix = $Root.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
$ConfigPath = Join-Path (Join-Path $Root "data") "config.json"
$Port = 8080
$IsWindowsHost = $PSVersionTable.PSEdition -eq "Desktop" -or $PSVersionTable.Platform -eq "Win32NT"
$BindAddress = if ($IsWindowsHost) { [System.Net.IPAddress]::Loopback } else { [System.Net.IPAddress]::Any }
$Listener = [System.Net.Sockets.TcpListener]::new($BindAddress, $Port)

function Get-ContentType {
  param([string] $Path)

  switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    ".html" { "text/html; charset=utf-8"; break }
    ".css" { "text/css; charset=utf-8"; break }
    ".js" { "application/javascript; charset=utf-8"; break }
    ".json" { "application/json; charset=utf-8"; break }
    ".svg" { "image/svg+xml"; break }
    ".png" { "image/png"; break }
    ".jpg" { "image/jpeg"; break }
    ".jpeg" { "image/jpeg"; break }
    ".gif" { "image/gif"; break }
    default { "application/octet-stream" }
  }
}

function Send-Response {
  param(
    [System.Net.Sockets.NetworkStream] $Stream,
    [int] $StatusCode,
    [string] $StatusText,
    [byte[]] $Body,
    [string] $ContentType
  )

  $Header = "HTTP/1.1 $StatusCode $StatusText`r`nContent-Length: $($Body.Length)`r`nContent-Type: $ContentType`r`nConnection: close`r`n`r`n"
  $HeaderBytes = [System.Text.Encoding]::ASCII.GetBytes($Header)
  try {
    $Stream.Write($HeaderBytes, 0, $HeaderBytes.Length)
    $Stream.Write($Body, 0, $Body.Length)
  } catch {
    # Clients can close early, especially for HEAD/probe requests.
  }
}

function Test-StopRequested {
  try {
    if ([Console]::IsInputRedirected) {
      return $false
    }

    while ([Console]::KeyAvailable) {
      $Key = [Console]::ReadKey($true)
      if ($Key.Key -eq [ConsoleKey]::Q -or $Key.Key -eq [ConsoleKey]::Escape) {
        return $true
      }
    }
  } catch {
    return $false
  }

  return $false
}

try {
  try {
    $Listener.Start()
  } catch {
    Write-Host ""
    Write-Host "Could not start the local server on port $Port."
    Write-Host "Another app may already be using http://localhost:$Port/"
    Write-Host ""
    throw
  }
  $Url = "http://localhost:$Port/"
  Write-Host ""
  Write-Host "Data Center Server Map is running."
  Write-Host "Open: $Url"
  Write-Host "Press Q to stop, or close this window."
  Write-Host ""
  if ($IsWindowsHost) {
    Start-Process $Url
  }

  while (-not (Test-StopRequested)) {
    if (-not $Listener.Pending()) {
      Start-Sleep -Milliseconds 100
      continue
    }

    $Client = $Listener.AcceptTcpClient()
    try {
      $Stream = $Client.GetStream()
      $Reader = [System.IO.StreamReader]::new($Stream, [System.Text.Encoding]::UTF8, $false, 1024, $true)
      $RequestLine = $Reader.ReadLine()

      if ([string]::IsNullOrWhiteSpace($RequestLine)) {
        continue
      }

      $Parts = $RequestLine.Split(" ")
      $Method = if ($Parts.Length -gt 0) { $Parts[0] } else { "GET" }
      $RequestPath = if ($Parts.Length -gt 1) { $Parts[1] } else { "/" }
      $RequestPath = [System.Uri]::UnescapeDataString($RequestPath.Split("?")[0])

      $Headers = @{}
      while ($true) {
        $HeaderLine = $Reader.ReadLine()
        if ([string]::IsNullOrEmpty($HeaderLine)) {
          break
        }

        $HeaderParts = $HeaderLine.Split(":", 2)
        if ($HeaderParts.Length -eq 2) {
          $Headers[$HeaderParts[0].Trim().ToLowerInvariant()] = $HeaderParts[1].Trim()
        }
      }

      if ($RequestPath -eq "/api/config") {
        if ($Method -eq "GET") {
          if (Test-Path $ConfigPath -PathType Leaf) {
            $Body = [System.IO.File]::ReadAllBytes($ConfigPath)
            Send-Response $Stream 200 "OK" $Body "application/json; charset=utf-8"
          } else {
            $Body = [System.Text.Encoding]::UTF8.GetBytes("{""error"":""Config file not found""}")
            Send-Response $Stream 404 "Not Found" $Body "application/json; charset=utf-8"
          }
          continue
        }

        if ($Method -eq "POST") {
          $ContentLength = if ($Headers.ContainsKey("content-length")) { [int] $Headers["content-length"] } else { 0 }
          $Json = ""
          if ($ContentLength -gt 0) {
            $Chars = New-Object char[] $ContentLength
            $Read = $Reader.ReadBlock($Chars, 0, $ContentLength)
            if ($Read -gt 0) {
              $Json = -join $Chars[0..($Read - 1)]
            }
          }
          $Json = $Json.TrimStart([char]0xFEFF)

          try {
            $null = $Json | ConvertFrom-Json
            $ConfigDirectory = Split-Path -Parent $ConfigPath
            if (-not (Test-Path $ConfigDirectory -PathType Container)) {
              New-Item -ItemType Directory -Path $ConfigDirectory | Out-Null
            }
            $Utf8NoBom = New-Object System.Text.UTF8Encoding $false
            [System.IO.File]::WriteAllText($ConfigPath, $Json + [Environment]::NewLine, $Utf8NoBom)
            $Body = [System.Text.Encoding]::UTF8.GetBytes("{""ok"":true}")
            Send-Response $Stream 200 "OK" $Body "application/json; charset=utf-8"
          } catch {
            $Body = [System.Text.Encoding]::UTF8.GetBytes("{""error"":""Invalid config JSON""}")
            Send-Response $Stream 400 "Bad Request" $Body "application/json; charset=utf-8"
          }
          continue
        }

        $Body = [System.Text.Encoding]::UTF8.GetBytes("{""error"":""Method not allowed""}")
        Send-Response $Stream 405 "Method Not Allowed" $Body "application/json; charset=utf-8"
        continue
      }

      if ($RequestPath -eq "/") {
        $RequestPath = "/index.html"
      }

      $RelativePath = $RequestPath.TrimStart("/") -replace "/", [System.IO.Path]::DirectorySeparatorChar
      $FullPath = [System.IO.Path]::GetFullPath((Join-Path $Root $RelativePath))

      if (-not ($FullPath + [System.IO.Path]::DirectorySeparatorChar).StartsWith($RootPrefix, [System.StringComparison]::OrdinalIgnoreCase) -and -not $FullPath.Equals($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
        $Body = [System.Text.Encoding]::UTF8.GetBytes("403 Forbidden")
        Send-Response $Stream 403 "Forbidden" $Body "text/plain; charset=utf-8"
      } elseif (-not (Test-Path $FullPath -PathType Leaf)) {
        $Body = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
        Send-Response $Stream 404 "Not Found" $Body "text/plain; charset=utf-8"
      } else {
        $Body = [System.IO.File]::ReadAllBytes($FullPath)
        Send-Response $Stream 200 "OK" $Body (Get-ContentType $FullPath)
      }
    } catch {
      $Body = [System.Text.Encoding]::UTF8.GetBytes("500 Server Error")
      Send-Response $Stream 500 "Server Error" $Body "text/plain; charset=utf-8"
    } finally {
      $Client.Close()
    }
  }

  Write-Host ""
  Write-Host "Data Center Server Map stopped."
} finally {
  $Listener.Stop()
}
