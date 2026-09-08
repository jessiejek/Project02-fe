@echo off
cd /d "%~dp0"
node scripts/list-accounts.mjs > account-list.txt 2>&1
echo EXITCODE=%ERRORLEVEL% >> account-list.txt
