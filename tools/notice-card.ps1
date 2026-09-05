
# 產生「每月營運公告」社群圖（FB／IG 方形 1080，另出限動 1080x1920）
# 用法： powershell -File tools/notice-card.ps1 -Data <utf8-json> -Out <out.png>
param(
  [Parameter(Mandatory=$true)][string]$Data,
  [Parameter(Mandatory=$true)][string]$Out
)

Add-Type -AssemblyName System.Drawing

$json  = Get-Content -LiteralPath $Data -Raw -Encoding UTF8 | ConvertFrom-Json
$title = $json.title
$items = $json.items
$foot  = if ($json.foot) { $json.foot } else { "仁心骨科關心您" }

$W = 1080; $H = 1080
$brand   = [System.Drawing.ColorTranslator]::FromHtml("#12756e")
$soft    = [System.Drawing.ColorTranslator]::FromHtml("#e3f5f3")
$ink     = [System.Drawing.ColorTranslator]::FromHtml("#172b29")
$red     = [System.Drawing.ColorTranslator]::FromHtml("#c62828")
$white   = [System.Drawing.Color]::White

$bmp = New-Object System.Drawing.Bitmap($W, $H)
$g   = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode     = "AntiAlias"
$g.TextRenderingHint = "ClearTypeGridFit"
$g.InterpolationMode = "HighQualityBicubic"

# 底：外框用診所主色，內層留白
$g.Clear($brand)
$g.FillRectangle((New-Object System.Drawing.SolidBrush($white)), 28, 28, $W-56, $H-56)
# 內側細框
$penSoft = New-Object System.Drawing.Pen($soft, 6)
$g.DrawRectangle($penSoft, 46, 46, $W-92, $H-92)

$fTitle = New-Object System.Drawing.Font("Microsoft JhengHei", 60, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$itemSize = 44
$fFoot  = New-Object System.Drawing.Font("Microsoft JhengHei", 30, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)

$bRed  = New-Object System.Drawing.SolidBrush($red)
$bInk  = New-Object System.Drawing.SolidBrush($ink)
$bBran = New-Object System.Drawing.SolidBrush($brand)

# 標題置中（紅字，仿粗）
$ts = $g.MeasureString($title, $fTitle)
$tx = ($W - $ts.Width) / 2
$ty = 120
foreach ($d in @(@(0,0),@(0.8,0),@(0,0.8),@(0.8,0.8))) {
  $g.DrawString($title, $fTitle, $bRed, ($tx + $d[0]), ($ty + $d[1]))
}

# 標題下的分隔線
$penLine = New-Object System.Drawing.Pen($brand, 5)
$g.DrawLine($penLine, 150, ($ty + $ts.Height + 26), ($W - 150), ($ty + $ts.Height + 26))

# 條列：以 <r>…</r> 標紅字。字級自動縮到塞得下最長的一行
$left  = 140
$avail = $W - $left - 40 - 96
$plain = @()
foreach ($raw in $items) { $plain += ($raw -replace '</?r>', '') }
$fItem = New-Object System.Drawing.Font("Microsoft JhengHei", $itemSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$maxW = 0
foreach ($t in $plain) { $mw = $g.MeasureString($t, $fItem).Width; if ($mw -gt $maxW) { $maxW = $mw } }
while ($maxW -gt $avail -and $itemSize -gt 26) {
  $itemSize -= 2
  $fItem.Dispose()
  $fItem = New-Object System.Drawing.Font("Microsoft JhengHei", $itemSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $maxW = 0
  foreach ($t in $plain) { $mw = $g.MeasureString($t, $fItem).Width; if ($mw -gt $maxW) { $maxW = $mw } }
}

# 垂直置中於「標題線」與「logo 上緣」之間
$lineGap = [int]($itemSize * 2.1)
$zoneTop = $ty + $ts.Height + 70
$zoneBot = $H - 250
$blockH  = $items.Count * $lineGap
$y = $zoneTop + (($zoneBot - $zoneTop) - $blockH) / 3
if ($y -lt $zoneTop) { $y = $zoneTop }
foreach ($raw in $items) {
  # 項目符號
  $dot = [int]($itemSize * 0.34)
  $g.FillEllipse($bBran, $left, ($y + $itemSize * 0.42), $dot, $dot)
  $x = $left + $dot + 26
  $parts = [regex]::Split($raw, '(<r>|</r>)')
  $isRed = $false
  foreach ($p in $parts) {
    if ($p -eq '<r>')  { $isRed = $true;  continue }
    if ($p -eq '</r>') { $isRed = $false; continue }
    if ([string]::IsNullOrEmpty($p)) { continue }
    $brush = if ($isRed) { $bRed } else { $bInk }
    foreach ($d in @(@(0,0),@(0.7,0),@(0,0.7))) {
      $g.DrawString($p, $fItem, $brush, ($x + $d[0]), ($y + $d[1]))
    }
    $x += $g.MeasureString($p, $fItem).Width - 12
  }
  $y += $lineGap
}

# 左下 logo
$logoPath = Join-Path (Split-Path -Parent $PSScriptRoot) "public\assets\logo.png"
if (Test-Path $logoPath) {
  $logo = [System.Drawing.Image]::FromFile($logoPath)
  $lh = 130
  $lw = [int]($logo.Width * $lh / $logo.Height)
  $g.DrawImage($logo, 96, ($H - $lh - 90), $lw, $lh)
  $logo.Dispose()
}

# 右下標語
$fs = $g.MeasureString($foot, $fFoot)
$g.DrawString($foot, $fFoot, $bBran, ($W - $fs.Width - 100), ($H - $fs.Height - 110))

$g.Dispose()
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)

# 限動版：1080x1920，方形置中
$SH = 1920
$st = New-Object System.Drawing.Bitmap(1080, $SH)
$sg = [System.Drawing.Graphics]::FromImage($st)
$sg.SmoothingMode = "AntiAlias"
$sg.InterpolationMode = "HighQualityBicubic"
$sg.Clear($soft)
$sg.DrawImage($bmp, 0, 420, 1080, 1080)
$sg.Dispose()
$storyOut = [System.IO.Path]::ChangeExtension($Out, $null) + "story.png"
$storyOut = $storyOut -replace '\.story\.png$', '-story.png'
$st.Save($storyOut, [System.Drawing.Imaging.ImageFormat]::Png)
$st.Dispose()
$bmp.Dispose()

Write-Output ("方形： " + $Out)
Write-Output ("限動： " + $storyOut)
