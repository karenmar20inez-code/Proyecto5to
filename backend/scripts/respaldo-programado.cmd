@echo off
rem Respaldo diario cifrado de La Nutria.
rem Lo ejecuta el Programador de tareas de Windows (tarea "La Nutria - Respaldo diario").
rem El resultado de cada ejecucion queda en backend\respaldos\registro.log
cd /d "%~dp0.."
if not exist respaldos mkdir respaldos
node scripts\respaldo.js >> respaldos\registro.log 2>&1
