
# 產生「每月營運公告」表格版社群圖（方形 1080 + 限動 1080x1920）
# 用法： powershell -File tools/notice-table.ps1 -Data <utf8-json> -Out <out.png>
# JSON： { title, columns:[..], rows:[[..],[..]], foot }
#        儲存格用 <r>…</r> 標紅字
param(
  [Parameter(Mandatory=$true)][string]$Data,
  [Parameter(Mandatory=$true)][string]$Out
)

Add-Type -AssemblyName System.Drawing

$json = Get-Content -LiteralPath $Data -Raw -Encoding UTF8 | ConvertFrom-Json
$title = $json.title
$cols  = $json.columns
$rows  = $json.rows
$foot  = if ($json.foot) { $json.foot } else { "仁心骨科關心您" }
$note  = if ($json.note) { $json.note } else { "" }

$CW = 1080; $CH = 1080
$brand = [System.Drawing.ColorTranslator]::FromHtml("#12756e")
$soft  = [System.Drawing.ColorTranslator]::FromHtml("#e3f5f3")
$line  = [System.Drawing.ColorTranslator]::FromHtml("#d9e8e6")
$ink   = [System.Drawing.ColorTranslator]::FromHtml("#172b29")
$red   = [System.Drawing.ColorTranslator]::FromHtml("#c62828")
$white = [System.Drawing.Color]::White

$bmp = New-Object System.Drawing.Bitmap($CW, $CH)
$g   = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode     = "AntiAlias"
$g.TextRenderingHint = "ClearTypeGridFit"
$g.InterpolationMode = "HighQualityBicubic"

$g.Clear($brand)
$g.FillRectangle((New-Object System.Drawing.SolidBrush($white)), 28, 28, $CW-56, $CH-56)

$bWhite = New-Object System.Drawing.SolidBrush($white)
$bRed   = New-Object System.Drawing.SolidBrush($red)
$bInk   = New-Object System.Drawing.SolidBrush($ink)
$bBran  = New-Object System.Drawing.SolidBrush($brand)
$bSoft  = New-Object System.Drawing.SolidBrush($soft)

$fTitle = New-Object System.Drawing.Font("Microsoft JhengHei", 58, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$fHead  = New-Object System.Drawing.Font("Microsoft JhengHei", 34, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$fFoot  = New-Object System.Drawing.Font("Microsoft JhengHei", 30, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)

# 標題（紅字置中，仿粗）
$ts = $g.MeasureString($title, $fTitle)
$tx = ($CW - $ts.Width) / 2
$ty = 96
foreach ($d in @(@(0,0),@(0.8,0),@(0,0.8),@(0.8,0.8))) {
  $g.DrawString($title, $fTitle, $bRed, ($tx + $d[0]), ($ty + $d[1]))
}

# ---- 表格 -------------------------------------------------------------
$tableL = 90
$tableR = $CW - 90
$tableW = $tableR - $tableL
$nCol   = $cols.Count

# 字級自動縮：量每一欄最寬的內容
$cellSize = 34
function Get-Plain($t) { return ($t -replace '</?r>', '') }
$fitted = $false
while (-not $fitted -and $cellSize -gt 20) {
  $fCell = New-Object System.Drawing.Font("Microsoft JhengHei", $cellSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $need = @()
  for ($c = 0; $c -lt $nCol; $c++) {
    $mx = $g.MeasureString((Get-Plain $cols[$c]), $fCell).Width
    foreach ($r in $rows) {
      $vw = $g.MeasureString((Get-Plain $r[$c]), $fCell).Width
      if ($vw -gt $mx) { $mx = $vw }
    }
    $need += ($mx + 44)
  }
  $sum = 0; foreach ($n in $need) { $sum += $n }
  if ($sum -le $tableW) { $fitted = $true } else { $cellSize -= 2; $fCell.Dispose() }
}

# 欄寬：先按需求，剩餘平均攤給各欄
$colW = @()
$sum = 0; foreach ($n in $need) { $sum += $n }
$extra = ($tableW - $sum) / $nCol
foreach ($n in $need) { $colW += ($n + $extra) }

$rowH  = [int]($cellSize * 2.3)
$headH = [int]($cellSize * 2.5)
$tableH = $headH + ($rows.Count * $rowH)
$tableT = $ty + $ts.Height + 70

# 表頭底色
$g.FillRectangle($bBran, $tableL, $tableT, $tableW, $headH)

# 表頭文字
$x = $tableL
for ($c = 0; $c -lt $nCol; $c++) {
  $t = Get-Plain $cols[$c]
  $tw = $g.MeasureString($t, $fHead).Width
  $th = $g.MeasureString($t, $fHead).Height
  $g.DrawString($t, $fHead, $bWhite, ($x + ($colW[$c] - $tw)/2), ($tableT + ($headH - $th)/2))
  $x += $colW[$c]
}

# 資料列
$penLine = New-Object System.Drawing.Pen($line, 2)
$yy = $tableT + $headH
for ($ri = 0; $ri -lt $rows.Count; $ri++) {
  if ($ri % 2 -eq 1) { $g.FillRectangle($bSoft, $tableL, $yy, $tableW, $rowH) }
  $x = $tableL
  for ($c = 0; $c -lt $nCol; $c++) {
    $raw = $rows[$ri][$c]
    $plain = Get-Plain $raw
    $tw = $g.MeasureString($plain, $fCell).Width
    $th = $g.MeasureString($plain, $fCell).Height
    $cx = $x + ($colW[$c] - $tw)/2
    $cy = $yy + ($rowH - $th)/2
    $parts = [regex]::Split($raw, '(<r>|</r>)')
    $isRed = $false
    foreach ($p in $parts) {
      if ($p -eq '<r>')  { $isRed = $true;  continue }
      if ($p -eq '</r>') { $isRed = $false; continue }
      if ([string]::IsNullOrEmpty($p)) { continue }
      $brush = if ($isRed) { $bRed } else { $bInk }
      foreach ($d in @(@(0,0),@(0.7,0),@(0,0.7))) {
        $g.DrawString($p, $fCell, $brush, ($cx + $d[0]), ($cy + $d[1]))
      }
      $cx += $g.MeasureString($p, $fCell).Width - 10
    }
    $x += $colW[$c]
  }
  $g.DrawLine($penLine, $tableL, ($yy + $rowH), $tableR, ($yy + $rowH))
  $yy += $rowH
}
$penEdge = New-Object System.Drawing.Pen($brand, 3)
$g.DrawRectangle($penEdge, $tableL, $tableT, $tableW, $tableH)

# 表格下方的提醒句
if ($note -ne "") {
  $fNote = New-Object System.Drawing.Font("Microsoft JhengHei", 30, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $nw = $g.MeasureString($note, $fNote).Width
  $ny = $tableT + $tableH + 62
  $g.DrawString($note, $fNote, $bInk, (($CW - $nw)/2), $ny)
  $fNote.Dispose()
}

# ---- logo 與標語 ------------------------------------------------------
$logoPath = Join-Path (Split-Path -Parent $PSScriptRoot) "public\assets\logo.png"
if (Test-Path $logoPath) {
  $logo = [System.Drawing.Image]::FromFile($logoPath)
  $lh = 130
  $lw = [int]($logo.Width * $lh / $logo.Height)
  $g.DrawImage($logo, 96, ($CH - $lh - 80), $lw, $lh)
  $logo.Dispose()
}
$fsz = $g.MeasureString($foot, $fFoot)
$g.DrawString($foot, $fFoot, $bBran, ($CW - $fsz.Width - 100), ($CH - $fsz.Height - 100))

$g.Dispose()
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)

# 限動版
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
