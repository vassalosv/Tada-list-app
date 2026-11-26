# Rebuild Android launcher sizes and splash screens from the supplied brand art.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$project = Split-Path -Parent $PSScriptRoot
$resources = Join-Path $project 'android\app\src\main\res'
$source = [System.Drawing.Image]::FromFile((Join-Path $project 'public\tada-icon.png'))
try {
    foreach ($spec in @(@('mdpi',48),@('hdpi',72),@('xhdpi',96),@('xxhdpi',144),@('xxxhdpi',192))) {
        foreach ($name in @('ic_launcher','ic_launcher_round','ic_launcher_foreground')) {
            $size = [int]$spec[1]
            $bitmap = New-Object System.Drawing.Bitmap $size,$size
            $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
            try {
                $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $graphics.DrawImage($source,0,0,$size,$size)
                $bitmap.Save((Join-Path $resources "mipmap-$($spec[0])\$name.png"),[System.Drawing.Imaging.ImageFormat]::Png)
            } finally { $graphics.Dispose(); $bitmap.Dispose() }
        }
    }
    Copy-Item -LiteralPath (Join-Path $project 'public\tada-icon.png') -Destination (Join-Path $resources 'drawable\tada_icon.png')
    foreach ($path in Get-ChildItem -LiteralPath $resources -Filter splash.png -Recurse) {
        $old = [System.Drawing.Image]::FromFile($path.FullName)
        $width = $old.Width; $height = $old.Height; $old.Dispose()
        $bitmap = New-Object System.Drawing.Bitmap $width,$height
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
            $graphics.Clear([System.Drawing.Color]::FromArgb(244,248,246))
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $size = [int]([Math]::Min($width,$height)*0.28)
            $graphics.DrawImage($source,[int](($width-$size)/2),[int](($height-$size)/2),$size,$size)
            $bitmap.Save($path.FullName,[System.Drawing.Imaging.ImageFormat]::Png)
        } finally { $graphics.Dispose(); $bitmap.Dispose() }
    }
} finally { $source.Dispose() }
Write-Output 'TaDa Android icons and launch screens updated.'
