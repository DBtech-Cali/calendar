# Cronograma institucional CCDB - Actualiza el fondo de escritorio.
#
# Se ejecuta oculto al iniciar sesion y cada hora entre las 7:00 a. m. y las 6:00 p. m.
# - Si ya tiene el fondo de hoy, termina de inmediato (no usa internet).
# - Si no, consulta la fecha de la imagen publicada y, si es mas nueva que la
#   que tiene, la descarga y la pone como fondo.
# - Si no hay internet, deja el fondo actual y lo intenta en la siguiente hora.
#
# Uso manual: actualizar-fondo.ps1 -Forzar   (descarga aunque ya tenga la de hoy)

param([switch]$Forzar)

$ErrorActionPreference = 'Stop'
$Base = 'https://dbtech-cali.github.io/calendar/fondos/'
$Carpeta = Join-Path $env:LOCALAPPDATA 'CronogramaCCDB'
$Estado = Join-Path $Carpeta 'estado.txt'
$Registro = Join-Path $Carpeta 'registro.txt'

function Anotar([string]$Mensaje) {
    $linea = '{0:yyyy-MM-dd HH:mm}  {1}' -f (Get-Date), $Mensaje
    Add-Content -Path $Registro -Value $linea -Encoding UTF8
    $lineas = @(Get-Content -Path $Registro -Encoding UTF8)
    if ($lineas.Count -gt 300) { $lineas | Select-Object -Last 200 | Set-Content -Path $Registro -Encoding UTF8 }
}

try {
    New-Item -ItemType Directory -Force -Path $Carpeta | Out-Null
    $hoy = (Get-Date).ToString('yyyy-MM-dd')
    $ultima = ''
    if (Test-Path $Estado) { $ultima = ([string](Get-Content -Path $Estado -Raw)).Trim() }

    # Ya tiene el fondo de hoy: no hace nada.
    if (-not $Forzar -and $ultima -eq $hoy) { exit 0 }

    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $marca = [DateTime]::Now.Ticks

    try {
        $info = Invoke-RestMethod -Uri ($Base + 'actual.json?t=' + $marca) -UseBasicParsing -TimeoutSec 30
    } catch {
        Anotar ('Sin conexion; se reintentara mas tarde. ' + $_.Exception.Message)
        exit 0
    }
    $fecha = [string]$info.fecha
    if ($fecha -notmatch '^\d{4}-\d{2}-\d{2}$') { throw "Respuesta inesperada del servidor: $fecha" }

    if (-not $Forzar -and $fecha -eq $ultima) {
        Anotar "La imagen publicada ($fecha) ya esta puesta; se esperara la de hoy."
        exit 0
    }

    # Elegir la imagen segun la resolucion de la pantalla.
    $nombre = 'actual-1920x1080.jpg'
    try {
        $video = Get-CimInstance -ClassName Win32_VideoController | Where-Object { $_.CurrentHorizontalResolution } | Select-Object -First 1
        if ($video -and [int]$video.CurrentHorizontalResolution -lt 1600) { $nombre = 'actual-1366x768.jpg' }
    } catch { }

    # Un nombre por dia, para que Windows no use una copia guardada.
    $destino = Join-Path $Carpeta ('fondo-' + $fecha + '.jpg')
    $temporal = $destino + '.descargando'
    Invoke-WebRequest -Uri ($Base + $nombre + '?t=' + $marca) -OutFile $temporal -UseBasicParsing -TimeoutSec 120
    if ((Get-Item $temporal).Length -lt 20000) { Remove-Item $temporal -Force; throw 'La imagen descargada esta incompleta.' }
    Move-Item -Path $temporal -Destination $destino -Force

    # Poner el fondo en modo "Rellenar".
    if (-not ('FondoCCDB' -as [type])) {
        Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
public static class FondoCCDB {
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool SystemParametersInfo(int accion, int param, string archivo, int opciones);
}
'@
    }
    Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name WallpaperStyle -Value '10'
    Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name TileWallpaper -Value '0'
    # 20 = SPI_SETDESKWALLPAPER; 3 = guardar y avisar a Windows.
    if (-not [FondoCCDB]::SystemParametersInfo(20, 0, $destino, 3)) { throw 'Windows no acepto el cambio de fondo.' }

    Set-Content -Path $Estado -Value $fecha -Encoding ASCII
    Get-ChildItem -Path $Carpeta -Filter 'fondo-*.jpg' | Where-Object { $_.FullName -ne $destino } | Remove-Item -Force -ErrorAction SilentlyContinue
    Anotar "Fondo actualizado: $fecha ($nombre)"
} catch {
    try { Anotar ('Error: ' + $_.Exception.Message) } catch { }
    exit 1
}
