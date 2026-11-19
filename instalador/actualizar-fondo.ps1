# Cronograma institucional CCDB - Actualiza el fondo de escritorio.
#
# Se ejecuta oculto al iniciar sesion y cada hora entre las 7:00 a. m. y las 6:00 p. m.
# - Si ya tiene el fondo de hoy, termina de inmediato (no usa internet).
# - Si no, consulta la fecha de la imagen publicada y, si es mas nueva que la
#   que tiene, la descarga y la pone como fondo.
# - Si no hay internet, deja el fondo actual y lo intenta en la siguiente hora.
#
# Uso manual: actualizar-fondo.ps1 -Forzar   (descarga aunque ya tenga la de hoy)
#
# Seguridad: este script nunca ejecuta nada de lo que descarga. Solo lee una
# fecha (actual.json, maximo 4 KB) y una imagen, que debe ser un JPG real de
# maximo 3 MB; si no cumple, se descarta y se conserva el fondo anterior.

param([switch]$Forzar)

$ErrorActionPreference = 'Stop'
$Base = 'https://dbtech-cali.github.io/calendar/fondos/'
$Carpeta = Join-Path $env:LOCALAPPDATA 'CronogramaCCDB'
$Estado = Join-Path $Carpeta 'estado.txt'
$Registro = Join-Path $Carpeta 'registro.txt'
$MaxJson = 4KB
$MaxImagen = 3MB

# Descarga una direccion a un archivo, cortando si supera el tamano maximo.
function Descargar([string]$Url, [string]$Ruta, [long]$Maximo) {
    $solicitud = [Net.HttpWebRequest]::Create($Url)
    $solicitud.Timeout = 60000
    $solicitud.ReadWriteTimeout = 60000
    $respuesta = $solicitud.GetResponse()
    try {
        if ($respuesta.ContentLength -gt $Maximo) { throw "El archivo es demasiado grande ($($respuesta.ContentLength) bytes)." }
        $entrada = $respuesta.GetResponseStream()
        $salida = [IO.File]::Create($Ruta)
        try {
            $bufer = New-Object byte[] 65536
            $total = 0
            while (($leidos = $entrada.Read($bufer, 0, $bufer.Length)) -gt 0) {
                $total += $leidos
                if ($total -gt $Maximo) { throw 'El archivo supera el tamano permitido.' }
                $salida.Write($bufer, 0, $leidos)
            }
        } finally { $salida.Close(); $entrada.Close() }
    } catch {
        Remove-Item -Path $Ruta -Force -ErrorAction SilentlyContinue
        throw
    } finally { $respuesta.Close() }
}

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

    $rutaJson = Join-Path $Carpeta 'actual.json'
    try {
        Descargar ($Base + 'actual.json?t=' + $marca) $rutaJson $MaxJson
    } catch {
        Anotar ('Sin conexion; se reintentara mas tarde. ' + $_.Exception.Message)
        exit 0
    }
    $info = [IO.File]::ReadAllText($rutaJson) | ConvertFrom-Json
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
    Descargar ($Base + $nombre + '?t=' + $marca) $temporal $MaxImagen

    # Validar que sea una imagen JPG real y completa antes de usarla.
    $bytes = [IO.File]::ReadAllBytes($temporal)
    $esJpg = $bytes.Length -gt 20000 -and
        $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xD8 -and $bytes[2] -eq 0xFF -and
        $bytes[$bytes.Length - 2] -eq 0xFF -and $bytes[$bytes.Length - 1] -eq 0xD9
    if (-not $esJpg) {
        Remove-Item -Path $temporal -Force -ErrorAction SilentlyContinue
        throw 'El archivo descargado no es una imagen JPG valida; se conserva el fondo anterior.'
    }
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
