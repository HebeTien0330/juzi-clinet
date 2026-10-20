@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "TS_PROTO_PLUGIN=%SCRIPT_DIR%..\..\node_modules\.bin\protoc-gen-ts_proto.cmd"
set "PB_OUT=%SCRIPT_DIR%..\..\assets\pb"
set "FRAMEWORK_ROOT=%SCRIPT_DIR%..\framework"
set "GAME_ROOT=%SCRIPT_DIR%..\game"

if not exist "%PB_OUT%" mkdir "%PB_OUT%"

call :compile "%FRAMEWORK_ROOT%" common
if errorlevel 1 goto :end
call :compile "%FRAMEWORK_ROOT%" public
if errorlevel 1 goto :end
call :compile "%GAME_ROOT%" common
if errorlevel 1 goto :end
call :compile "%GAME_ROOT%" public
if errorlevel 1 goto :end

node "%SCRIPT_DIR%postprocess-ts-proto.js"

:end
if not "%~1"=="--no-pause" pause
exit /b %errorlevel%

:compile
set "PROTO_ROOT=%~1"
set "LAYER=%~2"
if not exist "%PROTO_ROOT%\%LAYER%\*.proto" exit /b 0
echo Compiling %LAYER% proto files from %PROTO_ROOT%
protoc ^
	--plugin=protoc-gen-ts_proto="%TS_PROTO_PLUGIN%" ^
	--ts_proto_out="%PB_OUT%" ^
	--proto_path="%FRAMEWORK_ROOT%" ^
	--proto_path="%PROTO_ROOT%" ^
	"%PROTO_ROOT%\%LAYER%\*.proto"
exit /b %errorlevel%
