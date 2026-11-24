# Cronograma institucional CCDB - Actualiza el fondo de escritorio.
#
# Se ejecuta oculto al iniciar sesion y cada hora entre las 7:00 a. m. y las 6:00 p. m.,
# y a mano con el acceso directo "Actualizar fondo del cronograma" (-Forzar).
#
# - Si ya tiene el fondo de hoy, termina de inmediato (no usa internet),
#   salvo que se ejecute con -Forzar.
# - Descarga la imagen de SU FECHA (fondos/AAAA-MM-DD-1920x1080.jpg). GitHub la
#   publica desde el dia anterior, asi que esta lista desde temprano.
# - Si esa imagen no existe, usa la ultima publicada (actual.json) y reintenta
#   en la siguiente hora.
# - Si no hay internet, deja el fondo actual y lo intenta en la siguiente hora.
#
# Seguridad: este script nunca ejecuta nada de lo que descarga. Solo lee una
# fecha (actual.json, maximo 4 KB) y una imagen, que debe ser un JPG real de
# maximo 3 MB; si no cumple, se descarta y se conserva el fondo anterior.
#
# Codigos de salida: 0 = fondo del dia puesto (o ya estaba); 2 = sin conexion;
#                    3 = se puso la imagen mas reciente, pero aun no la del dia;
#                    1 = otro error (ver registro.txt).

param([switch]$Forzar)

$ErrorActionPreference = 'Stop'
$Base = 'https://dbtech-cali.github.io/calendar/fondos/'
$Carpeta = Join-Path $env:LOCALAPPDATA 'CronogramaCCDB'
$Estado = Join-Path $Carpeta 'estado.txt'
$Registro = Join-Path $Carpeta 'registro.txt'
$MaxJson = 4KB
$MaxImagen = 3MB

function Anotar([string]$Mensaje) {
    $linea = '{0:yyyy-MM-dd HH:mm}  {1}' -f (Get-Date), $Mensaje
    Add-Content -Path $Registro -Value $linea -Encoding UTF8
    $lineas = @(Get-Content -Path $Registro -Encoding UTF8)
    if ($lineas.Count -gt 300) { $lineas | Select-Object -Last 200 | Set-Content -Path $Registro -Encoding UTF8 }
}

# Devuelve el codigo HTTP de un error de descarga (404, 500...) o 0 si no hubo respuesta.
function CodigoHttp($ErrorRegistro) {
    $ex = $ErrorRegistro.Exception
    while ($ex -and -not ($ex -is [Net.WebException])) { $ex = $ex.InnerException }
    if ($ex -and $ex.Response) { return [int]$ex.Response.StatusCode }
    return 0
}

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

# Descarga una imagen y valida que sea un JPG real y completo (FF D8 FF ... FF D9).
function BajarImagen([string]$Url, [string]$Destino) {
    $temporal = $Destino + '.descargando'
    Descargar $Url $temporal $MaxImagen
    $bytes = [IO.File]::ReadAllBytes($temporal)
    $esJpg = $bytes.Length -gt 20000 -and
        $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xD8 -and $bytes[2] -eq 0xFF -and
        $bytes[$bytes.Length - 2] -eq 0xFF -and $bytes[$bytes.Length - 1] -eq 0xD9
    if (-not $esJpg) {
        Remove-Item -Path $temporal -Force -ErrorAction SilentlyContinue
        throw 'El archivo descargado no es una imagen JPG valida; se conserva el fondo anterior.'
    }
    Move-Item -Path $temporal -Destination $Destino -Force
}

# Pone una imagen como fondo, en modo "Rellenar".
function PonerFondo([string]$Ruta) {
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
    if (-not [FondoCCDB]::SystemParametersInfo(20, 0, $Ruta, 3)) { throw 'Windows no acepto el cambio de fondo.' }
    Get-ChildItem -Path $Carpeta -Filter 'fondo-*.jpg' | Where-Object { $_.FullName -ne $Ruta } | Remove-Item -Force -ErrorAction SilentlyContinue
}

try {
    New-Item -ItemType Directory -Force -Path $Carpeta | Out-Null
    $hoy = (Get-Date).ToString('yyyy-MM-dd')
    $ultima = ''
    if (Test-Path $Estado) { $ultima = ([string](Get-Content -Path $Estado -Raw)).Trim() }

    # Ya tiene el fondo de hoy: no hace nada (salvo que se pida a mano).
    if (-not $Forzar -and $ultima -eq $hoy) { exit 0 }

    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $marca = [DateTime]::Now.Ticks

    # Elegir la imagen segun la resolucion de la pantalla.
    $tamano = '1920x1080'
    try {
        $video = Get-CimInstance -ClassName Win32_VideoController | Where-Object { $_.CurrentHorizontalResolution } | Select-Object -First 1
        if ($video -and [int]$video.CurrentHorizontalResolution -lt 1600) { $tamano = '1366x768' }
    } catch { }

    # 1. La imagen de hoy (publicada desde el dia anterior).
    # Nombre con hora: cada descarga es un archivo nuevo, para que Windows no use una copia guardada.
    $destino = Join-Path $Carpeta ('fondo-' + $hoy + '-' + $marca + '.jpg')
    try {
        BajarImagen ($Base + $hoy + '-' + $tamano + '.jpg?t=' + $marca) $destino
        PonerFondo $destino
        Set-Content -Path $Estado -Value $hoy -Encoding ASCII
        Anotar "Fondo actualizado: $hoy ($tamano)$(if ($Forzar) { ' [a mano]' })"
        exit 0
    } catch {
        $codigo = CodigoHttp $_
        if ($codigo -eq 0 -and $_.Exception.Message -notmatch 'JPG|grande|tamano') {
            Anotar ('Sin conexion; se reintentara mas tarde. ' + $_.Exception.Message)
            exit 2
        }
        if ($codigo -ne 404) { throw }
        # 404: la imagen de hoy aun no esta publicada; se usa la ultima disponible.
    }

    # 2. Respaldo: la ultima imagen publicada.
    $rutaJson = Join-Path $Carpeta 'actual.json'
    try {
        Descargar ($Base + 'actual.json?t=' + $marca) $rutaJson $MaxJson
    } catch {
        Anotar ('Sin conexion; se reintentara mas tarde. ' + $_.Exception.Message)
        exit 2
    }
    $info = [IO.File]::ReadAllText($rutaJson) | ConvertFrom-Json
    $fecha = [string]$info.fecha
    if ($fecha -notmatch '^\d{4}-\d{2}-\d{2}$') { throw "Respuesta inesperada del servidor: $fecha" }
    if (-not $Forzar -and $fecha -eq $ultima) {
        Anotar "Aun no esta publicada la imagen de hoy; se mantiene la de $fecha."
        exit 3
    }
    $destino = Join-Path $Carpeta ('fondo-' + $fecha + '-' + $marca + '.jpg')
    BajarImagen ($Base + 'actual-' + $tamano + '.jpg?t=' + $marca) $destino
    PonerFondo $destino
    Set-Content -Path $Estado -Value $fecha -Encoding ASCII
    if ($fecha -eq $hoy) { Anotar "Fondo actualizado: $hoy ($tamano)"; exit 0 }
    Anotar "Se puso la imagen mas reciente ($fecha); se esperara la de hoy."
    exit 3
} catch {
    try { Anotar ('Error: ' + $_.Exception.Message) } catch { }
    exit 1
}
