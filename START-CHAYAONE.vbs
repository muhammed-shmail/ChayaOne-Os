' =========================================================================
' ChayaOne OS — Zero-Terminal Desktop App Launcher
' Launches the ChayaOne Native Desktop Application with 0 console windows.
' =========================================================================
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

strScriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
strLocalAppData = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%")
strUnpackedExe = strScriptDir & "\local-first\platform\apps\desktop\dist-installers-v6\win-unpacked\ChayaOne App.exe"
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
    strDesktopDir = strScriptDir & "\local-first\platform\apps\desktop"
    strElectronBin = strDesktopDir & "\node_modules\.bin\electron.cmd"
    If FSO.FolderExists(strDesktopDir) Then
        WshShell.CurrentDirectory = strDesktopDir
        If FSO.FileExists(strElectronBin) Then
            ' Run electron.cmd directly — no cmd.exe shell wrapper to avoid terminal popups
            WshShell.Run """" & strElectronBin & """ . --route=/pos", 0, False
        Else
            ' Last-resort fallback: cmd /c with windowStyle=0 (hidden)
            WshShell.Run "cmd /c npx electron . --route=/pos", 0, False
        End If
    Else
        MsgBox "ChayaOne Desktop App was not found.", vbCritical, "ChayaOne OS"
    End If
End If
