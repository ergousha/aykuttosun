# Aykut Tosun – yerel önizleme sunucusu (Windows, ek program gerektirmez)
# Klasördeki "Siteyi Yerelde Ac.bat" dosyasına çift tıklayarak başlatın. Kapatmak için pencereyi kapatın.
param([int]$Port = 8080)

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Mime = @{
  ".html" = "text/html; charset=utf-8"; ".js" = "application/javascript; charset=utf-8"; ".css" = "text/css; charset=utf-8"
  ".json" = "application/json; charset=utf-8"; ".webmanifest" = "application/manifest+json"; ".svg" = "image/svg+xml"
  ".png" = "image/png"; ".jpg" = "image/jpeg"; ".jpeg" = "image/jpeg"; ".ico" = "image/x-icon"; ".xml" = "application/xml; charset=utf-8"
  ".txt" = "text/plain; charset=utf-8"; ".pdf" = "application/pdf"; ".md" = "text/plain; charset=utf-8"
}

# Boş bir port bul
$listener = $null
for ($p = $Port; $p -lt $Port + 20; $p++) {
  try {
    $l = New-Object System.Net.HttpListener
    $l.Prefixes.Add("http://localhost:$p/")
    $l.Start(); $listener = $l; $Port = $p; break
  } catch { }
}
if (-not $listener) { Write-Host "Uygun port bulunamadı." -ForegroundColor Red; Read-Host "Kapatmak için Enter"; exit 1 }

$url = "http://localhost:$Port/"
Write-Host ""
Write-Host "  Aykut Tosun sitesi yerelde çalışıyor:  $url" -ForegroundColor Green
Write-Host "  Klasör: $Root"
Write-Host "  Durdurmak için bu pencereyi kapatın."
Write-Host ""
Start-Process $url

while ($listener.IsListening) {
  try { $ctx = $listener.GetContext() } catch { break }
  $req = $ctx.Request; $res = $ctx.Response
  try {
    $path = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)
    $rel = $path.TrimStart("/").Replace("/", "\")
    $file = Join-Path $Root $rel
    if ((Test-Path $file -PathType Container) -or $path.EndsWith("/")) { $file = Join-Path $file "index.html" }
    $status = 200
    # Güvenlik: klasör dışına çıkılmasın
    $full = [System.IO.Path]::GetFullPath($file)
    if (-not $full.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) { $full = Join-Path $Root "404.html"; $status = 404 }
    if (-not (Test-Path $full -PathType Leaf)) {
      # "/makale/ad" gibi sonunda / olmayan adresler: klasöre yönlendir
      if (Test-Path (Join-Path $Root $rel) -PathType Container) {
        $res.StatusCode = 301; $res.RedirectLocation = $path + "/"; $res.Close(); continue
      }
      $full = Join-Path $Root "404.html"; $status = 404
    }
    $bytes = [System.IO.File]::ReadAllBytes($full)
    $ext = [System.IO.Path]::GetExtension($full).ToLower()
    $res.StatusCode = $status
    $res.ContentType = $(if ($Mime.ContainsKey($ext)) { $Mime[$ext] } else { "application/octet-stream" })
    $res.Headers.Add("Cache-Control", "no-cache")
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
    Write-Host ("{0}  {1}" -f $status, $path)
  } catch {
    try { $res.StatusCode = 500 } catch { }
    Write-Host ("500  {0}  {1}" -f $req.Url.AbsolutePath, $_.Exception.Message) -ForegroundColor Yellow
  } finally {
    try { $res.Close() } catch { }
  }
}
