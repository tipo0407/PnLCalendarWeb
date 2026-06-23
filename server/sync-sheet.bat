@echo off
rem Downloads the (private) Google Sheet as xlsx using the user's logged-in
rem browser session and copies it to the trades file the web app reads.
rem Optional arg %1 overrides the destination path.

set SHEET_ID=1JAAqP4P6Xxk6q6jmOfyUe8RLSO3fNEgLa5LTu8_CP6o
set EXPORT_URL=https://docs.google.com/spreadsheets/d/%SHEET_ID%/export?format=xlsx
set DEST=C:\Users\yanlin\GHCPProject\Trading.xlsx
if not "%~1"=="" set DEST=%~1
set DOWNLOADS=%USERPROFILE%\Downloads

rem Clear stale downloads so the new export lands as Trading.xlsx (not "Trading (1).xlsx").
del /q "%DOWNLOADS%\Trading*.xlsx" 2>nul

rem Open the export URL in the default browser (uses the logged-in Google session).
start "" "%EXPORT_URL%"

rem Wait for the download to finish (ping is reliable in non-interactive contexts).
ping 127.0.0.1 -n 15 >nul

if exist "%DOWNLOADS%\Trading.xlsx" (
    copy /y "%DOWNLOADS%\Trading.xlsx" "%DEST%" >nul
    echo OK %DEST%
) else (
    ping 127.0.0.1 -n 8 >nul
    if exist "%DOWNLOADS%\Trading.xlsx" (
        copy /y "%DOWNLOADS%\Trading.xlsx" "%DEST%" >nul
        echo OK %DEST%
    ) else (
        echo FAILED no Trading.xlsx in %DOWNLOADS%
        exit /b 1
    )
)
