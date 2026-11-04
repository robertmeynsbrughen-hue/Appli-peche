@echo off
chcp 65001 >nul
title Rivio : creation de la cle d'envoi Google Play
echo.
echo  RIVIO - Cle d'envoi Google Play
echo  ================================
echo  Ce script cree la cle qui signe l'appli avant de l'envoyer a Google.
echo  Le mot de passe, c'est toi qui le tapes : il n'est envoye nulle part.
echo.
where keytool >nul 2>nul
if errorlevel 1 (
  echo  Java n'est pas installe. Lance d'abord, dans un terminal :
  echo     winget install EclipseAdoptium.Temurin.17.JDK
  echo  puis ferme ce terminal, et relance ce fichier.
  echo.
  pause
  exit /b 1
)
set "DEST=%USERPROFILE%\Documents\Rivio-cle-Android"
if exist "%DEST%\rivio-upload.keystore" (
  echo  Une cle existe deja dans %DEST%
  echo  Je ne l'ecrase pas. Supprime-la toi-meme si tu veux vraiment en refaire une.
  echo.
  pause
  exit /b 1
)
mkdir "%DEST%" 2>nul
echo  Choisis un mot de passe solide (12 caracteres ou plus) et NOTE-LE :
echo  sans lui, impossible de publier une mise a jour avec cette cle.
echo  keytool va te le demander deux fois (rien ne s'affiche quand tu tapes, c'est normal).
echo.
keytool -genkeypair -keystore "%DEST%\rivio-upload.keystore" -storetype PKCS12 -alias rivio -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Octane Code, O=Octane Code, C=FR"
if errorlevel 1 (
  echo  La creation a echoue.
  pause
  exit /b 1
)
powershell -NoProfile -Command "[Convert]::ToBase64String([IO.File]::ReadAllBytes('%DEST%\rivio-upload.keystore')) | Set-Content -NoNewline '%DEST%\cle-pour-github.txt'"
echo.
echo  Cle creee dans : %DEST%
echo.
echo  A FAIRE MAINTENANT :
echo   1. Sauvegarde le dossier %DEST% sur une cle USB (pas sur GitHub, pas dans un cloud public).
echo   2. Sur GitHub, Appli-peche ^> Settings ^> Secrets and variables ^> Actions ^> New repository secret :
echo        ANDROID_KEYSTORE_BASE64   = tout le contenu de cle-pour-github.txt
echo        ANDROID_KEYSTORE_PASSWORD = ton mot de passe
echo        ANDROID_KEY_PASSWORD      = le meme mot de passe
echo   3. Supprime ensuite cle-pour-github.txt (le .keystore, lui, se garde).
echo.
start "" "https://github.com/robertmeynsbrughen-hue/Appli-peche/settings/secrets/actions"
explorer "%DEST%"
pause
