@echo off
echo ====================================
echo 司空AI Go服务器构建脚本
echo ====================================

REM 检查Go是否安装
go version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未找到Go环境，请先安装Go语言
    echo 下载地址: https://golang.org/dl/
    pause
    exit /b 1
)

echo ✅ Go环境检查通过

REM 进入Go服务器目录
cd /d "%~dp0"

REM 清理旧的可执行文件
if exist sikongai-server.exe (
    echo 🗑️ 清理旧的可执行文件...
    del sikongai-server.exe
)

REM 下载依赖
echo 📦 下载Go依赖...
go mod tidy

if %errorlevel% neq 0 (
    echo ❌ 依赖下载失败
    pause
    exit /b 1
)

REM 编译可执行文件
echo 🔨 编译Go服务器...
go build -o sikongai-server.exe main.go

if %errorlevel% neq 0 (
    echo ❌ 编译失败
    pause
    exit /b 1
)

REM 检查输出文件
if exist sikongai-server.exe (
    echo ✅ Go服务器构建成功！
    echo 📍 输出文件: %cd%\sikongai-server.exe
    for %%i in (sikongai-server.exe) do echo 📏 文件大小: %%~zi 字节
) else (
    echo ❌ 构建完成但未找到输出文件
    pause
    exit /b 1
)

echo.
echo 🎉 构建完成！
echo 你现在可以运行 sikongai-server.exe 启动服务器
echo.
pause
