# IG 精選封面（1080×1920，限動尺寸）
#
# 定案配色（2026-09-14 傑哥選的）：蒂芙尼綠底 #81D8D0 ＋ 品牌深綠字 #0b544f，字級 200。
# 淺底深字在白色的 IG 介面上辨識度最好，圓圈縮小也看得清楚。
#
# IG 的精選封面是從限動畫面裁一個圓出來，預設取中央，
# 所以字要放在正中央，四周留白，縮成小圓才不會被切到。
#
# 用法：
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\highlight-cover.ps1 `
#       -Text assets-src\highlights\01.txt -Out assets-src\highlights\01.png
#
# 文字檔（UTF-8）一行一列，通常兩行各兩個字。

param(
  [Parameter(Mandatory = $true)][string]$Text,
  [Parameter(Mandatory = $true)][string]$Out,
  [string]$Bg = '81D8D0',
  [string]$Fg = '0b544f',
  [int]$Size = 200
)

Add-Type -AssemblyName System.Drawing

# 字型檢查：圓體沒裝就停下來，不要默默退回正黑體
$__want = @("GenSenRounded JP R")
$__have = (New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }
foreach ($__f in $__want) {
  if ($__have -notcontains $__f) {
    Write-Error ("找不到字型「" + $__f + "」。請先安裝源泉圓體（assets-src/fonts\GenSenRounded-*.ttc，或 github.com/ButTaiwan/gensen-font），否則出圖會變成正黑體。")
    exit 1
  }
}

$lines = [System.IO.File]::ReadAllLines((Resolve-Path $Text), [System.Text.Encoding]::UTF8) |
         Where-Object { $_.Trim().Length -gt 0 }

$W = 1080; $H = 1920
$bmp = New-Object System.Drawing.Bitmap($W, $H)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'ClearTypeGridFit'

$bgc = [System.Drawing.ColorTranslator]::FromHtml("#$Bg")
$g.Clear($bgc)

$font  = New-Object System.Drawing.Font("GenSenRounded JP R", $Size, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$brush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#$Fg"))
$teal  = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 65, 186, 177))
$fmt   = New-Object System.Drawing.StringFormat
$fmt.Alignment = [System.Drawing.StringAlignment]::Center
$fmt.LineAlignment = [System.Drawing.StringAlignment]::Center

$lh = $Size * 1.22
$total = $lh * $lines.Count
$top = ($H / 2) - ($total / 2) - 30

for ($i = 0; $i -lt $lines.Count; $i++) {
  $rect = New-Object System.Drawing.RectangleF(0, [single]($top + $i * $lh), [single]$W, [single]$lh)
  $g.DrawString($lines[$i], $font, $brush, $rect, $fmt)
}

# 字下方一條湖綠短線
$barW = 140; $barH = 10
$by = $top + $total + 46
$g.FillRectangle($teal, [single](($W - $barW) / 2), [single]$by, [single]$barW, [single]$barH)

$path = Join-Path (Get-Location) $Out
$bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output ("已輸出 " + $Out + "  " + $W + "x" + $H)
