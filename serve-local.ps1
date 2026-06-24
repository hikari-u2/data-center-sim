$ErrorActionPreference = "Stop"

$Root = [System.IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$RootPrefix = $Root.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
$Port = 8080
$Listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)

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
  $Stream.Write($HeaderBytes, 0, $HeaderBytes.Length)
  $Stream.Write($Body, 0, $Body.Length)
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
  Write-Host "Press Ctrl+C to stop."
  Write-Host ""
  Start-Process $Url

  while ($true) {
    $Client = $Listener.AcceptTcpClient()
    try {
      $Stream = $Client.GetStream()
      $Reader = [System.IO.StreamReader]::new($Stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $RequestLine = $Reader.ReadLine()

      if ([string]::IsNullOrWhiteSpace($RequestLine)) {
        continue
      }

      $Parts = $RequestLine.Split(" ")
      $RequestPath = if ($Parts.Length -gt 1) { $Parts[1] } else { "/" }
      $RequestPath = [System.Uri]::UnescapeDataString($RequestPath.Split("?")[0])

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
} finally {
  $Listener.Stop()
}
