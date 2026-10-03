Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

strScriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
strPlatformDir = strScriptDir

If FSO.FolderExists(strPlatformDir) Then
    WshShell.CurrentDirectory = strPlatformDir
    WshShell.Run "node tools/scripts/launch-waiter.mjs", 0, False
End If
