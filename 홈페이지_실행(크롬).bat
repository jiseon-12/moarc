@echo off
chcp 65001 >nul
title MOARC PARTNERS 로컬 서버
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  [!] Node.js가 설치되어 있지 않습니다.
  echo      https://nodejs.org 에서 LTS 버전을 설치한 뒤 이 파일을 다시 실행하세요.
  start "" "https://nodejs.org/ko"
  pause
  exit /b 1
)

set "CHROME="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if defined CHROME (
  start "" /b cmd /c "timeout /t 2 /nobreak >nul & start "" "%CHROME%" http://localhost:3000"
) else (
  echo  [i] 크롬을 찾지 못해 기본 브라우저로 엽니다.
  start "" /b cmd /c "timeout /t 2 /nobreak >nul & start "" http://localhost:3000"
)

node scripts\local.mjs
pause
