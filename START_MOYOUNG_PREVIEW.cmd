@echo off
cd /d "%~dp0"
echo Starting the original Moyoung UI locally. Keep this window open.
call node functions/scripts/buildApi.mjs
if errorlevel 1 exit /b 1
call npx --yes --package=node@22 -- node node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --project demo-moyoung-ui --config firebase.ui-preview.json --only firestore,storage "node functions/scripts/serveLocalApi.mjs"
pause
