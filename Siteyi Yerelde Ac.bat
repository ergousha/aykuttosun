@echo off
chcp 65001 >nul
title Aykut Tosun - Yerel Sunucu
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\yerel-sunucu.ps1"
