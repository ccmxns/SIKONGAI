package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"os/signal"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// 请求参数结构
type APIRequest struct {
	BaseURL         string            `json:"baseUrl"`
	APIKey          string            `json:"apiKey"`
	Organization    string            `json:"organization,omitempty"`
	RequestBody     json.RawMessage   `json:"requestBody"`
	ConcurrentCount int               `json:"concurrentCount"`
	Headers         map[string]string `json:"headers,omitempty"`
	UserMessageID   string            `json:"userMessageId,omitempty"`
	RequestTimeout  int               `json:"requestTimeout,omitempty"`
}

// 单个请求结果
type RequestResult struct {
	Success      bool            `json:"success"`
	Content      string          `json:"content,omitempty"`
	Error        string          `json:"error,omitempty"`
	RequestIndex int             `json:"requestIndex"`
	Usage        json.RawMessage `json:"usage,omitempty"`
	IsPending    bool            `json:"isPending,omitempty"`
}

// API响应结构
type APIResponse struct {
	Success           bool            `json:"success"`
	Content           string          `json:"content,omitempty"`
	Error             string          `json:"error,omitempty"`
	Usage             json.RawMessage `json:"usage,omitempty"`
	RequestIndex      int             `json:"requestIndex"`
	ConcurrentResults []RequestResult `json:"concurrentResults,omitempty"`
	SuccessCount      int             `json:"successCount,omitempty"`
	TotalCount        int             `json:"totalCount,omitempty"`
	UserMessageID     string          `json:"userMessageId,omitempty"`
	IsPartialResult   bool            `json:"isPartialResult,omitempty"`
	IsFinalResult     bool            `json:"isFinalResult,omitempty"`
}

// OpenAI API响应结构
type OpenAIResponse struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	Model   string `json:"model"`
	Choices []struct {
		Index   int `json:"index"`
		Message struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"message"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Usage json.RawMessage `json:"usage"`
}

func main() {
	// 初始化随机数种子
	rand.Seed(time.Now().UnixNano())

	// 设置Gin为发布模式
	gin.SetMode(gin.ReleaseMode)

	r := gin.Default()

	// 配置CORS，允许前端访问
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{"*"}
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization"}
	r.Use(cors.New(config))

	// 健康检查端点
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "ok",
			"timestamp": time.Now().Unix(),
			"service":   "sikongai-go-server",
		})
	})

	// API请求处理端点
	r.POST("/api/chat", handleChatRequest)

	fmt.Println("🚀 司空AI Go服务器正在启动...")
	fmt.Println("📡 监听端口: 10301")
	fmt.Println("🔗 健康检查: http://localhost:10301/health")
	fmt.Println("🤖 API端点: http://localhost:10301/api/chat")

	// 创建HTTP服务器
	srv := &http.Server{
		Addr:    ":10301",
		Handler: r,
	}

	// 启动服务器（在goroutine中）
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("服务器启动失败: %v", err)
		}
	}()

	// 优雅关闭处理
	gracefulShutdown := func() {
		log.Println("🛑 收到关闭信号，正在优雅关闭服务器...")

		// 设置关闭超时
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()

		if err := srv.Shutdown(ctx); err != nil {
			log.Printf("❌ 服务器强制关闭: %v", err)
		} else {
			log.Println("✅ 服务器已优雅关闭")
		}
	}

	// 等待中断信号以优雅地关闭服务器
	quit := make(chan os.Signal, 1)

	// 根据操作系统注册信号
	signal.Notify(quit, os.Interrupt) // Ctrl+C (所有平台)

	if runtime.GOOS == "windows" {
		log.Println("🔧 Windows平台：已注册 os.Interrupt 信号")
	} else {
		signal.Notify(quit, syscall.SIGTERM) // Unix系统额外注册SIGTERM
		log.Println("🔧 Unix平台：已注册 os.Interrupt 和 SIGTERM 信号")
	}

	// 在Windows上的特殊处理
	if runtime.GOOS == "windows" {
		// Windows特有的信号处理
		go func() {
			// 定期检查父进程是否还存在
			ticker := time.NewTicker(2 * time.Second)
			defer ticker.Stop()

			for {
				select {
				case <-ticker.C:
					// 如果检测到孤立进程（父进程不存在），则退出
					// 这是一个简单的方法来检测Electron进程是否还存在
					continue
				case <-quit:
					return
				}
			}
		}()
	}

	// 等待关闭信号
	log.Println("⏳ 等待关闭信号...")
	<-quit
	gracefulShutdown()
}

func handleChatRequest(c *gin.Context) {
	var req APIRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   fmt.Sprintf("请求参数错误: %v", err),
		})
		return
	}

	// 验证必要参数
	if req.BaseURL == "" {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   "BaseURL不能为空",
		})
		return
	}

	if req.APIKey == "" {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   "APIKey不能为空",
		})
		return
	}

	// 设置默认并发数
	if req.ConcurrentCount <= 0 {
		req.ConcurrentCount = 1
	}
	// 移除并发数上限，用户可以自由设置任意并发数

	// 设置默认超时时间
	if req.RequestTimeout <= 0 {
		req.RequestTimeout = 30
	}

	log.Printf("收到请求 - 并发数: %d, BaseURL: %s, UserMessageID: %s",
		req.ConcurrentCount, req.BaseURL, req.UserMessageID)

	// 处理并发请求
	if req.ConcurrentCount == 1 {
		// 单个请求
		result := sendSingleRequest(req, 0)
		response := APIResponse{
			Success:       result.Success,
			Content:       result.Content,
			Error:         result.Error,
			Usage:         result.Usage,
			RequestIndex:  result.RequestIndex,
			UserMessageID: req.UserMessageID,
		}

		if result.Success {
			c.JSON(http.StatusOK, response)
		} else {
			c.JSON(http.StatusInternalServerError, response)
		}
	} else {
		// 并发请求
		response := sendConcurrentRequests(req)
		response.UserMessageID = req.UserMessageID

		if response.SuccessCount > 0 {
			c.JSON(http.StatusOK, response)
		} else {
			c.JSON(http.StatusInternalServerError, response)
		}
	}
}

// 发送单个请求
func sendSingleRequest(req APIRequest, requestIndex int) RequestResult {
	// 构建完整的API URL
	apiURL := req.BaseURL
	if apiURL[len(apiURL)-1] != '/' {
		apiURL += "/"
	}
	if !contains(apiURL, "/v1") {
		apiURL += "v1/"
	}
	apiURL += "chat/completions"

	// 为每个并发请求创建独特的请求体（不同的随机任务ID）
	uniqueRequestBody, err := createUniqueRequestBody(req.RequestBody, requestIndex)
	if err != nil {
		log.Printf("创建独特请求体失败: %v", err)
		uniqueRequestBody = req.RequestBody // 使用原始请求体作为fallback
	}

	// 创建HTTP客户端
	client := &http.Client{
		Timeout: time.Duration(req.RequestTimeout) * time.Second,
	}

	// 创建请求（使用独特的请求体）
	httpReq, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(uniqueRequestBody))
	if err != nil {
		return RequestResult{
			Success:      false,
			Error:        fmt.Sprintf("创建请求失败: %v", err),
			RequestIndex: requestIndex,
		}
	}

	// 设置请求头
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+req.APIKey)

	if req.Organization != "" {
		httpReq.Header.Set("OpenAI-Organization", req.Organization)
	}

	// 添加自定义头部
	for key, value := range req.Headers {
		httpReq.Header.Set(key, value)
	}

	log.Printf("发送请求 #%d 到 %s", requestIndex+1, apiURL)

	// 发送请求
	resp, err := client.Do(httpReq)
	if err != nil {
		return RequestResult{
			Success:      false,
			Error:        fmt.Sprintf("请求失败: %v", err),
			RequestIndex: requestIndex,
		}
	}
	defer resp.Body.Close()

	// 读取响应
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return RequestResult{
			Success:      false,
			Error:        fmt.Sprintf("读取响应失败: %v", err),
			RequestIndex: requestIndex,
		}
	}

	// 检查HTTP状态码
	if resp.StatusCode != http.StatusOK {
		return RequestResult{
			Success:      false,
			Error:        fmt.Sprintf("API请求失败: %d %s\n%s", resp.StatusCode, resp.Status, string(body)),
			RequestIndex: requestIndex,
		}
	}

	// 解析OpenAI响应
	var openaiResp OpenAIResponse
	if err := json.Unmarshal(body, &openaiResp); err != nil {
		return RequestResult{
			Success:      false,
			Error:        fmt.Sprintf("解析响应失败: %v", err),
			RequestIndex: requestIndex,
		}
	}

	// 提取内容
	if len(openaiResp.Choices) == 0 {
		return RequestResult{
			Success:      false,
			Error:        "API响应中没有找到有效的回复内容",
			RequestIndex: requestIndex,
		}
	}

	content := openaiResp.Choices[0].Message.Content

	log.Printf("请求 #%d 成功完成，内容长度: %d", requestIndex+1, len(content))

	return RequestResult{
		Success:      true,
		Content:      content,
		RequestIndex: requestIndex,
		Usage:        openaiResp.Usage,
	}
}

// 发送并发请求
func sendConcurrentRequests(req APIRequest) APIResponse {
	log.Printf("开始发送 %d 个并发请求", req.ConcurrentCount)

	// 创建结果切片
	results := make([]RequestResult, req.ConcurrentCount)

	// 使用WaitGroup等待所有协程完成
	var wg sync.WaitGroup

	// 使用带缓冲的channel收集结果
	resultChan := make(chan struct {
		result RequestResult
		index  int
	}, req.ConcurrentCount)

	// 启动所有协程
	for i := 0; i < req.ConcurrentCount; i++ {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()

			// 发送单个请求
			result := sendSingleRequest(req, index)

			// 将结果发送到channel
			resultChan <- struct {
				result RequestResult
				index  int
			}{result: result, index: index}

		}(i)
	}

	// 创建一个协程来关闭channel
	go func() {
		wg.Wait()
		close(resultChan)
	}()

	// 收集所有结果
	for item := range resultChan {
		results[item.index] = item.result
	}

	// 统计成功数量
	successCount := 0
	var firstSuccessResult *RequestResult

	for i := range results {
		if results[i].Success {
			successCount++
			if firstSuccessResult == nil {
				firstSuccessResult = &results[i]
			}
		}
	}

	log.Printf("并发请求完成: %d/%d 成功", successCount, req.ConcurrentCount)

	// 构建响应
	response := APIResponse{
		ConcurrentResults: results,
		SuccessCount:      successCount,
		TotalCount:        req.ConcurrentCount,
		IsFinalResult:     true,
	}

	if successCount > 0 && firstSuccessResult != nil {
		response.Success = true
		response.Content = firstSuccessResult.Content
		response.Usage = firstSuccessResult.Usage
		response.RequestIndex = firstSuccessResult.RequestIndex
	} else {
		response.Success = false
		if len(results) > 0 {
			response.Error = results[0].Error
		} else {
			response.Error = "所有并发请求都失败了"
		}
	}

	return response
}

// 生成唯一随机ID
func generateUniqueId(contentLength int) string {
	const minLength = 16
	idLength := minLength
	if contentLength > 0 {
		idLength = max(minLength, contentLength/2)
	}

	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	result := make([]byte, idLength)
	for i := range result {
		result[i] = chars[rand.Intn(len(chars))]
	}
	return string(result)
}

// 辅助函数：获取max值
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// 替换请求体中的随机任务ID
func replaceRandomId(requestBodyBytes []byte, newId string) ([]byte, error) {
	// 正则表达式匹配随机任务ID模式
	re := regexp.MustCompile(`(\[请忽略该行内容，唯一随机任务id：)[^\]]+(\])`)

	// 构造新的ID字符串
	newIdString := "${1}" + newId + "${2}"

	// 替换
	newContent := re.ReplaceAllString(string(requestBodyBytes), newIdString)

	return []byte(newContent), nil
}

// 为并发请求生成独特的请求体
func createUniqueRequestBody(originalRequestBody json.RawMessage, requestIndex int) ([]byte, error) {
	// 解析原始请求体
	var requestData map[string]interface{}
	if err := json.Unmarshal(originalRequestBody, &requestData); err != nil {
		return nil, fmt.Errorf("解析请求体失败: %v", err)
	}

	// 获取messages数组
	messages, ok := requestData["messages"].([]interface{})
	if !ok {
		return originalRequestBody, nil // 如果没有messages，直接返回原始请求体
	}

	// 查找最后一个用户消息并生成新的随机ID
	for i := len(messages) - 1; i >= 0; i-- {
		message, ok := messages[i].(map[string]interface{})
		if !ok {
			continue
		}

		role, ok := message["role"].(string)
		if !ok || role != "user" {
			continue
		}

		content, ok := message["content"].(string)
		if !ok {
			continue
		}

		// 检查是否包含随机任务ID
		re := regexp.MustCompile(`\[请忽略该行内容，唯一随机任务id：[^\]]+\]`)
		if re.MatchString(content) {
			// 生成新的随机ID（为每个并发请求生成不同的ID）
			newId := generateUniqueId(len(content)) + fmt.Sprintf("_C%d", requestIndex+1) // 添加并发索引

			// 替换随机任务ID
			newContent := re.ReplaceAllString(content, fmt.Sprintf("[请忽略该行内容，唯一随机任务id：%s]", newId))
			message["content"] = newContent

			log.Printf("为并发请求 #%d 生成新的随机ID: %s", requestIndex+1, newId)
		}
		break // 只处理最后一个用户消息
	}

	// 重新序列化请求体
	return json.Marshal(requestData)
}

// 辅助函数：检查字符串是否包含子串
func contains(s, substr string) bool {
	return strings.Contains(s, substr)
}
