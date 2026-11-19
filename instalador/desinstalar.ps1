# Cronograma institucional CCDB - Quita el fondo de escritorio automatico
# y restaura el fondo que tenia la persona antes de instalarlo.

$ErrorActionPreference = 'Continue'
$destino = Join-Path $env:LOCALAPPDATA 'CronogramaCCDB'

Write-Host ''
Write-Host 'Quitando el fondo de escritorio del Cronograma institucional CCDB...'

Unregister-ScheduledTask -TaskName 'Fondo Cronograma CCDB' -Confirm:$false -ErrorAction SilentlyContinue
Remove-Item -Path (Join-Path ([Environment]::GetFolderPath('Startup')) 'Fondo Cronograma CCDB.vbs') -Force -ErrorAction SilentlyContinue

# Restaurar el fondo anterior, si todavia existe.
$anterior = Join-Path $destino 'fondo-anterior.txt'
if (Test-Path $anterior) {
    $ruta = ([string](Get-Content -Path $anterior -Raw -Encoding UTF8)).Trim()
    if ($ruta -and (Test-Path $ruta)) {
        Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
public static class FondoAnteriorCCDB {
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool SystemParametersInfo(int accion, int param, string archivo, int opciones);
}
'@
        [FondoAnteriorCCDB]::SystemParametersInfo(20, 0, $ruta, 3) | Out-Null
        Write-Host 'Se restauro el fondo anterior.'
    } else {
        Write-Host 'No se encontro el fondo anterior; puede elegir uno nuevo en Configuracion > Personalizacion.'
    }
}

# Borrar la carpeta unos segundos despues (por si este archivo se ejecuta desde ahi).
Start-Process -FilePath 'cmd.exe' -ArgumentList ('/c timeout /t 3 /nobreak >nul & rmdir /s /q "' + $destino + '"') -WindowStyle Hidden
Write-Host 'Listo. El fondo automatico se quito de este equipo.'
