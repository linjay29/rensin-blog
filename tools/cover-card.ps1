# 文章封面圖（寬 1200，比例照原圖）
#
# Gemini 生的無字原圖 → 疊上標題、湖綠短線與診所 logo。
# 這張圖同時是首頁卡片的封面與文章頁的 hero，所以 logo 疊在這裡，
# 等於每一篇文章、每一張卡片都帶著診所識別。
#
# 用法：
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\cover-card.ps1 `
#       -Src  assets-src\<slug>\cover-src.jpg `
#       -Text assets-src\<slug>\cover-title.txt `
#       -Out  public\<slug>\assets\cover.jpg `
#       -X 730 -Y 176 -Size 88
#
# 文字檔（UTF-8，一行一列，通常兩行）就是要壓在圖上的標題。
# 中文一定要從檔案讀，不要當命令列參數傳——PowerShell 會把編碼吃掉。
#
# X/Y/Size 每張圖都要自己看著調：主體在左就把字放右邊的空白處，
# 反之亦然。調完務必把圖叫出來看一次，不要憑座標想像。

param(
  [Parameter(Mandatory = $true)][string]$Src,
  [Parameter(Mandatory = $true)][string]$Text,
  [Parameter(Mandatory = $true)][string]$Out,
  [double]$X = 730,
  [double]$Y = 176,
  [int]$Size = 88,
  [int]$LogoHeight = 96,
  [ValidateSet('br','bl','none')][string]$Logo = 'br'
)

Add-Type -AssemblyName System.Drawing

$lines = [System.IO.File]::ReadAllLines((Resolve-Path $Text), [System.Text.Encoding]::UTF8) |
         Where-Object { $_.Trim().Length -gt 0 }

$img = [System.Drawing.Image]::FromFile((Resolve-Path $Src))
$W = 1200
$H = [int][Math]::Round($img.Height * $W / $img.Width)
$bmp = New-Object System.Drawing.Bitmap($W, $H)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = 'HighQualityBicubic'
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'ClearTypeGridFit'
$g.DrawImage($img, 0, 0, $W, $H)

$font  = New-Object System.Drawing.Font("Microsoft JhengHei", $Size, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 20, 36, 34))
$teal  = [System.Drawing.Color]::FromArgb(255, 65, 186, 177)
$fmt   = [System.Drawing.StringFormat]::GenericTypographic

# 假粗體：次像素重繪，讓筆畫吃得住縮圖
$offsets = @(@(0,0), @(0.7,0), @(0,0.7), @(0.7,0.7), @(1.3,0.4))

$y = $Y
$lh = $Size * 1.30
$track = 5.0

foreach ($ln in $lines) {
  $cx = $X
  foreach ($ch in $ln.ToCharArray()) {
    $s = [string]$ch
    foreach ($o in $offsets) {
      $g.DrawString($s, $font, $brush, [single]($cx + $o[0]), [single]($y + $o[1]), $fmt)
    }
    $cw = $g.MeasureString($s, $font, [System.Drawing.PointF]::new(0,0), $fmt).Width
    $cx += $cw + $track
  }
  $y += $lh
}

$pen = New-Object System.Drawing.Pen ($teal), ([single]([Math]::Max(5, $Size / 12)))
$g.DrawLine($pen, [single]$X, [single]($y + 18), [single]($X + $Size * 1.4), [single]($y + 18))

if ($Logo -ne 'none') {
  $logoPath = Join-Path (Split-Path $PSScriptRoot -Parent) "public\assets\logo.png"
  $lg = [System.Drawing.Image]::FromFile($logoPath)
  $lgW = [int][Math]::Round($lg.Width * $LogoHeight / $lg.Height)
  $margin = 34
  $lx = if ($Logo -eq 'br') { $W - $lgW - $margin } else { $margin }
  $ly = $H - $LogoHeight - $margin
  $g.DrawImage($lg, [int]$lx, [int]$ly, $lgW, $LogoHeight)
  $lg.Dispose()
}

$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ps = New-Object System.Drawing.Imaging.EncoderParameters(1)
$ps.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 90
$bmp.Save((Join-Path (Get-Location) $Out), $enc, $ps)
$g.Dispose(); $bmp.Dispose(); $img.Dispose()
Write-Output ("已輸出 " + $Out + "  " + $W + "x" + $H)
