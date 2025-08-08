# 司空AI Go服务器

这是一个高性能的Go HTTP服务器，用于处理AI API请求的并发转发。

## 功能特性

- 🚀 高性能并发处理：使用Go协程实现高速并发请求
- 📡 本地HTTP服务器：监听端口10301
- ⚡ 智能负载均衡：自动分发并发请求
- 🔒 安全性：仅监听本地连接，确保数据安全
- 📊 健康检查：提供服务器状态监控
- 🎯 统一API接口：兼容各种AI服务提供商

## 系统要求

- Go 1.21 或更高版本
- 支持的操作系统：Windows、macOS、Linux

## 安装和运行

### 1. 安装Go语言

如果还没有安装Go，请访问 [https://golang.org/dl/](https://golang.org/dl/) 下载并安装。

### 2. 启动服务器

#### Windows
```cmd
start.bat
```

#### macOS/Linux
```bash
chmod +x start.sh
./start.sh
```

#### 手动启动
```bash
go mod tidy
go run main.go
```

## API 端点

### 健康检查
```
GET http://localhost:10301/health
```

### AI聊天请求
```
POST http://localhost:10301/api/chat
```

请求体格式：
```json
{
  "baseUrl": "https://api.openai.com",
  "apiKey": "sk-...",
  "organization": "",
  "requestBody": { /* OpenAI API请求体 */ },
  "concurrentCount": 3,
  "userMessageId": "unique-id",
  "requestTimeout": 30
}
```

## 并发处理

服务器支持1-10个并发请求，通过Go协程实现：

- 单个请求：直接处理并返回结果
- 并发请求：创建多个协程同时发送请求，收集所有结果后返回
- 失败重试：自动处理网络错误和临时故障
- 超时控制：可配置的请求超时时间

## 错误处理

服务器会处理以下类型的错误：

- 网络连接错误
- API认证错误  
- 请求超时
- JSON解析错误
- HTTP状态码错误

所有错误都会在响应中详细说明，便于前端处理。

## 性能优化

- 使用Gin框架提供高性能HTTP服务
- 协程池管理，避免过度创建协程
- 连接复用，减少网络开销
- 内存优化，及时回收资源

## 安全性

- 仅监听本地127.0.0.1地址
- 不存储任何敏感信息
- 请求参数验证
- CORS安全配置

## 开发和调试

启动开发模式：
```bash
go run main.go
```

编译生产版本：
```bash
go build -o sikongai-server main.go
```

## 日志和监控

服务器会输出详细的日志信息：

- 请求接收和处理状态
- 并发请求进度
- 错误信息和堆栈跟踪
- 性能统计信息

## 故障排除

### 1. Go环境问题
- 确保Go版本≥1.21
- 检查GOPATH和GOROOT设置
- 验证网络连接

### 2. 端口占用
- 检查10301端口是否被占用
- 使用`netstat -an | grep 10301`查看端口状态

### 3. 依赖下载失败
- 配置Go代理：`go env -w GOPROXY=https://goproxy.cn,direct`
- 清理模块缓存：`go clean -modcache`

### 4. 内存使用过高
- 支持无限制并发数量，用户可根据需求自由设置
- 监控协程数量
- 检查内存泄漏

## 更新说明

### v1.0.0
- 初始版本发布
- 基础并发请求功能
- 健康检查端点
- 错误处理和日志记录