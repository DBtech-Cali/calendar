# Cronograma institucional CCDB - Instala el fondo de escritorio automatico
# para el usuario actual de Windows. No requiere permisos de administrador.
# Se puede volver a ejecutar para actualizar una instalacion anterior.

$ErrorActionPreference = 'Stop'
$origen = Split-Path -Parent $MyInvocation.MyCommand.Path
$destino = Join-Path $env:LOCALAPPDATA 'CronogramaCCDB'
$tarea = 'Fondo Cronograma CCDB'
$nombreAcceso = 'Actualizar fondo del cronograma.lnk'

Write-Host ''
Write-Host 'Instalando el fondo de escritorio del Cronograma institucional CCDB...'

# 1. Copiar los archivos a la carpeta del usuario.
New-Item -ItemType Directory -Force -Path $destino | Out-Null
foreach ($archivo in 'actualizar-fondo.ps1', 'ejecutar-oculto.vbs', 'actualizar-ahora.vbs', 'icono.ico', 'desinstalar.cmd', 'desinstalar.ps1') {
    Copy-Item -Path (Join-Path $origen $archivo) -Destination $destino -Force
}
Get-ChildItem -Path $destino | Unblock-File

# 2. Guardar el fondo actual de la persona, para restaurarlo si se desinstala.
$anterior = Join-Path $destino 'fondo-anterior.txt'
if (-not (Test-Path $anterior)) {
    $actual = (Get-ItemProperty -Path 'HKCU:\Control Panel\Desktop').WallPaper
    Set-Content -Path $anterior -Value ([string]$actual) -Encoding UTF8
}

# 3. Revisar al iniciar sesion.
$inicio = [Environment]::GetFolderPath('Startup')
Copy-Item -Path (Join-Path $destino 'ejecutar-oculto.vbs') -Destination (Join-Path $inicio 'Fondo Cronograma CCDB.vbs') -Force

# 4. Revisar cada hora de 7:00 a. m. a 6:00 p. m. (solo descarga una vez al dia).
$accion = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument ('"' + (Join-Path $destino 'ejecutar-oculto.vbs') + '"')
$disparador = New-ScheduledTaskTrigger -Daily -At '07:00'
$disparador.Repetition = (New-ScheduledTaskTrigger -Once -At '07:00' -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Hours 11)).Repetition
$ajustes = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -MultipleInstances IgnoreNew
$usuario = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal = New-ScheduledTaskPrincipal -UserId $usuario -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $tarea -Action $accion -Trigger $disparador -Settings $ajustes -Principal $principal -Force | Out-Null

# 5. Acceso directo "Actualizar fondo del cronograma" en el escritorio y en el menu Inicio.
$shell = New-Object -ComObject WScript.Shell
$carpetasAcceso = @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))
foreach ($carpetaAcceso in $carpetasAcceso) {
    $acceso = $shell.CreateShortcut((Join-Path $carpetaAcceso $nombreAcceso))
    $acceso.TargetPath = Join-Path $env:SystemRoot 'System32\wscript.exe'
    $acceso.Arguments = '"' + (Join-Path $destino 'actualizar-ahora.vbs') + '"'
    $acceso.WorkingDirectory = $destino
    $acceso.IconLocation = (Join-Path $destino 'icono.ico') + ',0'
    $acceso.Description = 'Actualiza ahora el fondo de escritorio del Cronograma institucional CCDB'
    $acceso.Save()
}

# 6. Poner el fondo de una vez.
Write-Host 'Descargando el fondo de hoy...'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $destino 'actualizar-fondo.ps1') -Forzar
$resultado = $LASTEXITCODE
Write-Host ''
switch ($resultado) {
    0 { Write-Host 'Listo. El fondo de escritorio del cronograma quedo instalado.' }
    3 { Write-Host 'Listo. Aun no esta publicada la imagen de hoy: se puso la mas reciente y se actualizara sola.' }
    2 { Write-Host 'La instalacion quedo hecha, pero no hay conexion a internet. El fondo se pondra solo en la proxima hora.' }
    default { Write-Host ('La instalacion quedo hecha, pero no se pudo poner el fondo. Detalle en: ' + (Join-Path $destino 'registro.txt')) }
}
Write-Host 'Se actualizara solo cada dia. Para actualizarlo a mano: acceso directo "Actualizar fondo del cronograma".'
Write-Host 'Para quitarlo, use desinstalar.cmd.'
