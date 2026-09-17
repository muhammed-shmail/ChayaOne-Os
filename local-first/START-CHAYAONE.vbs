' =========================================================================
' ChayaOne OS — Zero-Terminal Desktop App Launcher (local-first)
' Launches the ChayaOne Native Desktop Application with 0 console windows.
' =========================================================================
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

strScriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
strLocalAppData = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%")
strUnpackedExe = strScriptDir & "\platform\apps\desktop\dist-installers-v6\win-unpacked\ChayaOne App.exe"
strInstalledExe = strLocalAppData & "\Programs\@cafeosdesktop\ChayaOne App.exe"

Dim appExe
appExe = ""

If FSO.FileExists(strUnpackedExe) Then
    appExe = strUnpackedExe
ElseIf FSO.FileExists(strInstalledExe) Then
    appExe = strInstalledExe
ElseIf FSO.FileExists(strLocalAppData & "\Programs\ChayaOne App\ChayaOne App.exe") Then
    appExe = strLocalAppData & "\Programs\ChayaOne App\ChayaOne App.exe"
ElseIf FSO.FileExists(strLocalAppData & "\Programs\chayaone-desktop\ChayaOne App.exe") Then
    appExe = strLocalAppData & "\Programs\chayaone-desktop\ChayaOne App.exe"
End If

If Len(appExe) > 0 Then
    WshShell.CurrentDirectory = FSO.GetParentFolderName(appExe)
    WshShell.Run """" & appExe & """ --route=/pos", 1, False
Else
    strDesktopDir = strScriptDir & "\platform\apps\desktop"
    If FSO.FolderExists(strDesktopDir) Then
        WshShell.CurrentDirectory = strDesktopDir
        WshShell.Run "cmd /c npx electron . --route=/pos", 0, False
    Else
        MsgBox "ChayaOne Desktop App was not found.", vbCritical, "ChayaOne OS"
    End If
End If
