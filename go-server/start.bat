@echo off
echo 正在启动司空AI Go服务器...

REM 检查Go是否安装
go version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未找到Go环境，请先安装Go语言
    echo 下载地址: https://golang.org/dl/
    pause
    exit /b 1
)

REM 进入Go服务器目录
cd /d "%~dp0"

REM 下载依赖
echo 正在下载Go依赖...
go mod tidy

REM 编译并运行
echo 正在启动服务器...
go run main.go

pause