#!/bin/bash

echo "正在启动司空AI Go服务器..."

# 检查Go是否安装
if ! command -v go &> /dev/null; then
    echo "错误: 未找到Go环境，请先安装Go语言"
    echo "下载地址: https://golang.org/dl/"
    exit 1
fi

# 进入Go服务器目录
cd "$(dirname "$0")"

# 下载依赖
echo "正在下载Go依赖..."
go mod tidy

# 编译并运行
echo "正在启动服务器..."
go run main.go