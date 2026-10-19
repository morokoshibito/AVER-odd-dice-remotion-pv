@echo off
rem Windows version of render.sh. Video is rendered silent, then your mix
rem (path from src\render-settings.json "audioFile") is muxed in with ffmpeg.
rem   scripts\render.bat full                 whole PV, final quality -> out\odddice_mv.mp4
rem   scripts\render.bat preview              whole PV at half size   -> out\preview.mp4
rem   scripts\render.bat range 51 95          seconds 51-95, half size -> out\range_51-95.mp4
rem   scripts\render.bat still 66.4           one PNG                 -> out\still_66.4.png
rem Extra flags go to Remotion, e.g.  scripts\render.bat full --concurrency=6
setlocal
cd /d "%~dp0.."
if not exist out mkdir out
set "MODE=%~1"
if "%MODE%"=="" set "MODE=preview"

if /i "%MODE%"=="full" (
  call npx remotion render MV out\_silent.mp4 %2 %3 %4 %5 || exit /b 1
  python scripts\mux_audio.py out\_silent.mp4 out\odddice_mv.mp4 0
  goto :eof
)
if /i "%MODE%"=="preview" (
  call npx remotion render MV out\_silent.mp4 --scale=0.5 --crf=26 %2 %3 %4 %5 || exit /b 1
  python scripts\mux_audio.py out\_silent.mp4 out\preview.mp4 0
  goto :eof
)
if /i "%MODE%"=="range" (
  for /f %%F in ('python -c "import json,sys;s=json.load(open('src/render-settings.json',encoding='utf-8'));f=lambda x:max(0,round((float(x)+s['audioStartOffsetSec'])*s['fps']));print(f(sys.argv[1]),f(sys.argv[2]))" %2 %3') do set "A=%%F"
  for /f "tokens=2" %%F in ('python -c "import json,sys;s=json.load(open('src/render-settings.json',encoding='utf-8'));f=lambda x:max(0,round((float(x)+s['audioStartOffsetSec'])*s['fps']));print(f(sys.argv[1]),f(sys.argv[2]))" %2 %3') do set "B=%%F"
  call npx remotion render MV out\_silent.mp4 --frames=%A%-%B% --scale=0.5 --crf=24 %4 %5 %6 || exit /b 1
  python scripts\mux_audio.py out\_silent.mp4 out\range_%2-%3.mp4 %A%
  goto :eof
)
if /i "%MODE%"=="still" (
  for /f %%F in ('python -c "import json,sys;s=json.load(open('src/render-settings.json',encoding='utf-8'));print(max(0,round((float(sys.argv[1])+s['audioStartOffsetSec'])*s['fps'])))" %2') do set "FRAME=%%F"
  call npx remotion still MV out\still_%2.png --frame=%FRAME% %3 %4 %5
  goto :eof
)
echo unknown mode: %MODE%
exit /b 1
