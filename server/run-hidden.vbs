' Launches the PnL Calendar production server with no visible console window.
Dim shell, fso, scriptDir
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = scriptDir
' 0 = hidden window, False = do not wait for it to finish.
shell.Run "node """ & scriptDir & "\serve.cjs""", 0, False
