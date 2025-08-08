// API 请求管理器
class APIManager {
    constructor() {
        this.settings = null;
        this.requestQueue = [];
        this.activeRequests = 0;
        this.maxConcurrentRequests = 20;
        this.desktopPath = null;
        this.concurrentFolder = null;
        this.init();
    }

    async init() {
        // 获取桌面路径
        try {
            this.desktopPath = await window.electronAPI.getDesktopPath();
            console.log('桌面路径:', this.desktopPath);
        } catch (error) {
            console.error('获取桌面路径失败:', error);
        }
    }

    // 加载设置
    loadSettings() {
        try {
            const saved = localStorage.getItem('sikongai-settings');
            if (saved) {
                this.settings = JSON.parse(saved);
                this.maxConcurrentRequests = this.settings.concurrentRequests || 20;
                console.log('API管理器加载设置:', { 
                    concurrentRequests: this.settings.concurrentRequests, 
                    maxConcurrentRequests: this.maxConcurrentRequests 
                });
                return true;
            } else {
                console.log('未找到保存的设置，使用默认值');
            }
        } catch (error) {
            console.error('加载设置失败:', error);
        }
        this.maxConcurrentRequests = 20; // 使用默认值
        return false;
    }

    // 验证设置
    validateSettings(quickSettings = {}) {
        if (!this.settings) {
            throw new Error('请先配置API设置');
        }

        // 检查Base URL，优先使用快捷设置，然后检查各种可能的字段名
        const baseUrl = quickSettings.provider || 
                       this.settings.providerUrl || 
                       this.settings.baseUrl || 
                       this.settings.currentBaseUrl;
        
        if (!baseUrl) {
            throw new Error('请配置Base URL');
        }

        // 检查API Key，优先使用快捷设置
        const apiKey = quickSettings.apiKey || 
                      this.settings.apiKey || 
                      this.settings.currentApiKey;
        
        if (!apiKey) {
            throw new Error('请配置API Key');
        }

        return true;
    }

    // 构建API URL（现在由Go服务器处理，这里保留兼容性）
    buildApiUrl(customBaseUrl = null) {
        // 使用传入的URL，或者从设置中获取（尝试多个可能的字段名）
        let baseUrl = customBaseUrl || 
                     this.settings.providerUrl || 
                     this.settings.baseUrl || 
                     this.settings.currentBaseUrl;
        
        if (!baseUrl) {
            throw new Error('无法获取Base URL');
        }
        
        baseUrl = baseUrl.trim();
        
        // 移除末尾的斜杠
        if (baseUrl.endsWith('/')) {
            baseUrl = baseUrl.slice(0, -1);
        }

        // Go服务器会处理URL拼接，这里只返回基础URL
        return baseUrl;
    }

    // 生成唯一随机ID
    generateUniqueId(contentLength) {
        const minLength = 16;
        const idLength = Math.max(minLength, Math.floor(contentLength / 2));
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < idLength; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // 构建请求体
    buildRequestBody(userMessage, conversationHistory = [], requestIndex = 0, quickSettings = {}) {
        const messages = [];

        // 添加系统提示词
        // 优先使用快捷设置的系统提示词
        let systemPrompt = this.settings.systemPrompt;
        if (quickSettings.systemPrompt && window.chatManager && window.chatManager.getCurrentSystemPrompt) {
            systemPrompt = window.chatManager.getCurrentSystemPrompt();
            console.log('使用快捷设置的系统提示词:', systemPrompt);
        }
        
        if (systemPrompt) {
            messages.push({
                role: 'system',
                content: systemPrompt
            });
        }

        // 添加对话历史（最近10条）
        const recentHistory = conversationHistory.slice(-10);
        recentHistory.forEach(msg => {
            const role = msg.type === 'user' ? 'user' : 'assistant';
            
            // 如果是用户消息且包含图片，使用OpenAI vision格式
            if (role === 'user' && msg.images && msg.images.length > 0) {
                const contentArray = [];
                
                // 添加文本内容
                if (msg.content) {
                    contentArray.push({
                        type: "text",
                        text: msg.content
                    });
                }
                
                // 添加图片内容
                msg.images.forEach(base64Image => {
                    contentArray.push({
                        type: "image_url",
                        image_url: {
                            url: `data:image/jpeg;base64,${base64Image}`
                        }
                    });
                });
                
                messages.push({
                    role: role,
                    content: contentArray
                });
            } else {
                // 普通消息格式
                messages.push({
                    role: role,
                    content: msg.content
                });
            }
        });

        // 生成唯一随机ID
        const uniqueId = this.generateUniqueId(userMessage.content.length);
        
        // 处理当前用户消息
        if (userMessage.images && userMessage.images.length > 0) {
            // 如果包含图片，使用OpenAI vision格式
            const contentArray = [];
            
            // 添加文本内容（包含唯一ID）
            if (userMessage.content) {
                const messageWithId = `${userMessage.content}\n[请忽略该行内容，唯一随机任务id：${uniqueId}]`;
                contentArray.push({
                    type: "text",
                    text: messageWithId
                });
            }
            
            // 添加图片内容
            userMessage.images.forEach(base64Image => {
                contentArray.push({
                    type: "image_url",
                    image_url: {
                        url: `data:image/jpeg;base64,${base64Image}`
                    }
                });
            });
            
            messages.push({
                role: 'user',
                content: contentArray
            });
        } else {
            // 普通文本消息
            const messageWithId = `${userMessage.content}\n[请忽略该行内容，唯一随机任务id：${uniqueId}]`;
            messages.push({
                role: 'user',
                content: messageWithId
            });
        }

        // 优先使用快捷设置的模型，否则使用全局设置
        let modelName = quickSettings.model || this.settings.modelName;
        if (this.settings.modelName === 'custom' && this.settings.customModel && !quickSettings.model) {
            modelName = this.settings.customModel;
        }

        // 优先使用快捷设置，否则使用全局设置
        const temperature = quickSettings.temperature ? parseFloat(quickSettings.temperature) : (this.settings.temperature || 0.7);
        
        // 强制使用非流式传输
        const streaming = false;
        
        console.log('请求参数:', {
            model: modelName,
            temperature: temperature,
            stream: streaming,
            quickSettings: quickSettings
        });

        return {
            model: modelName,
            messages: messages,
            temperature: temperature,
            max_tokens: quickSettings.maxTokens ? parseInt(quickSettings.maxTokens) : (this.settings.maxTokens || 2048),
            stream: streaming
        };
    }

    // 创建并发目录
    async createConcurrentFolder() {
        if (!this.desktopPath) {
            console.warn('桌面路径未设置，跳过创建并发目录');
            return;
        }

        try {
            // 固定的并发目录，使用标准路径分隔符
            const baseFolder = `${this.desktopPath}/并发目录`;
            console.log('准备创建基础并发目录:', baseFolder);
            
            // 创建基础并发目录（如果不存在）
            const baseResult = await window.electronAPI.createDirectory(baseFolder);
            console.log('基础并发目录创建结果:', baseResult);
            
            // 创建带时间戳的子目录，使用中文友好格式
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hour = String(now.getHours()).padStart(2, '0');
            const minute = String(now.getMinutes()).padStart(2, '0');
            const second = String(now.getSeconds()).padStart(2, '0');
            
            const timestamp = `${year}年${month}月${day}日_${hour}时${minute}分${second}秒`;
            this.concurrentFolder = `${baseFolder}/${timestamp}`;
            console.log('准备创建时间戳目录:', this.concurrentFolder);
            
            const timestampResult = await window.electronAPI.createDirectory(this.concurrentFolder);
            console.log('时间戳目录创建结果:', timestampResult);
            console.log('并发目录已创建:', this.concurrentFolder);
        } catch (error) {
            console.error('创建并发目录失败:', {
                error: error.message,
                desktopPath: this.desktopPath,
                stack: error.stack
            });
            this.concurrentFolder = null;
            
            // 显示用户友好的错误通知
            if (window.sikongAI && typeof window.sikongAI.showNotification === 'function') {
                window.sikongAI.showNotification(
                    `创建并发目录失败: ${error.message}`, 
                    'error', 
                    5000
                );
            }
        }
    }

    // 写入响应到文件
    async writeResponseToFile(response, requestIndex) {
        if (!this.concurrentFolder) {
            console.warn('并发目录未创建，跳过文件写入');
            return;
        }

        try {
            const filename = `响应_${requestIndex + 1}.txt`;
            const filepath = `${this.concurrentFolder}/${filename}`;
            
            let content = '';
            
            if (response.error) {
                // 错误响应
                content = `请求时间: ${new Date().toLocaleString('zh-CN')}\n`;
                content += `请求序号: ${requestIndex + 1}\n`;
                content += `状态: 请求失败\n`;
                content += `错误信息: ${response.message}\n`;
                content += `\n详细错误:\n${response.message}`;
            } else {
                // 成功响应
                const responseContent = response.choices?.[0]?.message?.content || '无回复内容';
                
                content = `请求时间: ${new Date().toLocaleString('zh-CN')}\n`;
                content += `请求序号: ${requestIndex + 1}\n`;
                content += `状态: 请求成功\n`;
                // 显示实际使用的模型名称
                const displayModel = this.settings.modelName === 'custom' && this.settings.customModel 
                    ? this.settings.customModel 
                    : this.settings.modelName || '未知';
                content += `模型: ${displayModel}\n`;
                content += `温度: ${this.settings.temperature || 0.7}\n`;
                content += `最大令牌: ${this.settings.maxTokens || 2048}\n`;
                
                if (response.usage) {
                    content += `Token使用: ${response.usage.total_tokens} (输入: ${response.usage.prompt_tokens}, 输出: ${response.usage.completion_tokens})\n`;
                }
                
                content += `\n=== AI回复内容 ===\n`;
                content += responseContent;
                
                if (response.model) {
                    content += `\n\n=== 技术信息 ===\n`;
                    content += `实际使用模型: ${response.model}\n`;
                    content += `响应ID: ${response.id || '未知'}\n`;
                }
            }

            await window.electronAPI.writeFile(filepath, content);
            console.log(`响应已写入文件: ${filename}`);
        } catch (error) {
            console.error('写入响应文件失败:', error);
        }
    }

    // 带重试的单个请求
    async sendRequestWithRetry(message, conversationHistory = [], requestIndex = 0, quickSettings = {}) {
        const maxRetries = this.settings?.retryAttempts || 2;
        let lastError;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    console.log(`请求 ${requestIndex + 1} 第 ${attempt + 1} 次重试...`);
                    
                    // 通知UI显示重试状态
                    if (window.sikongAI && typeof window.sikongAI.showNotification === 'function') {
                        window.sikongAI.showNotification(
                            `回复 ${requestIndex + 1} 重试中... (${attempt}/${maxRetries})`, 
                            'info', 
                            2000
                        );
                    }
                    
                    // 重试前等待一段时间，避免立即重试
                    await new Promise(resolve => setTimeout(resolve, Math.min(1000 * attempt, 5000)));
                }

                const result = await this.sendRequest(message, conversationHistory, requestIndex, quickSettings);
                
                // 如果是重试成功，显示成功通知
                if (attempt > 0 && window.sikongAI && typeof window.sikongAI.showNotification === 'function') {
                    window.sikongAI.showNotification(
                        `回复 ${requestIndex + 1} 重试成功！`, 
                        'success', 
                        3000
                    );
                }
                
                return result;
            } catch (error) {
                lastError = error;
                console.error(`请求 ${requestIndex + 1} 失败 (尝试 ${attempt + 1}/${maxRetries + 1}):`, error.message);
                
                // 检查是否为可重试的错误
                if (!this.isRetryableError(error) || attempt === maxRetries) {
                    break;
                }
            }
        }

        // 最终失败时显示友好的错误消息
        if (window.sikongAI && typeof window.sikongAI.showNotification === 'function') {
            window.sikongAI.showNotification(
                `回复 ${requestIndex + 1} 经过 ${maxRetries + 1} 次尝试后仍然失败`, 
                'error', 
                5000
            );
        }
        
        throw lastError;
    }

    // 判断错误是否可重试
    isRetryableError(error) {
        const retryableConditions = [
            // 网络错误
            error.message.includes('网络错误'),
            error.message.includes('Network Error'),
            error.message.includes('Failed to fetch'),
            // 超时错误
            error.message.includes('timeout'),
            error.message.includes('超时'),
            // 服务器错误 (5xx)
            error.message.includes('500'),
            error.message.includes('502'),
            error.message.includes('503'),
            error.message.includes('504'),
            error.message.includes('Internal Server Error'),
            error.message.includes('Bad Gateway'),
            error.message.includes('Service Unavailable'),
            error.message.includes('Gateway Timeout'),
            // 限流错误
            error.message.includes('429'),
            error.message.includes('Too Many Requests'),
            // 连接错误
            error.message.includes('ENOTFOUND'),
            error.message.includes('ECONNRESET'),
            error.message.includes('ETIMEDOUT')
        ];

        return retryableConditions.some(condition => condition);
    }

    // 发送单个请求（通过Go服务器）
    async sendRequest(message, conversationHistory = [], requestIndex = 0, quickSettings = {}) {
        this.loadSettings();
        this.validateSettings(quickSettings);

        // 优先使用快捷设置，否则使用全局设置
        const apiKey = quickSettings.apiKey || 
                      this.settings.apiKey || 
                      this.settings.currentApiKey;
        const baseUrl = quickSettings.provider || 
                       this.settings.providerUrl || 
                       this.settings.baseUrl || 
                       this.settings.currentBaseUrl;

        const requestBody = this.buildRequestBody(message, conversationHistory, requestIndex, quickSettings);

        // 构建发送给Go服务器的请求数据
        const goServerRequest = {
            baseUrl: baseUrl,
            apiKey: apiKey,
            organization: this.settings.organization || '',
            requestBody: requestBody,
            concurrentCount: 1,
            userMessageId: quickSettings.userMessageId || '',
            requestTimeout: this.settings.requestTimeout || 30
        };

        console.log('发送请求到Go服务器:', { 
            baseUrl, 
            requestIndex, 
            userMessageId: quickSettings.userMessageId 
        });

        try {
            // 发送请求到本地Go服务器
            const response = await fetch('http://localhost:10301/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(goServerRequest)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Go服务器请求失败: ${response.status} ${response.statusText}\n${JSON.stringify(errorData, null, 2)}`);
            }

            const data = await response.json();
            
            // 写入响应到文件
            await this.writeResponseToFile(data, requestIndex);

            if (data.success) {
                return {
                    success: true,
                    content: data.content,
                    usage: data.usage,
                    requestIndex: requestIndex
                };
            } else {
                throw new Error(data.error || '未知错误');
            }

        } catch (error) {
            console.error('Go服务器请求失败:', error);
            
            // 写入错误信息到文件
            await this.writeResponseToFile({
                error: true,
                message: error.message,
                timestamp: new Date().toISOString()
            }, requestIndex);

            throw error;
        }
    }

    // 并发发送请求（通过Go服务器）
    async sendConcurrentRequests(message, conversationHistory = [], customConcurrentCount = null, quickSettings = {}) {
        // 确保加载最新设置
        this.loadSettings();
        this.validateSettings(quickSettings);
        
        // 优先使用自定义并发数量，否则使用全局设置
        const concurrentCount = customConcurrentCount !== null ? customConcurrentCount : this.maxConcurrentRequests;
        console.log(`当前并发请求数设置: ${concurrentCount}${customConcurrentCount !== null ? ' (快捷设置)' : ' (全局设置)'}`);
        
        if (concurrentCount <= 1) {
            // 单个请求
            return await this.sendRequestWithRetry(message, conversationHistory, 0, quickSettings);
        }

        // 并发请求
        console.log(`发送 ${concurrentCount} 个并发请求到Go服务器`);
        console.log('快捷设置:', quickSettings);
        
        // 创建并发目录
        await this.createConcurrentFolder();

        // 优先使用快捷设置，否则使用全局设置
        const apiKey = quickSettings.apiKey || 
                      this.settings.apiKey || 
                      this.settings.currentApiKey;
        const baseUrl = quickSettings.provider || 
                       this.settings.providerUrl || 
                       this.settings.baseUrl || 
                       this.settings.currentBaseUrl;

        const requestBody = this.buildRequestBody(message, conversationHistory, 0, quickSettings);

        // 构建发送给Go服务器的请求数据
        const goServerRequest = {
            baseUrl: baseUrl,
            apiKey: apiKey,
            organization: this.settings.organization || '',
            requestBody: requestBody,
            concurrentCount: concurrentCount,
            userMessageId: quickSettings.userMessageId || '',
            requestTimeout: this.settings.requestTimeout || 30
        };

        try {
            // 发送请求到本地Go服务器（Go服务器内部处理并发）
            const response = await fetch('http://localhost:10301/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(goServerRequest)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Go服务器并发请求失败: ${response.status} ${response.statusText}\n${JSON.stringify(errorData, null, 2)}`);
            }

            const data = await response.json();
            
            // 写入响应到文件
            await this.writeResponseToFile(data, 0);

            if (data.success) {
                // 如果有并发结果，处理并发响应
                if (data.concurrentResults && data.concurrentResults.length > 1) {
                    // 处理每个并发结果的文件写入
                    for (let i = 0; i < data.concurrentResults.length; i++) {
                        await this.writeResponseToFile(data.concurrentResults[i], i);
                    }
                    
                    return {
                        success: true,
                        content: data.content,
                        usage: data.usage,
                        requestIndex: data.requestIndex,
                        concurrentResults: data.concurrentResults,
                        successCount: data.successCount,
                        totalCount: data.totalCount,
                        isFinalResult: true,
                        userMessageId: quickSettings.userMessageId
                    };
                } else {
                    return {
                        success: true,
                        content: data.content,
                        usage: data.usage,
                        requestIndex: data.requestIndex,
                        userMessageId: quickSettings.userMessageId
                    };
                }
            } else {
                throw new Error(data.error || '所有并发请求都失败了');
            }
        } catch (error) {
            console.error('Go服务器并发请求失败:', error);
            throw error;
        }
    }

    // 重试机制
    async sendWithRetry(message, conversationHistory = [], customConcurrentCount = null, quickSettings = {}) {
        const maxRetries = this.settings?.retryAttempts || 2;
        let lastError;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    console.log(`第 ${attempt + 1} 次重试...`);
                    // 重试前等待一段时间
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }

                return await this.sendConcurrentRequests(message, conversationHistory, customConcurrentCount, quickSettings);
            } catch (error) {
                lastError = error;
                console.error(`请求失败 (尝试 ${attempt + 1}/${maxRetries + 1}):`, error.message);
                
                if (attempt === maxRetries) {
                    break;
                }
            }
        }

        throw lastError;
    }

    // 处理流式响应
    async handleStreamResponse(response, requestIndex) {
        console.log('开始处理流式响应');
        
        let fullContent = '';
        let usage = null;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6).trim();
                        
                        if (data === '[DONE]') {
                            console.log('流式响应结束');
                            break;
                        }

                        try {
                            const parsed = JSON.parse(data);
                            
                            if (parsed.choices && parsed.choices[0]) {
                                const delta = parsed.choices[0].delta;
                                
                                if (delta && delta.content) {
                                    fullContent += delta.content;
                                    
                                    // 触发流式更新事件
                                    if (window.chatManager && typeof window.chatManager.handleStreamUpdate === 'function') {
                                        window.chatManager.handleStreamUpdate(fullContent, requestIndex);
                                    }
                                }
                            }

                            // 保存usage信息
                            if (parsed.usage) {
                                usage = parsed.usage;
                            }

                        } catch (parseError) {
                            console.warn('解析流式数据失败:', parseError, 'data:', data);
                        }
                    }
                }
            }

            // 写入完整响应到文件
            const finalData = {
                choices: [{
                    message: {
                        content: fullContent
                    }
                }],
                usage: usage
            };
            await this.writeResponseToFile(finalData, requestIndex);

            return {
                success: true,
                content: fullContent,
                usage: usage,
                requestIndex: requestIndex,
                isStream: true
            };

        } catch (error) {
            console.error('流式响应处理失败:', error);
            throw error;
        } finally {
            reader.releaseLock();
        }
    }
}

// 全局API管理器实例
window.apiManager = new APIManager();