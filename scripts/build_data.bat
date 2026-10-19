@echo off
rem Windows version of build_data.sh (no bash / WSL needed). Nothing is copied:
rem your files stay where they are; the mix path is remembered in src\render-settings.json.
rem usage: scripts\build_data.bat path\to\odddice.svp path\to\odddice.wav
setlocal
cd /d "%~dp0.."
if "%~2"=="" (
  echo usage: scripts\build_data.bat path\to\odddice.svp path\to\odddice.wav
  exit /b 1
)
set "SVP=%~1"
set "MIX=%~2"

python scripts\extract_svp.py "%SVP%" -o src\data\timing.json || exit /b 1
python scripts\align_lyrics.py "%SVP%" lyrics.txt -o src\data\lyrics.json || exit /b 1
python scripts\analyze_audio.py "%MIX%" -o src\data\audio_features.json --beats src\data\timing.json --svp "%SVP%" || exit /b 1
python scripts\set_audio.py "%MIX%" || exit /b 1
python scripts\scan_assets.py public src\data\assets.json || exit /b 1
echo [build_data] done.
