' Cronograma institucional CCDB - Ejecuta la actualizacion del fondo sin mostrar ventanas.
' Lo usan la tarea programada y el inicio de sesion de Windows.
Set shell = CreateObject("WScript.Shell")
carpeta = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\CronogramaCCDB"
shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & carpeta & "\actualizar-fondo.ps1""", 0, False
