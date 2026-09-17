' =========================================================================
' ChayaOne OS — All Apps Silent Background Launcher
' Launches all apps (Server, POS, Waiter, Customer, Owner) with 0 terminal windows.
' =========================================================================
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

strScriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
strPlatformDir = strScriptDir & "\local-first\platform"

If FSO.FolderExists(strPlatformDir) Then
    WshShell.CurrentDirectory = strPlatformDir
    ' Run completely hidden in background (0 = hide window, False = don't wait)
    WshShell.Run "node scripts/launch-all.mjs", 0, False
End If
