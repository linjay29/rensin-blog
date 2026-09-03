# 社群方形圖（2048×2048，FB／IG 通用）
#
# 版型：上圖下文。上半是文章封面的無字原圖，下半是米色底，
# 放標題、湖綠短線、二到四條重點、左下 logo 與署名。
#
# 為什麼不是「左文右圖」：那個版型要人物剛好在畫面一側才成立
# （手指鈣化那張的阿姨在右側，所以可行）。多數 Gemini 生的圖
# 人物在正中央，左右都留不出放大字的空間，硬塞會壓到人。
# 上下分區對任何構圖都成立，手機上字也夠大。
#
# 用法：
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\social-card.ps1 `
#       -Src   assets-src\<slug>\cover-src.jpg `
#       -Text  assets-src\<slug>\social-card.txt `
#       -Out   assets-src\<slug>\social-fb.png
#
# 文字檔（UTF-8，一行一項，空行略過）：
#   第 1 行    標題
#   第 2~n-1   重點條列（建議 3 條，每條不超過 18 字，太長會撞到右邊）
#   最後一行   署名
#
# 中文一定要從檔案讀進來，不要寫在命令列或腳本裡——
# PowerShell 傳中文參數會被編碼吃掉，變成問號。

param(
  [Parameter(Mandatory = $true)][string]$Src,
  [Parameter(Mandatory = $true)][string]$Text,
  [Parameter(Mandatory = $true)][string]$Out,
  [int]$ImageHeight = 1120      # 上半圖片區的高度，人物腳被切到就調小
)

Add-Type -AssemblyName System.Drawing

$lines = [System.IO.File]::ReadAllLines((Resolve-Path $Text), [System.Text.Encoding]::UTF8) |
         Where-Object { $_.Trim().Length -gt 0 }
if ($lines.Count -lt 3) { throw "文字檔至少要有標題、一條重點、署名三行" }

$title   = $lines[0]
$sign    = $lines[$lines.Count - 1]
$bullets = $lines[1..($lines.Count - 2)]

$S   = 2048
$bmp = New-Object System.Drawing.Bitmap($S, $S)
$g   = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = 'HighQualityBicubic'
$g.SmoothingMode     = 'AntiAlias'
$g.TextRenderingHint = 'ClearTypeGridFit'
$g.Clear([System.Drawing.Color]::FromArgb(255, 242, 240, 237))

# 上半：封面原圖等比放大到滿寬，超出的下緣裁掉
$img    = [System.Drawing.Image]::FromFile((Resolve-Path $Src))
$drawnH = [int][Math]::Round($img.Height * $S / $img.Width)
$g.SetClip((New-Object System.Drawing.Rectangle(0, 0, $S, $ImageHeight)))
$g.DrawImage($img, 0, 0, $S, $drawnH)
$g.ResetClip()

$ink  = [System.Drawing.Color]::FromArgb(255, 23, 43, 41)    # 內文深墨
$mid  = [System.Drawing.Color]::FromArgb(255, 69, 98, 96)    # 次要文字
$teal = [System.Drawing.Color]::FromArgb(255, 65, 186, 177)  # 名片湖綠，只當點綴

$fmt    = [System.Drawing.StringFormat]::GenericTypographic
$fTitle = New-Object System.Drawing.Font("Microsoft JhengHei", 148, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$fBul   = New-Object System.Drawing.Font("Microsoft JhengHei", 62, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$fSign  = New-Object System.Drawing.Font("Microsoft JhengHei", 58, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$brInk  = New-Object System.Drawing.SolidBrush ($ink)
$brMid  = New-Object System.Drawing.SolidBrush ($mid)
$brTeal = New-Object System.Drawing.SolidBrush ($teal)

$x = 148.0
$y = $ImageHeight + 84.0
$g.DrawString($title, $fTitle, $brInk, [single]$x, [single]$y, $fmt)

$lineY = $y + 196
$pen   = New-Object System.Drawing.Pen ($teal), 9
$g.DrawLine($pen, [single]$x, [single]$lineY, [single]($x + 150), [single]$lineY)

$by = $lineY + 80
foreach ($b in $bullets) {
  $g.FillEllipse($brTeal, [single]($x + 4), [single]($by + 24), 20, 20)
  $g.DrawString($b, $fBul, $brMid, [single]($x + 58), [single]$by, $fmt)
  $by += 108
}

$logoPath = Join-Path (Split-Path $PSScriptRoot -Parent) "public\assets\logo.png"
$lg   = [System.Drawing.Image]::FromFile($logoPath)
$lgH  = 112
$lgW  = [int][Math]::Round($lg.Width * $lgH / $lg.Height)
$logoY = 1846
$g.DrawImage($lg, [int]$x, $logoY, $lgW, $lgH)
$g.DrawString($sign, $fSign, $brMid, [single]($x + $lgW + 40), [single]($logoY + 28), $fmt)

if ($by -gt $logoY - 40) {
  Write-Warning "條列太多或太長，快撞到 logo 了——減少條列，或把 -ImageHeight 調小"
}

$bmp.Save((Join-Path (Get-Location) $Out), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose(); $img.Dispose(); $lg.Dispose()
Write-Output ("已輸出 " + $Out)
