
# 臨時停診公告圖（颱風／豪雨當天用）方形 1080 + 限動 1080x1920
# 用法： powershell -File tools/notice-urgent.ps1 -Data <utf8-json> -Out <out.png>
# JSON： { kind, date, big, note, foot }
param(
  [Parameter(Mandatory=$true)][string]$Data,
  [Parameter(Mandatory=$true)][string]$Out
)

Add-Type -AssemblyName System.Drawing

$json = Get-Content -LiteralPath $Data -Raw -Encoding UTF8 | ConvertFrom-Json
$kind = $json.kind
$date = $json.date
$big  = if ($json.big)  { $json.big }  else { "全日休診" }
$note = if ($json.note) { $json.note } else { "依屏東縣政府停班停課公告" }
$foot = if ($json.foot) { $json.foot } else { "仁心骨科關心您" }

$CW = 1080; $CH = 1080
$brand = [System.Drawing.ColorTranslator]::FromHtml("#12756e")
$soft  = [System.Drawing.ColorTranslator]::FromHtml("#e3f5f3")
$ink   = [System.Drawing.ColorTranslator]::FromHtml("#172b29")
$red   = [System.Drawing.ColorTranslator]::FromHtml("#c62828")
$white = [System.Drawing.Color]::White

$bmp = New-Object System.Drawing.Bitmap($CW, $CH)
$g   = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode     = "AntiAlias"
$g.TextRenderingHint = "ClearTypeGridFit"
$g.InterpolationMode = "HighQualityBicubic"

$g.Clear($red)
$g.FillRectangle((New-Object System.Drawing.SolidBrush($white)), 26, 26, $CW-52, $CH-52)

$bRed  = New-Object System.Drawing.SolidBrush($red)
$bInk  = New-Object System.Drawing.SolidBrush($ink)
$bBran = New-Object System.Drawing.SolidBrush($brand)

function Draw-Center($text, $font, $brush, $yy, $bold) {
  $sz = $g.MeasureString($text, $font)
  $xx = ($CW - $sz.Width) / 2
  $offs = if ($bold) { @(@(0,0),@(0.9,0),@(0,0.9),@(0.9,0.9)) } else { @(@(0,0)) }
  foreach ($d in $offs) { $g.DrawString($text, $font, $brush, ($xx + $d[0]), ($yy + $d[1])) }
  return $sz.Height
}

# 種類（紅字）
$fKind = New-Object System.Drawing.Font("Microsoft JhengHei", 62, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$y = 150
$y += (Draw-Center $kind $fKind $bRed $y $true) + 46

# 日期（超大，自動縮到塞得下）
$dSize = 92
$fDate = New-Object System.Drawing.Font("Microsoft JhengHei", $dSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
while ($g.MeasureString($date, $fDate).Width -gt ($CW - 160) -and $dSize -gt 40) {
  $dSize -= 4
  $fDate.Dispose()
  $fDate = New-Object System.Drawing.Font("Microsoft JhengHei", $dSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
}
$y += (Draw-Center $date $fDate $bInk $y $true) + 30

# 主訊息（紅底白字色塊）
$fBig = New-Object System.Drawing.Font("Microsoft JhengHei", 78, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$bs = $g.MeasureString($big, $fBig)
$boxW = $bs.Width + 120
$boxH = $bs.Height + 40
$g.FillRectangle($bRed, (($CW - $boxW)/2), $y, $boxW, $boxH)
$g.DrawString($big, $fBig, (New-Object System.Drawing.SolidBrush($white)), (($CW - $bs.Width)/2), ($y + 20))
$y += $boxH + 48

# 說明
$fNote = New-Object System.Drawing.Font("Microsoft JhengHei", 34, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
Draw-Center $note $fNote $bBran $y $false | Out-Null

# logo 與標語
$logoPath = Join-Path (Split-Path -Parent $PSScriptRoot) "public\assets\logo.png"
if (Test-Path $logoPath) {
  $logo = [System.Drawing.Image]::FromFile($logoPath)
  $lh = 130
  $lw = [int]($logo.Width * $lh / $logo.Height)
  $g.DrawImage($logo, 96, ($CH - $lh - 80), $lw, $lh)
  $logo.Dispose()
}
$fFoot = New-Object System.Drawing.Font("Microsoft JhengHei", 30, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$fsz = $g.MeasureString($foot, $fFoot)
$g.DrawString($foot, $fFoot, $bBran, ($CW - $fsz.Width - 100), ($CH - $fsz.Height - 100))

$g.Dispose()
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)

$st = New-Object System.Drawing.Bitmap(1080, 1920)
$sg = [System.Drawing.Graphics]::FromImage($st)
$sg.InterpolationMode = "HighQualityBicubic"
$sg.Clear($soft)
$sg.DrawImage($bmp, 0, 420, 1080, 1080)
$sg.Dispose()
$storyOut = ($Out -replace '\.png$', '-story.png')
$st.Save($storyOut, [System.Drawing.Imaging.ImageFormat]::Png)
$st.Dispose()
$bmp.Dispose()

Write-Output ("方形： " + $Out)
Write-Output ("限動： " + $storyOut)
