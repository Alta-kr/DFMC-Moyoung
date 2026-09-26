@echo off
cd /d "%~dp0"
echo Starting the original Moyoung UI locally. Keep this window open.
call npx --yes --package=node@22 -- node node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --project demo-moyoung-ui --config firebase.ui-preview.json --only firestore,storage "npm run dev --prefix client -- --mode ui-preview --host 127.0.0.1 --port 3001 --strictPort"
pause
