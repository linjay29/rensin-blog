# 粉專封面（1640×624，FB 建議 820×312 的兩倍）
#
# 手機版的粉專封面：左下角會被大頭貼蓋住、左右兩側會被裁掉，
# 所以字一律置中偏上，logo 放右下。
#
# 用法：
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\fb-cover.ps1 `
#       -Text assets-src\fb\cover.txt -Out assets-src\fb\cover.png
#
# 文字檔（UTF-8）：第 1 行＝主標語，第 2 行起＝副標（小字，可多行）

param(
  [Parameter(Mandatory = $true)][string]$Text,
  [Parameter(Mandatory = $true)][string]$Out,
  [string]$Bg = 'f4f8f7',
  [string]$Fg = '14241f',
  [int]$Size = 104,
  [int]$SubSize = 40
)

Add-Type -AssemblyName System.Drawing

$lines = [System.IO.File]::ReadAllLines((Resolve-Path $Text), [System.Text.Encoding]::UTF8) |
         Where-Object { $_.Trim().Length -gt 0 }
$title = $lines[0]
$subs  = @($lines | Select-Object -Skip 1)

$W = 1640; $H = 624
$bmp = New-Object System.Drawing.Bitmap($W, $H)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'ClearTypeGridFit'
$g.Clear([System.Drawing.ColorTranslator]::FromHtml("#$Bg"))

$fontT = New-Object System.Drawing.Font("Microsoft JhengHei", $Size, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$fontS = New-Object System.Drawing.Font("Microsoft JhengHei", $SubSize, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$ink   = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#$Fg"))
$dim   = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#46534f"))
$teal  = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 65, 186, 177))

$fmt = New-Object System.Drawing.StringFormat
$fmt.Alignment = [System.Drawing.StringAlignment]::Center
$fmt.LineAlignment = [System.Drawing.StringAlignment]::Center

$ty = 210
$g.DrawString($title, $fontT, $ink, (New-Object System.Drawing.RectangleF(0, [single]($ty - $Size), [single]$W, [single]($Size * 2))), $fmt)

$barW = 150; $barH = 8
$g.FillRectangle($teal, [single](($W - $barW) / 2), [single]($ty + $Size * 0.75), [single]$barW, [single]$barH)

$sy = $ty + $Size * 0.75 + 60
foreach ($ln in $subs) {
  $g.DrawString($ln, $fontS, $dim, (New-Object System.Drawing.RectangleF(0, [single]$sy, [single]$W, [single]($SubSize * 1.6))), $fmt)
  $sy += $SubSize * 1.7
}

$logoPath = Join-Path (Split-Path $PSScriptRoot -Parent) "public\assets\logo.png"
if (Test-Path $logoPath) {
  $lg = [System.Drawing.Image]::FromFile($logoPath)
  $lh = 110
  $lw = [int][Math]::Round($lg.Width * $lh / $lg.Height)
  $g.DrawImage($lg, [int]($W - $lw - 56), [int]($H - $lh - 44), $lw, $lh)
  $lg.Dispose()
}

$bmp.Save((Join-Path (Get-Location) $Out), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output ("已輸出 " + $Out + "  " + $W + "x" + $H)
