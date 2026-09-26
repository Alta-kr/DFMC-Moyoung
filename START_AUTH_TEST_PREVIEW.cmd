@echo off
cd /d "%~dp0"
call npx --yes --package=node@22 -- node node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --project demo-moyoung --config firebase.auth-preview.json --only auth,firestore,functions "node --experimental-strip-types scripts/runPreview.mjs"
pause
