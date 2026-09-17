Add-Type -AssemblyName System.Drawing

$SourcePng = Resolve-Path "public\desktop app icon.png"
$DestIco = Resolve-Path "local-first\platform\apps\desktop\resources\icon.ico"

$sizes = @(256, 128, 64, 48, 32, 16)
$srcImg = [System.Drawing.Image]::FromFile($SourcePng)
$pngStreams = @()

foreach ($sz in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap $sz, $sz
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($srcImg, 0, 0, $sz, $sz)
    $g.Dispose()
    
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $pngStreams += $ms.ToArray()
    $ms.Dispose()
}
$srcImg.Dispose()

$fs = [System.IO.File]::Create($DestIco)
$bw = New-Object System.IO.BinaryWriter $fs

# ICONDIR
$bw.Write([uint16]0) # reserved
$bw.Write([uint16]1) # type 1 = icon
$bw.Write([uint16]$sizes.Count) # count

# Calculate offset
$offset = 6 + ($sizes.Count * 16)

for ($i = 0; $i -lt $sizes.Count; $i++) {
    $sz = $sizes[$i]
    $w = if ($sz -ge 256) { [byte]0 } else { [byte]$sz }
    $h = if ($sz -ge 256) { [byte]0 } else { [byte]$sz }
    $bw.Write($w)
    $bw.Write($h)
    $bw.Write([byte]0) # colors
    $bw.Write([byte]0) # reserved
    $bw.Write([uint16]1) # planes
    $bw.Write([uint16]32) # bpp
    $bw.Write([uint32]$pngStreams[$i].Length) # bytes
    $bw.Write([uint32]$offset) # offset
    $offset += $pngStreams[$i].Length
}

for ($i = 0; $i -lt $sizes.Count; $i++) {
    $bw.Write($pngStreams[$i])
}

$bw.Flush()
$bw.Close()
$fs.Close()
Write-Output "ICO successfully generated at $DestIco"
