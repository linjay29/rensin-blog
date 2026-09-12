# 在封面圖的指定位置寫一行字，可以旋轉——用來把字寫進插畫裡的招牌或顯示燈。
#
# 用法：
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\cover-sign.ps1 `
#       -Src public\<slug>\assets\cover.jpg -Out public\<slug>\assets\cover.jpg `
#       -Text 重要資訊 -X 340 -Y 112 -Size 44 -Angle -8 -Color "#0B544F"
param(
  [Parameter(Mandatory=$true)][string]$Src,
  [Parameter(Mandatory=$true)][string]$Out,
  [Parameter(Mandatory=$true)][string]$Text,
  [double]$X = 340, [double]$Y = 112,
  [int]$Size = 44, [double]$Angle = -8,
  [string]$Color = "#0B544F",
  [string]$Font = "Microsoft JhengHei"
)
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile((Resolve-Path $Src))
$bmp = New-Object System.Drawing.Bitmap $img.Width, $img.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'ClearTypeGridFit'
$g.DrawImage($img, 0, 0, $img.Width, $img.Height)
$c = [System.Drawing.ColorTranslator]::FromHtml($Color)
$brush = New-Object System.Drawing.SolidBrush $c
$fnt = New-Object System.Drawing.Font($Font, $Size, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$sz = $g.MeasureString($Text, $fnt)
$g.TranslateTransform([single]$X, [single]$Y)
$g.RotateTransform([single]$Angle)
$g.DrawString($Text, $fnt, $brush, [single](-$sz.Width/2), [single](-$sz.Height/2))
$g.ResetTransform()
$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$pr = New-Object System.Drawing.Imaging.EncoderParameters 1
$pr.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 88)
$tmp = [System.IO.Path]::GetTempFileName() + ".jpg"
$bmp.Save($tmp, $enc, $pr)
$g.Dispose(); $bmp.Dispose(); $img.Dispose()
Move-Item -Force $tmp $Out
Write-Host "已輸出 $Out"
