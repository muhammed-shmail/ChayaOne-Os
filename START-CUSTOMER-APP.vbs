Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

strScriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
strPlatformDir = strScriptDir & "\local-first\platform"

If FSO.FolderExists(strPlatformDir) Then
    WshShell.CurrentDirectory = strPlatformDir
    WshShell.Run "node scripts/launch-customer.mjs", 0, False
End If
