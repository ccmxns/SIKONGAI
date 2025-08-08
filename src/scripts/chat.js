// 聊天功能
class ChatManager {
    constructor() {
        this.conversations = [];
        this.currentConversationId = null;
        this.pendingRequests = new Map(); // 存储正在进行的请求 {conversationId: {userMessageId, promise}}
        this.fontScale = 1.0; // 字体缩放比例，默认1.0
        this.minFontScale = 0.5; // 最小缩放比例
        this.maxFontScale = 3.0; // 最大缩放比例
        this.attachedImages = []; // 存储当前附加的图片
        this.concurrentMessageCreated = new Map(); // 跟踪是否已创建并发消息 {conversationId: messageId}
        
        // 系统提示词预设
        this.systemPrompts = {
            'assistant': '你是一个有用、准确、简洁的AI助手。请用中文回答问题，提供清晰、有用的信息。',
            'translator': '你是一个专业的翻译助手。请准确翻译用户提供的文本，保持原意的同时使表达更自然流畅。如果用户输入中文，请翻译成英文；如果输入英文，请翻译成中文。',
            'coder': '你是一个专业的编程助手。请帮助用户解决编程问题，提供清晰的代码示例和解释。请使用最佳实践，并在必要时解释代码的工作原理。',
            'writer': '你是一个专业的写作助手。请帮助用户改善文本质量，包括润色、修正语法错误、提升表达清晰度和文采。请保持原文的核心意思和风格。'
        };
        
        this.init();
    }

    init() {
        this.loadConversations();
        this.loadFontScale(); // 加载保存的字体缩放比例
        this.setupEventListeners();
        this.setupInputHandlers();
        this.setupInputResizer(); // 设置输入区域拖拽调整功能
        
        // 恢复上次的会话
        if (!this.restoreLastConversation() && this.conversations.length > 0) {
            // 如果没有恢复到上次会话，默认选择第一个会话
            this.switchConversation(this.conversations[0].id);
        }
    }

    setupEventListeners() {
        // 新对话按钮
        const newChatBtn = document.getElementById('new-chat-btn');
        if (newChatBtn) {
            newChatBtn.addEventListener('click', () => {
                this.createNewConversation();
            });
        }



        // 清除历史按钮
        const clearHistoryBtn = document.getElementById('clear-history-btn');
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', () => {
                this.clearAllHistory();
            });
        }

        // 发送按钮
        const sendBtn = document.getElementById('send-btn');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                this.sendMessage();
            });
        }

        // 字体缩放功能
        this.setupFontScaling();

        // 快捷设置功能
        this.setupQuickSettings();

        // 图片处理功能
        this.setupImageHandling();
    }

    setupInputHandlers() {
        const chatInput = document.getElementById('chat-input');
        const sendBtn = document.getElementById('send-btn');
        const characterCount = document.querySelector('.character-count');
        const characterCountFixed = document.querySelector('.character-count-fixed');

        if (!chatInput || !sendBtn || !characterCount) return;

        // 更新输入框状态
        chatInput.addEventListener('input', () => {
            // 更新字符计数
            const length = chatInput.value.length;
            characterCount.textContent = `${length}`;
            
            // 控制字数统计显示/隐藏
            if (characterCountFixed) {
                if (length > 0) {
                    characterCountFixed.classList.add('show');
                } else {
                    characterCountFixed.classList.remove('show');
                }
            }
            
            // 更新发送按钮状态
            sendBtn.disabled = length === 0;
        });

        // 回车发送消息（Shift+Enter 换行）
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!sendBtn.disabled) {
                    this.sendMessage();
                }
            }
        });

        // 初始状态
        sendBtn.disabled = true;
    }

    setupInputResizer() {
        const resizer = document.getElementById('input-resizer');
        const inputContainer = document.getElementById('chat-input-container');
        
        if (!resizer || !inputContainer) return;

        // 恢复保存的高度
        this.restoreInputContainerHeight();

        let isResizing = false;
        let startY = 0;
        let startHeight = 0;

        const handleMouseDown = (e) => {
            isResizing = true;
            startY = e.clientY;
            startHeight = inputContainer.offsetHeight;
            
            // 防止文本选择
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'ns-resize';
            
            // 添加全局监听器
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            
            e.preventDefault();
        };

        const handleMouseMove = (e) => {
            if (!isResizing) return;
            
            const deltaY = startY - e.clientY; // 注意这里是减法，因为向上拖拽应该增加高度
            const newHeight = Math.max(80, Math.min(window.innerHeight * 0.6, startHeight + deltaY));
            
            inputContainer.style.height = `${newHeight}px`;
            e.preventDefault();
        };

        const handleMouseUp = () => {
            if (!isResizing) return;
            
            isResizing = false;
            
            // 恢复样式
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
            
            // 移除全局监听器
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            
            // 保存高度
            this.saveInputContainerHeight();
        };

        // 绑定事件
        resizer.addEventListener('mousedown', handleMouseDown);
        
        // 防止拖拽时的默认行为
        resizer.addEventListener('dragstart', (e) => e.preventDefault());
    }

    saveInputContainerHeight() {
        const inputContainer = document.getElementById('chat-input-container');
        if (inputContainer) {
            const height = inputContainer.offsetHeight;
            localStorage.setItem('inputContainerHeight', height.toString());
        }
    }

    restoreInputContainerHeight() {
        const savedHeight = localStorage.getItem('inputContainerHeight');
        const inputContainer = document.getElementById('chat-input-container');
        
        if (savedHeight && inputContainer) {
            const height = parseInt(savedHeight, 10);
            if (height >= 80 && height <= window.innerHeight * 0.6) {
                inputContainer.style.height = `${height}px`;
            }
        }
    }

    createNewConversation() {
        const conversation = {
            id: window.sikongAI.generateId(),
            title: '新对话',
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        this.conversations.unshift(conversation);
        this.currentConversationId = conversation.id;
        this.saveConversations();
        this.saveCurrentConversationId(); // 保存当前会话ID
        this.renderConversationList();
        this.renderMessages();
        this.showWelcomeMessage();

        console.log('创建新对话:', conversation.id);
    }

    sendMessage() {
        const chatInput = document.getElementById('chat-input');
        if (!chatInput) return;

        const text = chatInput.value.trim();
        if (!text) return;

        // 如果没有当前对话，创建一个新的
        if (!this.currentConversationId) {
            this.createNewConversation();
        }

        const conversation = this.getCurrentConversation();
        if (!conversation) return;

        // 收集附加的图片base64数据
        const imageBase64Array = this.attachedImages.map(img => img.base64);

        // 添加用户消息
        const userMessage = {
            id: window.sikongAI.generateId(),
            type: 'user',
            content: text,
            timestamp: new Date(),
            images: imageBase64Array // 添加图片数据
        };

        conversation.messages.push(userMessage);
        
        // 更新对话标题（使用第一条消息的前20个字符）
        if (conversation.messages.length === 1) {
            conversation.title = text.substring(0, 20) + (text.length > 20 ? '...' : '');
        }

        conversation.updatedAt = new Date();
        
        // 清空输入框
        chatInput.value = '';
        document.querySelector('.character-count').textContent = '0';
        document.getElementById('send-btn').disabled = true;
        
        // 隐藏字数统计
        const characterCountFixed = document.querySelector('.character-count-fixed');
        if (characterCountFixed) {
            characterCountFixed.classList.remove('show');
        }
        
        // 清除附加的图片
        this.clearAllImages();

        // 更新界面
        this.saveConversations();
        this.renderMessages();

        // 发送真实的AI请求
        this.sendAIRequest(conversation, userMessage);
        
        // 请求开始后立即更新对话列表以显示loading指示器
        this.renderConversationList();

        console.log('发送消息:', text);
    }

    async sendAIRequest(conversation, userMessage) {
        // 清理并发消息创建标记，但只在没有正在进行的请求时清理
        if (!this.pendingRequests.has(conversation.id)) {
            this.concurrentMessageCreated.delete(conversation.id);
            console.log('开始新的AI请求，清理并发消息标记');
        } else {
            console.log('检测到并发请求，保持现有状态');
        }
        
        // 记录正在进行的请求
        const requestInfo = {
            userMessageId: userMessage.id,
            timestamp: new Date()
        };
        
        // 显示正在输入指示器
        this.showTypingIndicator();

        try {
            // 获取对话历史（排除当前用户消息），并处理版本合并
            const conversationHistory = this.buildConversationHistory(conversation.messages.slice(0, -1));

            // 获取快捷设置
            const quickConcurrentCount = this.getQuickConcurrentCount();
            const quickSettings = this.getQuickSettings();
            console.log('快捷设置:', { concurrentCount: quickConcurrentCount, ...quickSettings });

            // 创建请求Promise并存储，传入用户消息ID用于关联
            const enhancedQuickSettings = {
                ...quickSettings,
                userMessageId: userMessage.id  // 传递用户消息ID
            };
            
            const requestPromise = window.apiManager.sendWithRetry(
                userMessage, 
                conversationHistory,
                quickConcurrentCount,
                enhancedQuickSettings
            );

            // 存储到pendingRequests中
            this.pendingRequests.set(conversation.id, {
                ...requestInfo,
                promise: requestPromise
            });

            // 等待请求完成
            const result = await requestPromise;

            // 请求完成，从pending列表中移除
            this.pendingRequests.delete(conversation.id);
            
            // 只有当前对话才隐藏typing indicator
            if (this.currentConversationId === conversation.id) {
            this.hideTypingIndicator();
            }

            // 使用统一的处理逻辑
            this.processAIResponse(conversation, result);

            console.log('AI回复成功:', result);

        } catch (error) {
            // 请求失败，从pending列表中移除
            this.pendingRequests.delete(conversation.id);
            
            // 清理并发消息创建标记
            this.concurrentMessageCreated.delete(conversation.id);
            
            // 只有当前对话才隐藏typing indicator
            if (this.currentConversationId === conversation.id) {
                this.hideTypingIndicator();
            }
            
            console.error('AI请求失败:', error);

            // 创建错误消息
            const errorMessage = {
                id: window.sikongAI.generateId(),
                type: 'assistant',
                content: `抱歉，请求失败了：${error.message}\n\n请检查您的API设置并重试。`,
                timestamp: new Date(),
                isError: true
            };

            conversation.messages.push(errorMessage);
            conversation.updatedAt = new Date();

            this.saveConversations();
            
            // 更新对话列表以移除loading指示器
            this.renderConversationList();
            
            // 只有当前对话才更新UI
            if (this.currentConversationId === conversation.id) {
                this.renderMessages();
            }

            // 显示错误通知
            window.sikongAI.showNotification(`请求失败: ${error.message}`, 'error');
        }
    }

    // 统一处理AI响应
    processAIResponse(conversation, result) {
        // 检查是否为流式响应完成
        if (result.isStream) {
            console.log('流式响应完成，更新消息状态');
            
            // 查找对应的流式消息
            let streamingMessage = null;
            for (let i = conversation.messages.length - 1; i >= 0; i--) {
                if (conversation.messages[i].type === 'assistant' && conversation.messages[i].isStreaming) {
                    streamingMessage = conversation.messages[i];
                    break;
                }
            }

            if (streamingMessage) {
                // 更新流式消息为完成状态
                streamingMessage.content = result.content;
                streamingMessage.usage = result.usage;
                streamingMessage.requestIndex = result.requestIndex;
                streamingMessage.isStreaming = false; // 标记为完成
                
                // 移除流式指示器
                this.removeStreamingIndicator(streamingMessage.id);
            } else {
                console.warn('未找到对应的流式消息');
            }
        } else {
            // 检查是否有并发结果
            if (result.concurrentResults && result.concurrentResults.length > 1) {
                // 检查是否已经存在部分结果消息（通过concurrentMessageCreated准确查找）
                let existingConcurrentMessage = null;
                const expectedMessageId = this.concurrentMessageCreated.get(conversation.id);
                if (expectedMessageId) {
                    // 通过ID精确查找，避免误匹配其他消息
                    existingConcurrentMessage = conversation.messages.find(msg => msg.id === expectedMessageId);
                    if (!existingConcurrentMessage) {
                        console.warn('concurrentMessageCreated中记录的消息ID未找到，清理状态');
                        this.concurrentMessageCreated.delete(conversation.id);
                    }
                }

                if (existingConcurrentMessage && result.isFinalResult) {
                    // 更新现有的部分结果消息为最终状态
                    existingConcurrentMessage.concurrentResults = result.concurrentResults;
                    existingConcurrentMessage.successCount = result.successCount;
                    existingConcurrentMessage.totalCount = result.totalCount;
                    existingConcurrentMessage.isPartial = false; // 标记为最终结果
                    
                    // 确保选择的是有效的结果
                    const currentIndex = existingConcurrentMessage.selectedIndex || 0;
                    const currentResult = result.concurrentResults[currentIndex];
                    if (currentResult && currentResult.success) {
                        existingConcurrentMessage.content = currentResult.content;
                        existingConcurrentMessage.usage = currentResult.usage;
                    }
                    
                    console.log('更新现有并发消息为最终状态');
                    
                    // 清理并发消息创建标记
                    this.concurrentMessageCreated.delete(conversation.id);
                    
                    // 只有最终结果才显示完成通知
                    window.sikongAI.showNotification(`并发请求完成！成功 ${result.successCount}/${result.totalCount} 个请求`, 'success');
                } else if (!existingConcurrentMessage) {
                    // 没有现有消息，创建新的并发消息（这种情况应该很少发生）
                    console.warn('未找到现有并发消息，创建新消息');
                    const aiMessage = {
                        id: window.sikongAI.generateId(),
                        type: 'assistant',
                        content: result.content,
                        timestamp: new Date(),
                        usage: result.usage,
                        requestIndex: result.requestIndex,
                        concurrentResults: result.concurrentResults,
                        selectedIndex: 0,
                        successCount: result.successCount,
                        totalCount: result.totalCount,
                        isPartial: false,
                        userMessageId: result.userMessageId // 关联用户消息ID
                    };

                    conversation.messages.push(aiMessage);
                    
                    if (result.isFinalResult) {
                        window.sikongAI.showNotification(`并发请求完成！成功 ${result.successCount}/${result.totalCount} 个请求`, 'success');
                    }
                }
            } else {
                // 单个回复消息
                const aiMessage = {
                    id: window.sikongAI.generateId(),
                    type: 'assistant',
                    content: result.content,
                    timestamp: new Date(),
                    usage: result.usage,
                    requestIndex: result.requestIndex,
                    userMessageId: result.userMessageId // 关联用户消息ID，确保响应对应关系
                };

                conversation.messages.push(aiMessage);
                
                if (result.requestIndex !== undefined && result.requestIndex > 0) {
                    window.sikongAI.showNotification(`请求成功！使用了第 ${result.requestIndex + 1} 个并发请求`, 'success');
                }
            }
        }

        conversation.updatedAt = new Date();
        this.saveConversations();
        
        // 更新对话列表以移除loading指示器
        this.renderConversationList();
        
        // 只有当前对话才更新UI
        if (this.currentConversationId === conversation.id) {
            this.renderMessages();
        }
    }

    // 处理部分并发结果（第一个成功的响应）
    handlePartialConcurrentResult(result) {
        const conversation = this.getCurrentConversation();
        if (!conversation) return;

        console.log('收到第一个并发响应，立即显示');

        // 检查是否已经为这个对话创建了并发消息
        if (this.concurrentMessageCreated.has(conversation.id)) {
            console.log('并发消息已存在，跳过创建');
            return;
        }

        // 查找是否已经有并发消息（仅查找isPartial的消息，避免覆盖已完成的消息）
        let existingMessage = null;
        for (let i = conversation.messages.length - 1; i >= 0; i--) {
            if (conversation.messages[i].type === 'assistant' && 
                conversation.messages[i].concurrentResults &&
                conversation.messages[i].isPartial === true) {  // 只查找未完成的并发消息
                existingMessage = conversation.messages[i];
                break;
            }
        }

        if (!existingMessage) {
            // 找到第一个成功的结果索引
            const firstSuccessIndex = result.concurrentResults.findIndex(r => r.success);
            
            // 创建新的并发消息
            const aiMessage = {
                id: window.sikongAI.generateId(),
                type: 'assistant',
                content: result.content,
                timestamp: new Date(),
                usage: result.usage,
                requestIndex: result.requestIndex,
                concurrentResults: result.concurrentResults,
                selectedIndex: firstSuccessIndex !== -1 ? firstSuccessIndex : 0, // 选择第一个成功的回复
                successCount: result.successCount,
                totalCount: result.totalCount,
                isPartial: true, // 标记为部分结果
                userMessageId: result.userMessageId // 关联用户消息ID，确保响应对应关系
            };

            conversation.messages.push(aiMessage);
            
            // 标记已创建并发消息
            this.concurrentMessageCreated.set(conversation.id, aiMessage.id);
            
            // 隐藏typing indicator
            this.hideTypingIndicator();
            
            // 保存并更新UI
            this.saveConversations();
            if (this.currentConversationId === conversation.id) {
                this.renderMessages();
            }
            
            console.log('已显示第一个并发响应，等待其他响应...', aiMessage.id);
        } else {
            // 如果已存在消息，记录其ID
            this.concurrentMessageCreated.set(conversation.id, existingMessage.id);
            console.log('发现现有并发消息，记录ID:', existingMessage.id);
        }
    }

    // 更新并发结果状态
    updateConcurrentResults(updateData) {
        const conversation = this.getCurrentConversation();
        if (!conversation) return;

        // 查找并发消息
        let concurrentMessage = null;
        for (let i = conversation.messages.length - 1; i >= 0; i--) {
            if (conversation.messages[i].type === 'assistant' && 
                conversation.messages[i].concurrentResults) {
                concurrentMessage = conversation.messages[i];
                break;
            }
        }

        if (concurrentMessage) {
            // 更新并发结果
            concurrentMessage.concurrentResults = updateData.concurrentResults;
            concurrentMessage.successCount = updateData.successCount;
            
            // 如果当前选择的结果还在等待中，尝试切换到一个已完成的结果
            const currentIndex = concurrentMessage.selectedIndex || 0;
            const currentResult = concurrentMessage.concurrentResults[currentIndex];
            
            if (currentResult && currentResult.isPending) {
                // 寻找第一个成功完成的结果
                const firstSuccessIndex = concurrentMessage.concurrentResults.findIndex(r => r.success && !r.isPending);
                if (firstSuccessIndex !== -1) {
                    concurrentMessage.selectedIndex = firstSuccessIndex;
                    const successResult = concurrentMessage.concurrentResults[firstSuccessIndex];
                    concurrentMessage.content = successResult.content;
                    concurrentMessage.usage = successResult.usage;
                }
            }

            // 实时更新UI
            if (this.currentConversationId === conversation.id) {
                this.updateConcurrentMessageDisplay(concurrentMessage);
            }
            
            this.saveConversations();
            
            console.log(`并发结果更新: ${updateData.completedCount}/${updateData.totalCount} 完成`);
        }
    }

    // 实时更新并发消息显示
    updateConcurrentMessageDisplay(message) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        const messageElement = messagesContainer.querySelector(`[data-message-id="${message.id}"]`);
        if (!messageElement) return;

        // 更新并发选择器
        const concurrentSelector = messageElement.querySelector('.concurrent-selector');
        if (!concurrentSelector) return;

        // 重新渲染选择器
        this.renderConcurrentSelector(concurrentSelector, message);
        
        // 重新添加事件监听器
        this.attachConcurrentSelectorListeners(messageElement, message);
        
        // 更新消息内容
        this.updateMessageContent(messageElement, message);
    }

    // 渲染并发选择器
    renderConcurrentSelector(container, message) {
        const selectedIndex = message.selectedIndex || 0;
        const successCount = message.concurrentResults.filter(r => r.success).length;
        const pendingCount = message.concurrentResults.filter(r => r.isPending).length;
        
        container.innerHTML = `
            <div class="concurrent-header">
                <span class="concurrent-label">并发回复 (${successCount}/${message.totalCount} 成功${pendingCount > 0 ? `, ${pendingCount} 等待中` : ''}):</span>
                <label class="merge-versions-checkbox">
                    <input type="checkbox" 
                           data-message-id="${message.id}" 
                           ${message.mergeVersions ? 'checked' : ''}>
                    <span class="checkbox-label">合并到下次请求</span>
                </label>
            </div>
            <div class="concurrent-tabs">
                ${message.concurrentResults.map((result, index) => {
                    let tabClass = 'concurrent-tab';
                    let title = '';
                    
                    if (index === selectedIndex) {
                        tabClass += ' active';
                    }
                    
                    if (result.isPending) {
                        tabClass += ' pending';
                        title = '正在等待响应...';
                    } else if (result.success) {
                        tabClass += ' success';
                        title = '请求成功';
                    } else {
                        tabClass += ' error';
                        title = result.error;
                    }
                    
                    return `
                        <button class="${tabClass}" 
                                data-message-id="${message.id}" 
                                data-result-index="${index}"
                                title="${title}">
                            回复 ${index + 1}
                            ${result.isPending ? '<span class="pending-indicator">⏳</span>' : ''}
                        </button>
                    `;
                }).join('')}
            </div>
        `;
    }

    // 为并发选择器添加事件监听器
    attachConcurrentSelectorListeners(messageElement, message) {
        // 并发选择按钮
        const tabs = messageElement.querySelectorAll('.concurrent-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const messageId = e.target.dataset.messageId;
                const resultIndex = parseInt(e.target.dataset.resultIndex);
                this.switchConcurrentResult(messageId, resultIndex);
            });
        });

        // 版本合并复选框
        const mergeCheckbox = messageElement.querySelector('.merge-versions-checkbox input[type="checkbox"]');
        if (mergeCheckbox) {
            mergeCheckbox.addEventListener('change', (e) => {
                const messageId = e.target.dataset.messageId;
                this.toggleVersionMerge(messageId, e.target.checked);
            });
        }
    }

    // 更新消息内容
    updateMessageContent(messageElement, message) {
        const selectedIndex = message.selectedIndex || 0;
        const currentResult = message.concurrentResults[selectedIndex];
        const messageTextElement = messageElement.querySelector('.message-text');
        const messageUsageElement = messageElement.querySelector('.message-usage');
        
        // 移除所有状态类
        messageElement.classList.remove('error', 'pending');
        
        if (currentResult.isPending) {
            messageElement.classList.add('pending');
            if (messageTextElement) {
                messageTextElement.innerHTML = this.formatMessageContent('正在等待响应...', 'assistant');
            }
            if (messageUsageElement) {
                messageUsageElement.style.display = 'none';
            }
        } else if (currentResult.success) {
            if (messageTextElement) {
                messageTextElement.innerHTML = this.formatMessageContent(currentResult.content, 'assistant');
            }
            
            // 更新Token使用信息
            if (messageUsageElement) {
                if (currentResult.usage) {
                    messageUsageElement.innerHTML = `Token使用: ${currentResult.usage.total_tokens} (输入: ${currentResult.usage.prompt_tokens}, 输出: ${currentResult.usage.completion_tokens})`;
                    messageUsageElement.style.display = 'block';
                } else {
                    messageUsageElement.style.display = 'none';
                }
            }
        } else {
            messageElement.classList.add('error');
            if (messageTextElement) {
                messageTextElement.innerHTML = this.formatMessageContent(`请求失败: ${currentResult.error}`, 'assistant');
            }
            if (messageUsageElement) {
                messageUsageElement.style.display = 'none';
            }
        }
    }

    // 移除流式指示器
    removeStreamingIndicator(messageId) {
        const messagesContainer = document.getElementById('messages-container');
        if (!messagesContainer) return;

        const messageElement = messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            const indicator = messageElement.querySelector('.streaming-indicator');
            if (indicator) {
                indicator.remove();
                console.log('已移除流式指示器');
            }
        }
    }

    showTypingIndicator() {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'message assistant';
        typingIndicator.id = 'typing-indicator';
        typingIndicator.innerHTML = `
            <div class="message-avatar">🤖</div>
            <div class="message-content">
                <div class="typing-indicator">
                    <div class="typing-dots">
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                    </div>
                </div>
            </div>
        `;

        messagesContainer.appendChild(typingIndicator);
        this.scrollToBottomIfEnabled(messagesContainer);
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    // 恢复正在输入指示器（如果有正在进行的请求）
    restoreTypingIndicator(conversationId) {
        // 检查是否有正在进行的请求
        if (this.pendingRequests.has(conversationId)) {
            // 检查是否已经有并发消息显示了部分结果
            const conversation = this.conversations.find(conv => conv.id === conversationId);
            if (conversation) {
                // 查找是否已经有并发消息（部分结果已显示）
                const hasConcurrentResults = conversation.messages.some(message => 
                    message.type === 'assistant' && 
                    message.concurrentResults && 
                    message.concurrentResults.length > 1
                );
                
                // 如果已经有并发结果显示，就不再显示typing indicator
                if (hasConcurrentResults) {
                    console.log('检测到并发结果已显示，跳过typing indicator');
                    return;
                }
            }
            
            // 确保当前没有typing indicator
            this.hideTypingIndicator();
            
            // 如果这是当前对话，显示typing indicator
            if (this.currentConversationId === conversationId) {
                this.showTypingIndicator();
                
                // 注意：不需要再次调用handlePendingRequest
                // 因为原始的sendAIRequest已经在处理这个promise
                // 这里只是恢复UI状态，实际的请求处理仍在后台继续
            }
        }
    }



    getCurrentConversation() {
        return this.conversations.find(conv => conv.id === this.currentConversationId);
    }

    // 检查设置并决定是否滚动到底部
    scrollToBottomIfEnabled(messagesContainer) {
        try {
            // 获取设置，默认为true（保持向后兼容）
            const shouldAutoScroll = window.settingsManager?.settings?.autoScrollToBottom !== false;
            
            if (shouldAutoScroll) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        } catch (error) {
            // 如果设置获取失败，默认滚动（保持原有行为）
            console.warn('获取自动滚动设置失败，使用默认行为:', error);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    renderMessages() {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        const conversation = this.getCurrentConversation();
        
        if (!conversation || conversation.messages.length === 0) {
            this.showWelcomeMessage();
            return;
        }

        messagesContainer.innerHTML = '';

        conversation.messages.forEach(message => {
            const messageElement = this.createMessageElement(message);
            messagesContainer.appendChild(messageElement);
        });

        // 滚动到底部
        this.scrollToBottomIfEnabled(messagesContainer);
        
        // 检查是否有正在进行的请求，如果有则恢复typing indicator
        this.restoreTypingIndicator(conversation.id);
    }

    createMessageElement(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.type}`;
        messageDiv.setAttribute('data-message-id', message.id);
        
        if (message.isError) {
            messageDiv.classList.add('error');
        }
        
        const avatar = message.type === 'user' ? '👤' : '🤖';
        const time = window.sikongAI.formatTime(new Date(message.timestamp));

        let additionalInfo = '';
        let concurrentSelector = '';

        // 如果是并发消息，创建选择器
        if (message.concurrentResults && message.concurrentResults.length > 1) {
            const selectedIndex = message.selectedIndex || 0;
            const currentResult = message.concurrentResults[selectedIndex];
            
            // 计算各种状态
            const successCount = message.concurrentResults.filter(r => r.success).length;
            const pendingCount = message.concurrentResults.filter(r => r.isPending).length;
            const completedCount = message.concurrentResults.filter(r => !r.isPending).length;
            
            // 创建并发选择器
            concurrentSelector = `
                <div class="concurrent-selector">
                    <div class="concurrent-header">
                        <span class="concurrent-label">并发回复 (${successCount}/${message.totalCount} 成功${pendingCount > 0 ? `, ${pendingCount} 等待中` : ''}):</span>
                        <label class="merge-versions-checkbox">
                            <input type="checkbox" 
                                   data-message-id="${message.id}" 
                                   ${message.mergeVersions ? 'checked' : ''}>
                            <span class="checkbox-label">合并到下次请求</span>
                        </label>
                    </div>
                    <div class="concurrent-tabs">
                        ${message.concurrentResults.map((result, index) => {
                            let tabClass = 'concurrent-tab';
                            let title = '';
                            
                            if (index === selectedIndex) {
                                tabClass += ' active';
                            }
                            
                            if (result.isPending) {
                                tabClass += ' pending';
                                title = '正在等待响应...';
                            } else if (result.success) {
                                tabClass += ' success';
                                title = '请求成功';
                            } else {
                                tabClass += ' error';
                                title = result.error;
                            }
                            
                            return `
                                <button class="${tabClass}" 
                                        data-message-id="${message.id}" 
                                        data-result-index="${index}"
                                        title="${title}">
                                    回复 ${index + 1}
                                    ${result.isPending ? '<span class="pending-indicator">⏳</span>' : ''}
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;

            // 使用当前选择的结果内容
            if (currentResult.isPending) {
                message.content = '正在等待响应...';
                messageDiv.classList.add('pending');
            } else if (currentResult.success) {
                message.content = currentResult.content;
                if (currentResult.usage) {
                    additionalInfo = `<div class="message-usage">
                        Token使用: ${currentResult.usage.total_tokens} (输入: ${currentResult.usage.prompt_tokens}, 输出: ${currentResult.usage.completion_tokens})
                    </div>`;
                }
            } else {
                message.content = `请求失败: ${currentResult.error}`;
                messageDiv.classList.add('error');
            }
        } else {
            // 单个回复的附加信息
            if (message.usage) {
                additionalInfo = `<div class="message-usage">
                    Token使用: ${message.usage.total_tokens} (输入: ${message.usage.prompt_tokens}, 输出: ${message.usage.completion_tokens})
                </div>`;
            }
            if (message.requestIndex !== undefined) {
                additionalInfo += `<div class="message-request-info">并发请求 #${message.requestIndex + 1}</div>`;
            }
        }

        // 创建消息操作按钮
        const messageActions = this.createMessageActions(message);

        // 生成图片HTML
        const imagesHtml = this.renderMessageImages(message);

        messageDiv.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                ${concurrentSelector}
                ${imagesHtml}
                <div class="message-text">${this.formatMessageContent(message.content, message.type)}</div>
                ${additionalInfo}
                <div class="message-footer">
                <div class="message-time">${time}</div>
                    <div class="message-actions">
                        ${messageActions}
                    </div>
                </div>
            </div>
        `;

        // 为并发选择器添加事件监听器
        if (message.concurrentResults && message.concurrentResults.length > 1) {
            const tabs = messageDiv.querySelectorAll('.concurrent-tab');
            tabs.forEach(tab => {
                tab.addEventListener('click', (e) => {
                    const messageId = e.target.dataset.messageId;
                    const resultIndex = parseInt(e.target.dataset.resultIndex);
                    this.switchConcurrentResult(messageId, resultIndex);
                });
            });

            // 添加版本合并复选框事件监听器
            const mergeCheckbox = messageDiv.querySelector('.merge-versions-checkbox input[type="checkbox"]');
            if (mergeCheckbox) {
                mergeCheckbox.addEventListener('change', (e) => {
                    const messageId = e.target.dataset.messageId;
                    this.toggleVersionMerge(messageId, e.target.checked);
                });
            }
        }

        // 为消息操作按钮添加事件监听器
        this.attachMessageActionListeners(messageDiv, message);

        return messageDiv;
    }

    // 创建消息操作按钮
    createMessageActions(message) {
        let actions = '';

                if (message.type === 'assistant') {
            // AI消息：重新生成按钮 + 编辑按钮 + 复制按钮
            actions = `
                <button class="message-action-btn regenerate-btn" 
                        title="重新生成" 
                        data-message-id="${message.id}">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M1.463 4.687a.756.756 0 0 1 .724-.566h.15a.756.756 0 0 1 .725.566l.76 2.75a.756.756 0 0 1-.725.944H2.94a.756.756 0 0 1-.725-.944l.248-.937zm2.925 8.702a.756.756 0 0 1 .724-.567h.15a.756.756 0 0 1 .725.567l.76 2.75a.756.756 0 0 1-.725.944H5.865a.756.756 0 0 1-.725-.944l.248-.936z"/>
                        <path d="M8 3a5 5 0 1 0 5 5h-1a4 4 0 1 1-4-4V2.82l1.09 1.09a.5.5 0 0 0 .707-.707L8.5 1.91a.5.5 0 0 0-.707 0L6.5 3.203a.5.5 0 0 0 .707.707L8 2.82V3z"/>
                    </svg>
                </button>
                <button class="message-action-btn edit-btn" 
                        title="编辑消息" 
                        data-message-id="${message.id}">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm.176 4.823L9.75 4.81l-6.286 6.287a.253.253 0 0 0-.064.108l-.558 1.953 1.953-.558a.253.253 0 0 0 .108-.064Zm1.238-3.763a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354Z"/>
                    </svg>
                </button>
                <button class="message-action-btn copy-btn" 
                        title="复制内容" 
                        data-message-id="${message.id}">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/>
                        <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/>
                    </svg>
                </button>
`;
        } else if (message.type === 'user') {
            // 用户消息：编辑按钮 + 复制按钮
            actions = `
                <button class="message-action-btn edit-btn" 
                        title="编辑消息" 
                        data-message-id="${message.id}">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm.176 4.823L9.75 4.81l-6.286 6.287a.253.253 0 0 0-.064.108l-.558 1.953 1.953-.558a.253.253 0 0 0 .108-.064Zm1.238-3.763a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354Z"/>
                    </svg>
                </button>
                <button class="message-action-btn copy-btn" 
                        title="复制内容" 
                        data-message-id="${message.id}">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/>
                        <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/>
                    </svg>
                </button>
            `;
        }

        return actions;
    }

    // 为消息操作按钮添加事件监听器
    attachMessageActionListeners(messageDiv, message) {
        // 重新生成按钮
        const regenerateBtn = messageDiv.querySelector('.regenerate-btn');
        if (regenerateBtn) {
            regenerateBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.regenerateMessage(message.id);
            });
        }

        // 编辑按钮
        const editBtn = messageDiv.querySelector('.edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.editMessage(message.id);
            });
        }

        // 复制按钮
        const copyBtn = messageDiv.querySelector('.copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.copyMessageContent(message.id);
            });
        }
    }

    // 重新生成AI回复
    async regenerateMessage(messageId) {
        const conversation = this.getCurrentConversation();
        if (!conversation) return;

        const messageIndex = conversation.messages.findIndex(msg => msg.id === messageId);
        if (messageIndex === -1) return;

        const aiMessage = conversation.messages[messageIndex];
        if (aiMessage.type !== 'assistant') return;

        // 找到对应的用户消息
        let userMessage = null;
        for (let i = messageIndex - 1; i >= 0; i--) {
            if (conversation.messages[i].type === 'user') {
                userMessage = conversation.messages[i];
                break;
            }
        }

        if (!userMessage) {
            window.sikongAI.showNotification('无法找到对应的用户消息', 'error');
            return;
        }

        try {
            // 移除原来的AI消息和之后的所有消息
            conversation.messages.splice(messageIndex);
            
            // 保存并更新界面
            this.saveConversations();
            this.renderMessages();

            // 重新发送AI请求
            await this.sendAIRequest(conversation, userMessage);
            
            window.sikongAI.showNotification('正在重新生成回复...', 'info');

        } catch (error) {
            console.error('重新生成失败:', error);
            window.sikongAI.showNotification('重新生成失败: ' + error.message, 'error');
        }
    }

    // 复制消息内容
    copyMessageContent(messageId) {
        const conversation = this.getCurrentConversation();
        if (!conversation) return;

        const message = conversation.messages.find(msg => msg.id === messageId);
        if (!message) return;

        // 获取消息的纯文本内容（去除HTML标签和随机ID）
        let content = message.content;
        
        // 如果是用户消息，移除随机ID
        if (message.type === 'user') {
            content = content.replace(/\[请忽略该行内容，唯一随机任务id：[^\]]+\]/g, '').trim();
        }

        // 使用Clipboard API复制
        if (navigator.clipboard) {
            navigator.clipboard.writeText(content).then(() => {
                window.sikongAI.showNotification('内容已复制到剪贴板', 'success');
            }).catch(() => {
                this.fallbackCopyText(content);
            });
        } else {
            this.fallbackCopyText(content);
        }
    }

    // 降级复制方案
    fallbackCopyText(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            window.sikongAI.showNotification('内容已复制到剪贴板', 'success');
        } catch (err) {
            window.sikongAI.showNotification('复制失败，请手动复制', 'error');
        }
        
        document.body.removeChild(textArea);
    }

    // 构建对话历史，处理版本合并
    buildConversationHistory(messages) {
        return messages.map(message => {
            // 如果是AI消息且勾选了版本合并，且有多个成功的并发结果
            if (message.type === 'assistant' && 
                message.mergeVersions && 
                message.concurrentResults && 
                message.concurrentResults.length > 1) {
                
                // 获取所有成功的版本
                const successfulVersions = message.concurrentResults
                    .map((result, index) => ({ result, index }))
                    .filter(({ result }) => result.success);

                if (successfulVersions.length > 1) {
                    // 构建合并内容
                    let mergedContent = '';
                    successfulVersions.forEach(({ result, index }) => {
                        mergedContent += `# 回复版本${index + 1}：\n${result.content}\n\n`;
                    });
                    
                    console.log('合并版本内容:', mergedContent);
                    
                    // 返回带有合并内容的消息副本
                    return {
                        ...message,
                        content: mergedContent.trim()
                    };
                }
            }
            
            // 返回原始消息
            return message;
        });
    }

    // 获取快捷设置的并发数量
    getQuickConcurrentCount() {
        const quickInput = document.getElementById('quick-concurrent-count');
        if (!quickInput) return null;

        const value = quickInput.value.trim();
        if (value === '') return null; // 空值表示使用全局设置

        const num = parseInt(value);
        if (isNaN(num) || num < 1) {
            console.warn('快捷并发数量无效，使用全局设置');
            return null;
        }

        return num;
    }

    // 切换版本合并选项
    toggleVersionMerge(messageId, isChecked) {
        const conversation = this.getCurrentConversation();
        if (!conversation) return;

        const message = conversation.messages.find(msg => msg.id === messageId);
        if (!message) return;

        message.mergeVersions = isChecked;
        this.saveConversations();
        
        console.log(`消息 ${messageId} 版本合并设置为: ${isChecked}`);
    }

    // 渲染消息中的图片
    renderMessageImages(message) {
        if (!message.images || message.images.length === 0) {
            return '';
        }

        let imagesHtml = '<div class="message-images">';
        message.images.forEach((base64Image, index) => {
            const imageId = `msg-img-${message.id}-${index}`;
            imagesHtml += `
                <div class="message-image-wrapper" onclick="window.chatManager.openMessageImage('${base64Image}')">
                    <img src="data:image/jpeg;base64,${base64Image}" 
                         alt="用户上传的图片" 
                         class="message-image"
                         loading="lazy">
                </div>
            `;
        });
        imagesHtml += '</div>';
        
        return imagesHtml;
    }

    // 打开消息中的图片
    openMessageImage(base64Image) {
        const modal = document.createElement('div');
        modal.className = 'image-view-modal';
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>图片预览</h3>
                    <button class="modal-close-btn">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
                            <path d="M6 6l12 12M6 18L18 6"/>
                        </svg>
                    </button>
                </div>
                <div class="modal-body">
                    <img src="data:image/jpeg;base64,${base64Image}" alt="图片预览">
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 关闭模态框
        const closeModal = () => {
            document.body.removeChild(modal);
        };

        modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
        modal.querySelector('.modal-backdrop').addEventListener('click', closeModal);

        // ESC键关闭
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    }

    // 切换唯一ID的显示/隐藏
    toggleUniqueId(randomId) {
        const container = document.querySelector(`[data-random-id="${randomId}"]`);
        if (!container) return;
        
        const toggle = container.querySelector('.unique-id-toggle');
        const content = container.querySelector('.unique-id-content');
        const toggleText = container.querySelector('.toggle-text');
        const toggleIcon = container.querySelector('.toggle-icon');
        
        if (content.style.display === 'none') {
            content.style.display = 'block';
            toggleText.textContent = '隐藏随机任务ID';
            toggleIcon.style.transform = 'rotate(90deg)';
        } else {
            content.style.display = 'none';
            toggleText.textContent = '显示随机任务ID';
            toggleIcon.style.transform = 'rotate(0deg)';
        }
    }

    formatMessageContent(content, messageType = 'assistant') {
        // 处理用户消息中的随机ID
        if (messageType === 'user') {
            const uniqueIdRegex = /\[请忽略该行内容，唯一随机任务id：([^\]]+)\]/g;
            const match = uniqueIdRegex.exec(content);
            
            if (match) {
                const uniqueId = match[1];
                const contentWithoutId = content.replace(uniqueIdRegex, '');
                const randomId = Math.random().toString(36).substr(2, 9);
                
                // 创建可点击的随机ID元素
                const hiddenIdElement = `
                    <div class="unique-id-container" data-random-id="${randomId}">
                        <div class="unique-id-toggle" onclick="chatManager.toggleUniqueId('${randomId}')">
                            <span class="toggle-text">显示随机任务ID</span>
                            <svg class="toggle-icon" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                                <path d="M4 6l4 4V2z"/>
                            </svg>
                        </div>
                        <div class="unique-id-content" style="display: none;">
                            <code>[请忽略该行内容，唯一随机任务id：${uniqueId}]</code>
                        </div>
                    </div>
                `;
                
                // 使用丰富的markdown格式化
                const formattedContent = this.renderRichText(contentWithoutId);
                
                return formattedContent + hiddenIdElement;
            }
        }
        
        // 使用丰富的markdown格式化
        return this.renderRichText(content);
    }

    // 丰富的富文本渲染
    renderRichText(content) {
        // HTML转义函数
        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };

        // 1. 先转义HTML特殊字符
        let html = escapeHtml(content);

        // 2. 处理代码块（三个反引号）
        html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, language, code) => {
            const lang = language || 'text';
            const randomId = Math.random().toString(36).substr(2, 9);
            return `<div class="code-block" data-language="${lang}">
                <div class="code-header">
                    <span class="code-language">${lang.toUpperCase()}</span>
                    <button class="copy-code-btn" onclick="chatManager.copyCode('${randomId}')" title="复制代码">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/>
                            <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/>
                        </svg>
                    </button>
                </div>
                <pre id="${randomId}"><code class="language-${lang}">${code}</code></pre>
            </div>`;
        });

        // 3. 处理数学公式（LaTeX）
        html = html.replace(/\$\$([\s\S]*?)\$\$/g, '<div class="math-block">$1</div>');
        html = html.replace(/\$(.*?)\$/g, '<span class="math-inline">$1</span>');

        // 4. 处理标题
        html = html.replace(/^### (.*$)/gm, '<h3 class="message-h3">$1</h3>');
        html = html.replace(/^## (.*$)/gm, '<h2 class="message-h2">$1</h2>');
        html = html.replace(/^# (.*$)/gm, '<h1 class="message-h1">$1</h1>');

        // 5. 处理水平分割线
        html = html.replace(/^---+$/gm, '<hr class="message-hr">');
        
        // 6. 处理列表
        html = html.replace(/^\* (.*$)/gm, '<li class="message-li">$1</li>');
        html = html.replace(/^- (.*$)/gm, '<li class="message-li">$1</li>');
        
        // 处理有序列表（保留数字）
        let olCounter = 0;
        html = html.replace(/^(\d+)\. (.*$)/gm, (match, num, content) => {
            return `<li class="message-oli" data-number="${num}">${content}</li>`;
        });

        // 7. 包装列表项为列表
        html = html.replace(/(<li class="message-li">.*?<\/li>(\s*<li class="message-li">.*?<\/li>)*)/gs, (match) => {
            return `<ul class="message-ul">${match}</ul>`;
        });
        html = html.replace(/(<li class="message-oli"[^>]*>.*?<\/li>(\s*<li class="message-oli"[^>]*>.*?<\/li>)*)/gs, (match) => {
            return `<ol class="message-ol">${match}</ol>`;
        });

        // 8. 处理表格
        let tableRows = [];
        html = html.replace(/^\|(.+)\|$/gm, (match, content) => {
            const cells = content.split('|').map(cell => cell.trim());
            tableRows.push(cells);
            return match; // 暂时保持原样
        });
        
        // 处理完整的表格
        if (tableRows.length > 0) {
            let tableHtml = '<table class="message-table">';
            tableRows.forEach((row, index) => {
                const isHeader = index === 0;
                const cellTag = isHeader ? 'th' : 'td';
                tableHtml += `<tr>${row.map(cell => `<${cellTag} class="message-table-cell">${cell}</${cellTag}>`).join('')}</tr>`;
            });
            tableHtml += '</table>';
            
            // 替换表格标记
            html = html.replace(/(\|.+\|\n?)+/g, tableHtml);
        }

        // 9. 处理引用块
        html = html.replace(/^> (.*$)/gm, '<blockquote class="message-quote">$1</blockquote>');

        // 10. 处理链接
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="message-link" target="_blank" rel="noopener noreferrer">$1</a>');

        // 11. 处理图片
        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="message-image" onclick="chatManager.openImage(\'$2\')" />');

        // 12. 处理粗体和斜体
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="message-bold">$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em class="message-italic">$1</em>');

        // 13. 处理行内代码
        html = html.replace(/`([^`]+)`/g, '<code class="message-code">$1</code>');

        // 14. 处理删除线
        html = html.replace(/~~(.*?)~~/g, '<del class="message-strikethrough">$1</del>');

        // 15. 处理下划线
        html = html.replace(/__(.*?)__/g, '<u class="message-underline">$1</u>');

        // 16. 处理高亮
        html = html.replace(/==(.*?)==/g, '<mark class="message-highlight">$1</mark>');

        // 17. 处理换行
        html = html.replace(/\n/g, '<br>');

        // 18. 处理段落
        html = html.replace(/(<br>\s*){2,}/g, '</p><p class="message-paragraph">');
        html = `<p class="message-paragraph">${html}</p>`;

        return html;
    }

    // 复制代码功能
    copyCode(elementId) {
        const codeElement = document.getElementById(elementId);
        if (!codeElement) return;
        
        const code = codeElement.textContent;
        
        // 使用Clipboard API
        if (navigator.clipboard) {
            navigator.clipboard.writeText(code).then(() => {
                window.sikongAI.showNotification('代码已复制到剪贴板', 'success');
            }).catch(() => {
                this.fallbackCopyCode(code);
            });
        } else {
            this.fallbackCopyCode(code);
        }
    }

    // 降级复制方案
    fallbackCopyCode(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            window.sikongAI.showNotification('代码已复制到剪贴板', 'success');
        } catch (err) {
            window.sikongAI.showNotification('复制失败，请手动复制', 'error');
        }
        
        document.body.removeChild(textArea);
    }

    // 打开图片查看器
    openImage(src) {
        // 创建模态框显示大图
        const modal = document.createElement('div');
        modal.className = 'image-modal';
        modal.innerHTML = `
            <div class="image-modal-overlay" onclick="this.parentElement.remove()">
                <div class="image-modal-content" onclick="event.stopPropagation()">
                    <button class="image-modal-close" onclick="this.closest('.image-modal').remove()">&times;</button>
                    <img src="${src}" alt="图片预览" class="image-modal-img" />
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 添加键盘事件监听
        const handleKeyPress = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', handleKeyPress);
            }
        };
        document.addEventListener('keydown', handleKeyPress);
    }

    showWelcomeMessage() {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        messagesContainer.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">🤖</div>
                <h3>欢迎使用司空AI</h3>
                <p>我是你的智能助手，有什么可以帮助你的吗？</p>
            </div>
        `;
    }

    renderConversationList() {
        const chatHistory = document.getElementById('chat-history');
        if (!chatHistory) return;

        if (this.conversations.length === 0) {
            chatHistory.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">暂无对话历史</div>';
            return;
        }

        chatHistory.innerHTML = '';

        this.conversations.forEach(conversation => {
            const item = document.createElement('div');
            item.className = 'chat-history-item';
            if (conversation.id === this.currentConversationId) {
                item.classList.add('active');
            }

            // 检查是否有正在进行的请求
            const hasPendingRequest = this.pendingRequests.has(conversation.id);
            const loadingIndicator = hasPendingRequest ? '<div class="loading-indicator">⏳</div>' : '';

            item.innerHTML = `
                <span class="conversation-title" title="${conversation.title}">${conversation.title}</span>
                ${loadingIndicator}
                <button class="delete-conversation-btn" title="删除对话">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                        <path fill-rule="evenodd" d="M5.75 1a.75.75 0 00-.75.75v1.5h6.5v-1.5a.75.75 0 00-.75-.75h-5zM4.25 1.75A2.25 2.25 0 016.5 0h3a2.25 2.25 0 012.25 2.25v1.5h2.5a.75.75 0 010 1.5h-.5v9a2.25 2.25 0 01-2.25 2.25h-7A2.25 2.25 0 012.25 14.25v-9h-.5a.75.75 0 010-1.5h2.5v-1.5zm1.5 3.75a.75.75 0 011.5 0v7a.75.75 0 01-1.5 0v-7zm3.5 0a.75.75 0 011.5 0v7a.75.75 0 01-1.5 0v-7z" clip-rule="evenodd"/>
                    </svg>
                </button>
            `;
            
            // 如果有正在进行的请求，添加样式类
            if (hasPendingRequest) {
                item.classList.add('has-pending-request');
            }

            // 点击标题切换对话
            const titleElement = item.querySelector('.conversation-title');
            titleElement.addEventListener('click', () => {
                this.switchConversation(conversation.id);
            });

            // 点击删除按钮删除对话
            const deleteBtn = item.querySelector('.delete-conversation-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止事件冒泡
                this.deleteConversation(conversation.id);
            });

            // 为历史记录项添加右键菜单
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showHistoryContextMenu(e, conversation);
            });

            chatHistory.appendChild(item);
        });
    }

    switchConversation(conversationId) {
        this.currentConversationId = conversationId;
        this.renderConversationList();
        this.renderMessages();
        
        // 检查是否有正在进行的请求，如果有则恢复typing indicator
        this.restoreTypingIndicator(conversationId);
        
        // 保存当前会话ID
        this.saveCurrentConversationId();
        
        console.log('切换到对话:', conversationId);
    }

    loadConversations() {
        try {
            const saved = localStorage.getItem('sikongai-conversations');
            if (saved) {
                this.conversations = JSON.parse(saved);
                // 转换日期字符串为Date对象
                this.conversations.forEach(conv => {
                    conv.createdAt = new Date(conv.createdAt);
                    conv.updatedAt = new Date(conv.updatedAt);
                    conv.messages.forEach(msg => {
                        msg.timestamp = new Date(msg.timestamp);
                    });
                });
            }
        } catch (error) {
            console.error('加载对话历史失败:', error);
            this.conversations = [];
        }

        this.renderConversationList();
    }

    saveConversations() {
        try {
            localStorage.setItem('sikongai-conversations', JSON.stringify(this.conversations));
        } catch (error) {
            console.error('保存对话历史失败:', error);
        }
    }

    // 保存当前会话ID
    saveCurrentConversationId() {
        try {
            if (this.currentConversationId) {
                localStorage.setItem('sikongai-current-conversation', this.currentConversationId);
            }
        } catch (error) {
            console.error('保存当前会话ID失败:', error);
        }
    }

    // 恢复上次的会话
    restoreLastConversation() {
        try {
            const lastConversationId = localStorage.getItem('sikongai-current-conversation');
            if (lastConversationId && this.conversations.find(conv => conv.id === lastConversationId)) {
                this.switchConversation(lastConversationId);
                console.log('已恢复上次会话:', lastConversationId);
                return true;
            }
        } catch (error) {
            console.error('恢复上次会话失败:', error);
        }
        return false;
    }

    // 应用气泡宽度设置
    applyBubbleWidth(widthPercent) {
        try {
            // 计算实际的像素值 (假设基准宽度为800px)
            const baseWidth = 800;
            const actualWidth = (baseWidth * widthPercent) / 100;
            
            // 设置CSS自定义属性
            document.documentElement.style.setProperty('--bubble-max-width', `${actualWidth}px`);
            
            console.log(`气泡宽度已设置为: ${widthPercent}% (${actualWidth}px)`);
        } catch (error) {
            console.error('应用气泡宽度失败:', error);
        }
    }

    // 加载气泡宽度设置
    loadBubbleWidth() {
        try {
            const settings = this.getQuickSettings();
            const bubbleWidth = parseInt(settings.bubbleWidth || '85');
            
            // 验证宽度范围 (60%-600%)
            const validWidth = Math.max(60, Math.min(600, bubbleWidth));
            
            // 更新滑块值和显示文本
            const bubbleWidthSlider = document.getElementById('bubble-width');
            const bubbleWidthValue = document.querySelector('.bubble-width-value');
            
            if (bubbleWidthSlider) {
                bubbleWidthSlider.value = validWidth;
            }
            
            if (bubbleWidthValue) {
                bubbleWidthValue.textContent = validWidth + '%';
            }
            
            // 应用宽度设置
            this.applyBubbleWidth(validWidth);
            
            console.log('气泡宽度设置已加载:', validWidth + '%');
        } catch (error) {
            console.error('加载气泡宽度设置失败:', error);
        }
    }

    async openSettings() {
        try {
            console.log('正在打开设置窗口...');
            
            // 使用 Electron API 在新窗口中打开设置，不会中断当前对话
            if (window.electronAPI && window.electronAPI.openSettings) {
                await window.electronAPI.openSettings();
                console.log('设置窗口已打开');
            } else {
                // 降级方案：如果在非 Electron 环境（如浏览器）中运行
                console.warn('Electron API 不可用，使用降级方案');
                window.open('settings.html', '_blank', 'width=900,height=700,resizable=yes,scrollbars=yes');
            }
        } catch (error) {
            console.error('打开设置窗口失败:', error);
            
            // 最后的降级方案
            try {
                window.open('settings.html', '_blank', 'width=900,height=700,resizable=yes,scrollbars=yes');
            } catch (fallbackError) {
                console.error('降级方案也失败了:', fallbackError);
                window.sikongAI.showNotification('无法打开设置窗口，请稍后重试', 'error');
            }
        }
    }

    clearAllHistory() {
        // 显示自定义确认弹窗
        this.showCustomConfirm({
            title: '清除所有聊天历史',
            message: '确定要清除所有聊天历史吗？',
            details: '此操作不可撤销，将删除：\n• 所有对话记录\n• 所有消息内容\n• 所有聊天会话',
            confirmText: '确定清除',
            cancelText: '取消',
            type: 'danger',
            onConfirm: () => {
                try {
                    // 清空对话数组
                    this.conversations = [];
                    this.currentConversationId = null;
                    
                    // 清除本地存储
                    localStorage.removeItem('sikongai-conversations');
                    
                    // 更新界面
                    this.renderConversationList();
                    this.showWelcomeMessage();
                    
                    // 显示成功通知
                    window.sikongAI.showNotification('所有聊天历史已清除', 'success');
                    
                    console.log('聊天历史已清除');
                } catch (error) {
                    console.error('清除历史失败:', error);
                    window.sikongAI.showNotification('清除历史失败: ' + error.message, 'error');
                }
            }
        });
    }

    // 删除单个对话
    deleteConversation(conversationId) {
        const index = this.conversations.findIndex(conv => conv.id === conversationId);
        if (index === -1) return;

        const conversation = this.conversations[index];
        
        try {
            // 从数组中移除
            this.conversations.splice(index, 1);
            
            // 如果删除的是当前对话，清空当前对话ID
            if (this.currentConversationId === conversationId) {
                this.currentConversationId = null;
                this.showWelcomeMessage();
            }
            
            // 保存到本地存储
            this.saveConversations();
            
            // 更新界面
            this.renderConversationList();
            
            // 显示成功通知
            window.sikongAI.showNotification(`对话"${conversation.title}"已删除`, 'success');
            
            console.log('对话已删除:', conversationId);
        } catch (error) {
            console.error('删除对话失败:', error);
            window.sikongAI.showNotification('删除对话失败: ' + error.message, 'error');
        }
    }

    // 切换并发结果
    switchConcurrentResult(messageId, resultIndex) {
        const conversation = this.getCurrentConversation();
        if (!conversation) return;

        const message = conversation.messages.find(msg => msg.id === messageId);
        if (!message || !message.concurrentResults) return;

        // 更新选择的索引
        message.selectedIndex = resultIndex;
        
        // 保存到本地存储
        this.saveConversations();
        
        // 精准更新这条消息的显示内容
        this.updateMessageDisplay(messageId, message);
        
        console.log(`切换到并发结果 ${resultIndex + 1}`);
    }

    // 精准更新单条消息的显示
    updateMessageDisplay(messageId, message) {
        // 找到对应的消息元素
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        const messageElements = messagesContainer.querySelectorAll('.message');
        let targetElement = null;

        // 通过消息ID找到对应的DOM元素
        targetElement = messagesContainer.querySelector(`[data-message-id="${messageId}"]`);

        if (!targetElement) return;

        const selectedIndex = message.selectedIndex || 0;
        const currentResult = message.concurrentResults[selectedIndex];
        
        // 更新选项卡状态
        const tabs = targetElement.querySelectorAll('.concurrent-tab');
        tabs.forEach((tab, index) => {
            tab.classList.toggle('active', index === selectedIndex);
        });

        // 更新消息内容
        const messageTextElement = targetElement.querySelector('.message-text');
        const messageUsageElement = targetElement.querySelector('.message-usage');
        
        if (currentResult.success) {
            // 成功的回复
            targetElement.classList.remove('error');
            if (messageTextElement) {
                messageTextElement.innerHTML = this.formatMessageContent(currentResult.content, 'assistant');
            }
            
            // 更新Token使用信息
            if (messageUsageElement) {
                if (currentResult.usage) {
                    messageUsageElement.innerHTML = `Token使用: ${currentResult.usage.total_tokens} (输入: ${currentResult.usage.prompt_tokens}, 输出: ${currentResult.usage.completion_tokens})`;
                    messageUsageElement.style.display = 'block';
                } else {
                    messageUsageElement.style.display = 'none';
                }
            }
        } else {
            // 失败的回复
            targetElement.classList.add('error');
            if (messageTextElement) {
                messageTextElement.innerHTML = this.formatMessageContent(`请求失败: ${currentResult.error}`, 'assistant');
            }
            
            // 隐藏Token使用信息
            if (messageUsageElement) {
                messageUsageElement.style.display = 'none';
            }
        }
    }

    // 显示自定义确认弹窗
    showCustomConfirm(options) {
        const {
            title,
            message,
            details,
            confirmText = '确定',
            cancelText = '取消',
            type = 'primary',
            showInput = false,
            inputType = 'text',
            inputValue = '',
            inputPlaceholder = '',
            inputMin,
            inputMax,
            onConfirm,
            onCancel
        } = options;

        // 创建弹窗遮罩
        const overlay = document.createElement('div');
        overlay.className = 'custom-modal-overlay';
        
        // 创建弹窗内容
        const modal = document.createElement('div');
        modal.className = `custom-modal ${type}`;
        
        // 构建输入框HTML
        let inputHtml = '';
        if (showInput) {
            const minAttr = inputMin !== undefined ? ` min="${inputMin}"` : '';
            const maxAttr = inputMax !== undefined ? ` max="${inputMax}"` : '';
            inputHtml = `
                <div class="modal-input-container">
                    <input type="${inputType}" 
                           class="modal-input" 
                           value="${inputValue}" 
                           placeholder="${inputPlaceholder}"
                           ${minAttr}${maxAttr}
                           autocomplete="off">
                </div>
            `;
        }
        
        modal.innerHTML = `
            <div class="modal-header">
                <h3 class="modal-title">${title}</h3>
                <button class="modal-close" type="button">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 8.707l3.646 3.647a.5.5 0 0 0 .708-.708L8.707 8l3.647-3.646a.5.5 0 0 0-.708-.708L8 7.293 4.354 3.646a.5.5 0 1 0-.708.708L7.293 8l-3.647 3.646a.5.5 0 0 0 .708.708L8 8.707z"/>
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <p class="modal-message">${message}</p>
                ${details ? `<div class="modal-details">${details.replace(/\n/g, '<br>')}</div>` : ''}
                ${inputHtml}
            </div>
            <div class="modal-footer">
                <button class="btn-secondary modal-cancel">${cancelText}</button>
                <button class="btn-${type} modal-confirm">${confirmText}</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // 获取输入框引用
        const inputElement = modal.querySelector('.modal-input');
        
        // 添加动画类
        setTimeout(() => {
            overlay.classList.add('show');
            // 如果有输入框，自动聚焦并选中内容
            if (inputElement) {
                inputElement.focus();
                inputElement.select();
            }
        }, 10);

        // 绑定事件
        const closeModal = () => {
            overlay.classList.remove('show');
            setTimeout(() => {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
            }, 300);
        };

        // 获取输入值的函数
        const getInputValue = () => {
            return inputElement ? inputElement.value.trim() : null;
        };

        // 确认操作
        const confirmAction = () => {
            const inputValue = getInputValue();
            
            // 如果有输入框，验证输入
            if (showInput) {
                if (!inputValue) {
                    // 输入为空时聚焦输入框
                    if (inputElement) {
                        inputElement.focus();
                        inputElement.style.borderColor = 'var(--error-color)';
                        setTimeout(() => {
                            inputElement.style.borderColor = '';
                        }, 1500);
                    }
                    return;
                }
                
                // 如果是数字类型，验证数值范围
                if (inputType === 'number') {
                    const num = parseInt(inputValue);
                    if (isNaN(num)) {
                        if (inputElement) {
                            inputElement.focus();
                            inputElement.style.borderColor = 'var(--error-color)';
                            setTimeout(() => {
                                inputElement.style.borderColor = '';
                            }, 1500);
                        }
                        return;
                    }
                    
                    if ((inputMin !== undefined && num < inputMin) || 
                        (inputMax !== undefined && num > inputMax)) {
                        if (inputElement) {
                            inputElement.focus();
                            inputElement.style.borderColor = 'var(--error-color)';
                            setTimeout(() => {
                                inputElement.style.borderColor = '';
                            }, 1500);
                        }
                        return;
                    }
                }
            }
            
            closeModal();
            if (onConfirm) {
                onConfirm(showInput ? inputValue : undefined);
            }
        };

        // 关闭按钮
        modal.querySelector('.modal-close').addEventListener('click', () => {
            closeModal();
            if (onCancel) onCancel();
        });

        // 取消按钮
        modal.querySelector('.modal-cancel').addEventListener('click', () => {
            closeModal();
            if (onCancel) onCancel();
        });

        // 确定按钮
        modal.querySelector('.modal-confirm').addEventListener('click', confirmAction);

        // 输入框回车键确认
        if (inputElement) {
            inputElement.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    confirmAction();
                }
            });
        }

        // 点击遮罩关闭
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal();
                if (onCancel) onCancel();
            }
        });

        // ESC键关闭
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                if (onCancel) onCancel();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    }

    // 字体缩放相关方法
    setupFontScaling() {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) {
            console.error('未找到chat-messages容器');
            return;
        }
        console.log('字体缩放功能已初始化');

        messagesContainer.addEventListener('wheel', (e) => {
            // 检查是否按住Ctrl键
            if (e.ctrlKey) {
                console.log('检测到Ctrl+滚轮事件');
                e.preventDefault(); // 阻止默认的页面缩放
                
                // 计算缩放方向
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                console.log('滚轮方向:', e.deltaY > 0 ? '向下(缩小)' : '向上(放大)', 'delta:', delta);
                
                // 计算新的缩放比例
                const newScale = Math.max(
                    this.minFontScale, 
                    Math.min(this.maxFontScale, this.fontScale + delta)
                );
                console.log('当前缩放:', this.fontScale, '新缩放:', newScale);

                if (newScale !== this.fontScale) {
                    this.setFontScale(newScale);
                } else {
                    console.log('缩放达到限制');
                }
            }
        }, { passive: false });

        // 双击消息区域重置字体大小
        messagesContainer.addEventListener('dblclick', (e) => {
            // 只在按住Ctrl键时才重置
            if (e.ctrlKey) {
                e.preventDefault();
                this.resetFontScale();
            }
        });
    }

    // 设置字体缩放比例
    setFontScale(scale) {
        console.log('设置字体缩放比例:', scale);
        this.fontScale = scale;
        
        // 应用到CSS变量
        document.documentElement.style.setProperty('--chat-font-scale', scale);
        console.log('CSS变量已更新:', document.documentElement.style.getPropertyValue('--chat-font-scale'));
        
        // 保存到localStorage
        this.saveFontScale();
        
        // 显示提示
        const percentage = Math.round(scale * 100);
        console.log('显示通知:', `字体大小：${percentage}%`);
        
        // 尝试使用通知系统
        try {
            if (window.sikongAI && typeof window.sikongAI.showNotification === 'function') {
                window.sikongAI.showNotification(`字体大小：${percentage}%`, 'info', 1000);
            } else {
                // 降级方案：创建临时提示
                this.showTempNotification(`字体大小：${percentage}%`);
            }
        } catch (error) {
            console.warn('通知显示失败:', error);
            this.showTempNotification(`字体大小：${percentage}%`);
        }
    }

    // 加载保存的字体缩放比例
    loadFontScale() {
        try {
            const savedScale = localStorage.getItem('chatFontScale');
            console.log('从localStorage加载字体缩放:', savedScale);
            if (savedScale) {
                const scale = parseFloat(savedScale);
                console.log('解析的缩放比例:', scale);
                if (scale >= this.minFontScale && scale <= this.maxFontScale) {
                    this.fontScale = scale;
                    document.documentElement.style.setProperty('--chat-font-scale', scale);
                    console.log('字体缩放已应用:', scale);
                } else {
                    console.log('缩放比例超出范围，使用默认值');
                }
            } else {
                console.log('未找到保存的字体缩放比例，使用默认值');
            }
        } catch (error) {
            console.error('加载字体缩放比例失败:', error);
        }
    }

    // 保存字体缩放比例
    saveFontScale() {
        try {
            localStorage.setItem('chatFontScale', this.fontScale.toString());
        } catch (error) {
            console.error('保存字体缩放比例失败:', error);
        }
    }

    // 临时通知方法（降级方案）
    showTempNotification(message) {
        // 创建临时通知元素
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--accent-color);
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            font-size: 14px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        
        document.body.appendChild(notification);
        
        // 1秒后移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 1000);
    }

    // 设置快捷设置功能
    setupQuickSettings() {
        const quickConcurrentInput = document.getElementById('quick-concurrent-count');
        const quickProviderSelect = document.getElementById('quick-provider');
        const quickApiKeySelect = document.getElementById('quick-api-key');
        const quickModelSelect = document.getElementById('quick-model');
        const quickSystemPromptSelect = document.getElementById('quick-system-prompt');
        const quickMaxTokensInput = document.getElementById('quick-max-tokens');
        const quickTemperatureSlider = document.getElementById('quick-temperature');
        const temperatureValue = document.querySelector('.temperature-value');

        if (!quickConcurrentInput) return;

        // 注意：下拉菜单选项的初始化现在在DOMContentLoaded后单独处理，确保设置管理器已就绪

        // 加载保存的快捷设置（此时下拉菜单可能还没有选项，但并发数量可以恢复）
        console.log('首次加载快捷设置（在setupQuickSettings中）');
        this.loadQuickSettings();

        // 并发数量输入验证和保存
        quickConcurrentInput.addEventListener('input', (e) => {
            const value = e.target.value;
            if (value !== '') {
                const num = parseInt(value);
                if (isNaN(num) || num < 1) {
                    e.target.style.borderColor = 'var(--error-color)';
                    return;
                }
            }
            e.target.style.borderColor = '';
            this.saveQuickSettings();
        });

        // 失去焦点时验证
        quickConcurrentInput.addEventListener('blur', (e) => {
            const value = e.target.value.trim();
            if (value !== '') {
                const num = parseInt(value);
                if (isNaN(num) || num < 1) {
                    e.target.value = '';
                    e.target.style.borderColor = '';
                }
            }
        });

        // 下拉菜单变化事件
        [quickProviderSelect, quickApiKeySelect, quickModelSelect, quickSystemPromptSelect].forEach(select => {
            if (select) {
                select.addEventListener('change', () => {
                    this.saveQuickSettings();
                });
            }
        });

        // 最大回复长度输入框事件
        if (quickMaxTokensInput) {
            // 输入验证和保存
            quickMaxTokensInput.addEventListener('input', (e) => {
                const value = e.target.value;
                if (value !== '') {
                    const num = parseInt(value);
                    if (isNaN(num) || num < 100 || num > 50000) {
                        e.target.style.borderColor = 'var(--error-color)';
                        return;
                    }
                }
                e.target.style.borderColor = '';
                this.saveQuickSettings();
            });

            // 失去焦点时验证
            quickMaxTokensInput.addEventListener('blur', (e) => {
                const value = e.target.value.trim();
                if (value !== '') {
                    const num = parseInt(value);
                    if (isNaN(num) || num < 100 || num > 50000) {
                        e.target.value = '15240'; // 恢复默认值
                        e.target.style.borderColor = '';
                        this.saveQuickSettings();
                    }
                } else {
                    // 如果为空，设置默认值
                    e.target.value = '15240';
                    this.saveQuickSettings();
                }
            });
        }



        // 温度滑块事件
        if (quickTemperatureSlider && temperatureValue) {
            // 实时更新温度显示值
            quickTemperatureSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                temperatureValue.textContent = value.toFixed(1);
            });
            
            // 保存温度设置
            quickTemperatureSlider.addEventListener('change', () => {
                this.saveQuickSettings();
            });
        }

        // 气泡宽度滑块事件
        const bubbleWidthSlider = document.getElementById('bubble-width');
        const bubbleWidthValue = document.querySelector('.bubble-width-value');
        
        if (bubbleWidthSlider && bubbleWidthValue) {
            // 实时更新气泡宽度显示值
            bubbleWidthSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                bubbleWidthValue.textContent = value + '%';
                // 实时应用宽度变化
                this.applyBubbleWidth(value);
            });
            
            // 保存气泡宽度设置
            bubbleWidthSlider.addEventListener('change', () => {
                this.saveQuickSettings();
            });
            
            // 加载初始气泡宽度设置
            this.loadBubbleWidth();
        }

        // 为快捷空间下拉菜单添加右键编辑功能
        if (quickProviderSelect) {
            quickProviderSelect.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.openParameterEditModal('vendor');
            });
        }

        if (quickApiKeySelect) {
            quickApiKeySelect.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.openParameterEditModal('key');
            });
        }

        if (quickModelSelect) {
            quickModelSelect.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.openParameterEditModal('model');
            });
        }

        // 为系统提示词下拉菜单添加右键菜单功能
        if (quickSystemPromptSelect) {
            quickSystemPromptSelect.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.openSystemPromptManageModal();
            });
        }

        // 快捷键支持（Ctrl+数字键快速设置）
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
                const chatInput = document.getElementById('chat-input');
                if (document.activeElement === chatInput) {
                    e.preventDefault();
                    quickConcurrentInput.value = e.key;
                    this.saveQuickSettings();
                    this.showTempNotification(`并发数量设置为: ${e.key}`);
                }
            }
        });
    }

    // 初始化快捷设置下拉菜单选项
    initializeQuickSettingsOptions() {
        console.log('开始初始化快捷设置下拉菜单选项');
        
        // 检查设置管理器是否可用
        if (!window.settingsManager) {
            console.error('设置管理器不可用，无法初始化快捷设置');
            return;
        }
        
        // 从全局设置中获取配置项
        const settings = window.settingsManager.getSettings();
        console.log('获取到的设置:', {
            providerUrls: settings.providerUrls,
            apiKeys: settings.apiKeys,
            modelNames: settings.modelNames
        });
        
        // 初始化供应商选项
        const quickProvider = document.getElementById('quick-provider');
        if (quickProvider && settings.providerUrls) {
            console.log('更新供应商下拉菜单，供应商数量:', settings.providerUrls.length);
            quickProvider.innerHTML = '<option value="">默认</option>';
            settings.providerUrls.forEach((url, index) => {
                if (url.trim()) {
                    const parsed = this.parseProviderUrl(url);
                    console.log(`供应商 ${index + 1}:`, { 原始: url, 解析: parsed });
                    const option = document.createElement('option');
                    option.value = parsed.url;  // 使用解析出的URL作为值
                    option.textContent = parsed.displayName;  // 使用备注或URL作为显示文本
                    quickProvider.appendChild(option);
                }
            });
        } else {
            console.log('供应商下拉菜单未找到或无供应商数据');
        }

        // 初始化API密钥选项
        const quickApiKey = document.getElementById('quick-api-key');
        if (quickApiKey && settings.apiKeys) {
            console.log('更新API密钥下拉菜单，密钥数量:', settings.apiKeys.length);
            quickApiKey.innerHTML = '<option value="">默认</option>';
            settings.apiKeys.forEach((key, index) => {
                if (key.trim()) {
                    const parsed = this.parseApiKey(key);
                    console.log(`API密钥 ${index + 1}:`, { 原始: key, 解析: parsed });
                    const option = document.createElement('option');
                    option.value = parsed.key;  // 使用解析出的密钥作为值
                    option.textContent = parsed.displayName;  // 使用备注或密钥显示文本
                    quickApiKey.appendChild(option);
                }
            });
        } else {
            console.log('API密钥下拉菜单未找到或无密钥数据');
        }

        // 初始化模型选项
        const quickModel = document.getElementById('quick-model');
        if (quickModel && settings.modelNames) {
            console.log('更新模型下拉菜单，模型数量:', settings.modelNames.length);
            quickModel.innerHTML = '<option value="">默认</option>';
            settings.modelNames.forEach((model, index) => {
                if (model.trim()) {
                    console.log(`模型 ${index + 1}:`, model);
                    const option = document.createElement('option');
                    option.value = model;
                    option.textContent = model;
                    quickModel.appendChild(option);
                }
            });
        } else {
            console.log('模型下拉菜单未找到或无模型数据');
        }

        // 初始化系统提示词选项
        const quickSystemPrompt = document.getElementById('quick-system-prompt');
        if (quickSystemPrompt) {
            console.log('更新系统提示词下拉菜单');
            quickSystemPrompt.innerHTML = '<option value="">默认</option>';
            
            // 获取隐藏的预设提示词列表
            const hiddenPresetPrompts = settings.hiddenPresetPrompts || [];
            
            // 过滤掉被隐藏的预设提示词
            const visiblePresetPrompts = {};
            Object.keys(this.systemPrompts).forEach(key => {
                if (!hiddenPresetPrompts.includes(key)) {
                    visiblePresetPrompts[key] = this.systemPrompts[key];
                }
            });
            
            // 合并可见的预设提示词和自定义提示词
            const customPrompts = settings.systemPrompts || {};
            const allPrompts = { ...visiblePresetPrompts, ...customPrompts };
            
            // 添加所有系统提示词选项
            Object.keys(allPrompts).forEach(key => {
                const option = document.createElement('option');
                option.value = key;
                // 为预设提示词添加特殊标识
                const isPreset = this.systemPrompts.hasOwnProperty(key);
                option.textContent = isPreset ? this.getPresetPromptDisplayName(key) : key;
                quickSystemPrompt.appendChild(option);
            });
            
            console.log('系统提示词下拉菜单更新完成，选项数量:', Object.keys(allPrompts).length);
            console.log('隐藏的预设提示词:', hiddenPresetPrompts);
        } else {
            console.log('系统提示词下拉菜单未找到');
        }
        
        console.log('快捷设置下拉菜单选项初始化完成');
        
        // 恢复用户之前的选择状态
        this.loadQuickSettings();
        console.log('已恢复用户之前的选择状态');
    }

    // 解析供应商URL（分离备注和URL）
    parseProviderUrl(urlString) {
        const trimmed = urlString.trim();
        
        // 匹配 URL 模式
        const urlMatch = trimmed.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) {
            const url = urlMatch[1];
            const note = trimmed.replace(url, '').trim();
            const displayName = note || this.getProviderDisplayName(url);
            return { url, displayName };
        }
        
        // 如果没有匹配到URL模式，将整个字符串当作URL
        return { 
            url: trimmed, 
            displayName: this.getProviderDisplayName(trimmed) 
        };
    }
    
    // 解析API密钥（分离备注和密钥）
    parseApiKey(keyString) {
        const trimmed = keyString.trim();
        
        // 匹配以 sk- 开头的密钥模式
        const keyMatch = trimmed.match(/(sk-[^\s]+)/);
        if (keyMatch) {
            const key = keyMatch[1];
            const note = trimmed.replace(key, '').trim();
            const displayName = note || `${key.substring(0, 10)}...`;
            return { key, displayName };
        }
        
        // 如果没有匹配到标准密钥模式，将整个字符串当作密钥
        return { 
            key: trimmed, 
            displayName: `${trimmed.substring(0, 10)}...` 
        };
    }

    // 获取供应商显示名称
    getProviderDisplayName(url) {
        if (url.includes('yunwu.ai')) return 'YunWu.AI';
        if (url.includes('api.openai.com')) return 'OpenAI官方';
        if (url.includes('api.anthropic.com')) return 'Anthropic';
        if (url.includes('api.deepseek.com')) return 'DeepSeek';
        try {
            return new URL(url).hostname;
        } catch {
            return url;
        }
    }



    // 加载快捷设置
    loadQuickSettings() {
        try {
            const savedSettings = localStorage.getItem('quickSettings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                console.log('加载保存的快捷设置:', settings);
                
                // 恢复并发数量
                const quickConcurrent = document.getElementById('quick-concurrent-count');
                if (quickConcurrent && settings.concurrentCount) {
                    quickConcurrent.value = settings.concurrentCount;
                    console.log('恢复并发数量:', settings.concurrentCount);
                }
                
                // 恢复供应商选择
                const quickProvider = document.getElementById('quick-provider');
                if (quickProvider && settings.provider) {
                    // 尝试直接匹配value
                    let optionFound = false;
                    for (let option of quickProvider.options) {
                        if (option.value === settings.provider) {
                            quickProvider.value = settings.provider;
                            optionFound = true;
                            console.log('恢复供应商选择:', settings.provider);
                            break;
                        }
                    }
                    if (!optionFound) {
                        console.log('未找到匹配的供应商选项:', settings.provider);
                    }
                }
                
                // 恢复API密钥选择
                const quickApiKey = document.getElementById('quick-api-key');
                if (quickApiKey && settings.apiKey) {
                    let optionFound = false;
                    for (let option of quickApiKey.options) {
                        if (option.value === settings.apiKey) {
                            quickApiKey.value = settings.apiKey;
                            optionFound = true;
                            console.log('恢复API密钥选择:', settings.apiKey);
                            break;
                        }
                    }
                    if (!optionFound) {
                        console.log('未找到匹配的API密钥选项:', settings.apiKey);
                    }
                }
                
                // 恢复模型选择
                const quickModel = document.getElementById('quick-model');
                if (quickModel && settings.model) {
                    let optionFound = false;
                    for (let option of quickModel.options) {
                        if (option.value === settings.model) {
                            quickModel.value = settings.model;
                            optionFound = true;
                            console.log('恢复模型选择:', settings.model);
                            break;
                        }
                    }
                    if (!optionFound) {
                        console.log('未找到匹配的模型选项:', settings.model);
                    }
                }

                // 恢复系统提示词选择
                const quickSystemPrompt = document.getElementById('quick-system-prompt');
                if (quickSystemPrompt && settings.systemPrompt) {
                    quickSystemPrompt.value = settings.systemPrompt;
                    console.log('恢复系统提示词选择:', settings.systemPrompt);
                }

                // 恢复最大回复长度设置
                const quickMaxTokens = document.getElementById('quick-max-tokens');
                if (quickMaxTokens && settings.maxTokens) {
                    quickMaxTokens.value = settings.maxTokens;
                    console.log('恢复最大回复长度设置:', settings.maxTokens);
                }

                // 恢复温度设置
                const quickTemperature = document.getElementById('quick-temperature');
                const temperatureValue = document.querySelector('.temperature-value');
                if (quickTemperature && settings.temperature) {
                    const temp = parseFloat(settings.temperature);
                    quickTemperature.value = temp;
                    if (temperatureValue) {
                        temperatureValue.textContent = temp.toFixed(1);
                    }
                    console.log('恢复温度设置:', temp);
                }

                // 恢复气泡宽度设置
                const bubbleWidthSlider = document.getElementById('bubble-width');
                const bubbleWidthValue = document.querySelector('.bubble-width-value');
                if (bubbleWidthSlider && settings.bubbleWidth) {
                    const width = parseInt(settings.bubbleWidth);
                    // 验证宽度范围 (60%-600%)
                    const validWidth = Math.max(60, Math.min(600, width));
                    bubbleWidthSlider.value = validWidth;
                    if (bubbleWidthValue) {
                        bubbleWidthValue.textContent = validWidth + '%';
                    }
                    // 应用宽度设置
                    this.applyBubbleWidth(validWidth);
                    console.log('恢复气泡宽度设置:', validWidth + '%');
                }
            } else {
                console.log('没有保存的快捷设置');
            }
        } catch (error) {
            console.error('加载快捷设置失败:', error);
        }
    }

    // 保存快捷设置
    saveQuickSettings() {
        try {
            const settings = {
                concurrentCount: document.getElementById('quick-concurrent-count')?.value || '',
                provider: document.getElementById('quick-provider')?.value || '',
                apiKey: document.getElementById('quick-api-key')?.value || '',
                model: document.getElementById('quick-model')?.value || '',
                systemPrompt: document.getElementById('quick-system-prompt')?.value || '',
                maxTokens: document.getElementById('quick-max-tokens')?.value || '15240',
                temperature: document.getElementById('quick-temperature')?.value || '0.7',
                bubbleWidth: document.getElementById('bubble-width')?.value || '85'
            };
            
            console.log('保存快捷设置:', settings);
            localStorage.setItem('quickSettings', JSON.stringify(settings));
            console.log('快捷设置已保存到本地存储');
        } catch (error) {
            console.error('保存快捷设置失败:', error);
        }
    }

    // 获取快捷设置
    getQuickSettings() {
        try {
            const savedSettings = localStorage.getItem('quickSettings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                // 确保返回的设置包含所有字段
                return {
                    concurrentCount: settings.concurrentCount || '',
                    provider: settings.provider || '',
                    apiKey: settings.apiKey || '',
                    model: settings.model || '',
                    systemPrompt: settings.systemPrompt || '',
                    streaming: settings.streaming !== undefined ? settings.streaming : true,
                    temperature: settings.temperature || '0.7',
                    bubbleWidth: settings.bubbleWidth || '85',
                    maxTokens: settings.maxTokens || '15240'
                };
            }
        } catch (error) {
            console.error('获取快捷设置失败:', error);
        }
        return {
            concurrentCount: '',
            provider: '',
            apiKey: '',
            model: '',
            systemPrompt: '',
            temperature: '0.7',
            bubbleWidth: '85',
            maxTokens: '15240'
        };
    }

    // 获取预设提示词的显示名称
    getPresetPromptDisplayName(key) {
        const displayNames = {
            'assistant': '通用助手',
            'translator': '翻译助手',
            'coder': '编程助手',
            'writer': '写作助手'
        };
        return displayNames[key] || key;
    }

    // 获取当前系统提示词内容
    getCurrentSystemPrompt() {
        const quickSettings = this.getQuickSettings();
        const promptKey = quickSettings.systemPrompt;
        
        // 如果选择了"默认"（空字符串），则不使用系统提示词
        if (!promptKey || promptKey === '') {
            console.log('选择了默认选项，不使用系统提示词');
            return '';
        }
        
        // 首先检查预设提示词
        if (this.systemPrompts[promptKey]) {
            console.log('使用快捷设置中的预设系统提示词:', promptKey);
            return this.systemPrompts[promptKey];
        }
        
        // 检查自定义提示词
        if (window.settingsManager) {
            const settings = window.settingsManager.getSettings();
            const customPrompts = settings.systemPrompts || {};
            if (customPrompts[promptKey]) {
                console.log('使用快捷设置中的自定义系统提示词:', promptKey);
                return customPrompts[promptKey];
            }
        }
        
        // 如果找不到对应的提示词，也不使用系统提示词
        console.log('未找到对应的系统提示词，不使用系统提示词');
        return '';
    }

    // 应用预设设置到快捷设置
    applyPresetSettings(presetSettings) {
        console.log('应用预设设置:', presetSettings);
        
        try {
            // 获取当前快捷设置
            const currentQuickSettings = this.getQuickSettings();
            
            // 构建新的快捷设置对象，合并预设参数
            const newQuickSettings = {
                ...currentQuickSettings,
                provider: presetSettings.provider || currentQuickSettings.provider,
                apiKey: presetSettings.apiKey || currentQuickSettings.apiKey,
                model: presetSettings.model || currentQuickSettings.model,
                systemPrompt: presetSettings.systemPrompt || currentQuickSettings.systemPrompt,
                temperature: presetSettings.temperature?.toString() || currentQuickSettings.temperature
            };
            
            // 保存新的快捷设置
            localStorage.setItem('quickSettings', JSON.stringify(newQuickSettings));
            
            // 更新UI界面
            this.updateQuickSettingsUI(newQuickSettings);
            
            console.log('预设设置已应用到快捷设置:', newQuickSettings);
            
        } catch (error) {
            console.error('应用预设设置失败:', error);
            throw error;
        }
    }

    // 更新快捷设置UI界面
    updateQuickSettingsUI(settings) {
        try {
            // 更新并发数量
            const quickConcurrent = document.getElementById('quick-concurrent-count');
            if (quickConcurrent && settings.concurrentCount) {
                quickConcurrent.value = settings.concurrentCount;
            }
            
            // 更新供应商选择
            const quickProvider = document.getElementById('quick-provider');
            if (quickProvider && settings.provider) {
                // 检查选项是否存在，不存在则添加
                let optionExists = false;
                for (let option of quickProvider.options) {
                    if (option.value === settings.provider) {
                        optionExists = true;
                        break;
                    }
                }
                
                if (!optionExists) {
                    const newOption = document.createElement('option');
                    newOption.value = settings.provider;
                    newOption.textContent = this.getProviderDisplayName(settings.provider);
                    quickProvider.appendChild(newOption);
                }
                
                quickProvider.value = settings.provider;
                console.log('更新供应商UI:', settings.provider);
            }
            
            // 更新API密钥
            const quickApiKey = document.getElementById('quick-api-key');
            if (quickApiKey && settings.apiKey) {
                quickApiKey.value = settings.apiKey;
                console.log('更新API密钥UI');
            }
            
            // 更新模型选择
            const quickModel = document.getElementById('quick-model');
            if (quickModel && settings.model) {
                // 检查选项是否存在，不存在则添加
                let optionExists = false;
                for (let option of quickModel.options) {
                    if (option.value === settings.model) {
                        optionExists = true;
                        break;
                    }
                }
                
                if (!optionExists) {
                    const newOption = document.createElement('option');
                    newOption.value = settings.model;
                    newOption.textContent = settings.model;
                    quickModel.appendChild(newOption);
                }
                
                quickModel.value = settings.model;
                console.log('更新模型UI:', settings.model);
            }
            
            // 更新系统提示词
            const quickSystemPrompt = document.getElementById('quick-system-prompt');
            if (quickSystemPrompt && settings.systemPrompt) {
                // 对于系统提示词，需要特殊处理
                // 如果是预设提示词的key，直接设置
                if (this.systemPrompts[settings.systemPrompt]) {
                    quickSystemPrompt.value = settings.systemPrompt;
                } else {
                    // 如果是自定义提示词内容，需要查找对应的key或创建新选项
                    let optionExists = false;
                    for (let option of quickSystemPrompt.options) {
                        if (option.value === settings.systemPrompt) {
                            optionExists = true;
                            break;
                        }
                    }
                    
                    if (!optionExists) {
                        // 创建一个临时选项用于显示预设的系统提示词
                        const newOption = document.createElement('option');
                        newOption.value = settings.systemPrompt;
                        newOption.textContent = '预设提示词';
                        quickSystemPrompt.appendChild(newOption);
                    }
                    
                    quickSystemPrompt.value = settings.systemPrompt;
                }
                console.log('更新系统提示词UI');
            }
            
            // 更新温度参数
            const quickTemperature = document.getElementById('quick-temperature');
            const quickTemperatureValue = document.getElementById('quick-temperature-value');
            if (quickTemperature && settings.temperature) {
                quickTemperature.value = settings.temperature;
                if (quickTemperatureValue) {
                    quickTemperatureValue.textContent = settings.temperature;
                }
                console.log('更新温度参数UI:', settings.temperature);
            }
            
            console.log('快捷设置UI更新完成');
            
        } catch (error) {
            console.error('更新快捷设置UI失败:', error);
        }
    }

    // 获取供应商显示名称
    getProviderDisplayName(url) {
        const urlMap = {
            'https://api.openai.com': 'OpenAI',
            'https://yunwu.ai': '云雾AI',
            'https://api.anthropic.com': 'Anthropic',
            'https://api.deepseek.com': 'DeepSeek'
        };
        try {
            return urlMap[url] || new URL(url).hostname;
        } catch {
            return url;
        }
    }

    // 处理流式更新
    handleStreamUpdate(content, requestIndex = 0) {
        if (!this.currentConversationId) return;
        
        const conversation = this.getCurrentConversation();
        if (!conversation) return;

        // 查找当前正在进行的AI消息（最后一条assistant消息）
        let aiMessage = null;
        for (let i = conversation.messages.length - 1; i >= 0; i--) {
            if (conversation.messages[i].type === 'assistant') {
                aiMessage = conversation.messages[i];
                break;
            }
        }

        // 如果没有找到AI消息，创建一个新的
        if (!aiMessage) {
            aiMessage = {
                id: window.sikongAI.generateId(),
                type: 'assistant',
                content: '',
                timestamp: new Date(),
                isStreaming: true
            };
            conversation.messages.push(aiMessage);
        }

        // 更新消息内容
        aiMessage.content = content;
        aiMessage.isStreaming = true;

        // 实时更新界面
        this.updateStreamingMessage(aiMessage);
    }

    // 更新流式消息显示
    updateStreamingMessage(aiMessage) {
        const messagesContainer = document.getElementById('messages-container');
        if (!messagesContainer) return;

        // 查找对应的消息元素
        let messageElement = messagesContainer.querySelector(`[data-message-id="${aiMessage.id}"]`);
        
        if (!messageElement) {
            // 如果消息元素不存在，重新渲染所有消息
            this.renderMessages();
            messageElement = messagesContainer.querySelector(`[data-message-id="${aiMessage.id}"]`);
        }

        if (messageElement) {
            // 更新消息内容
            const contentElement = messageElement.querySelector('.message-text');
            if (contentElement) {
                contentElement.innerHTML = this.formatMessage(aiMessage.content);
                
                // 添加流式指示器
                if (!messageElement.querySelector('.streaming-indicator')) {
                    const indicator = document.createElement('span');
                    indicator.className = 'streaming-indicator';
                    indicator.textContent = '▋';
                    indicator.style.cssText = `
                        animation: blink 1s infinite;
                        margin-left: 2px;
                        color: var(--accent-color);
                    `;
                    contentElement.appendChild(indicator);
                }
            }

            // 自动滚动到底部
            this.scrollToBottomIfEnabled(messagesContainer);
        }
    }

    // 设置图片处理功能
    setupImageHandling() {
        const chatInput = document.getElementById('chat-input');
        const clearAllBtn = document.getElementById('clear-all-images');

        if (!chatInput) return;

        // 监听粘贴事件
        chatInput.addEventListener('paste', (e) => {
            this.handlePasteEvent(e);
        });

        // 监听拖拽事件
        chatInput.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            chatInput.classList.add('drag-over');
        });

        chatInput.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            chatInput.classList.remove('drag-over');
        });

        chatInput.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            chatInput.classList.remove('drag-over');
            this.handleDropEvent(e);
        });

        // 清除所有图片按钮
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                this.clearAllImages();
            });
        }
    }

    // 处理粘贴事件
    handlePasteEvent(e) {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.indexOf('image') !== -1) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    this.addImage(file);
                }
            }
        }
    }

    // 处理拖拽事件
    handleDropEvent(e) {
        const files = e.dataTransfer?.files;
        if (!files) return;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type.indexOf('image') !== -1) {
                this.addImage(file);
            }
        }
    }

    // 添加图片
    addImage(file) {
        if (this.attachedImages.length >= 5) {
            this.showTempNotification('最多只能附加5张图片');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            // 获取base64字符串，移除开头的 "data:image/jpeg;base64," 等前缀
            const base64String = e.target.result.split(',')[1];
            
            const imageData = {
                id: Date.now() + Math.random(),
                file: file,
                dataUrl: e.target.result, // 保留完整URL用于预览
                base64: base64String, // 纯base64字符串用于API
                name: file.name,
                size: file.size
            };

            this.attachedImages.push(imageData);
            this.updateImagePreview();
            this.showTempNotification(`已添加图片: ${file.name}`);
        };

        reader.readAsDataURL(file);
    }

    // 更新图片预览
    updateImagePreview() {
        const previewArea = document.getElementById('image-preview-area');
        const thumbnailsContainer = document.getElementById('image-thumbnails');

        if (!previewArea || !thumbnailsContainer) return;

        if (this.attachedImages.length === 0) {
            previewArea.style.display = 'none';
            return;
        }

        previewArea.style.display = 'block';
        thumbnailsContainer.innerHTML = '';

        this.attachedImages.forEach((image, index) => {
            const thumbnail = document.createElement('div');
            thumbnail.className = 'image-thumbnail';
            thumbnail.innerHTML = `
                <img src="${image.dataUrl}" alt="${image.name}" title="${image.name}">
                <div class="thumbnail-overlay">
                    <button class="remove-image-btn" data-image-id="${image.id}" title="删除图片">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                            <path d="M6 4.586l2.293-2.293a1 1 0 011.414 1.414L7.414 6l2.293 2.293a1 1 0 01-1.414 1.414L6 7.414l-2.293 2.293a1 1 0 01-1.414-1.414L4.586 6 2.293 3.707a1 1 0 011.414-1.414L6 4.586z"/>
                        </svg>
                    </button>
                </div>
                <div class="thumbnail-info">
                    <span class="image-name">${this.truncateFileName(image.name, 15)}</span>
                    <span class="image-size">${this.formatFileSize(image.size)}</span>
                </div>
            `;

            thumbnailsContainer.appendChild(thumbnail);

            // 添加删除按钮事件监听器
            const removeBtn = thumbnail.querySelector('.remove-image-btn');
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeImage(image.id);
            });

            // 添加图片点击查看事件
            const img = thumbnail.querySelector('img');
            img.addEventListener('click', () => {
                this.viewImage(image);
            });
        });
    }

    // 删除图片
    removeImage(imageId) {
        this.attachedImages = this.attachedImages.filter(img => img.id !== imageId);
        this.updateImagePreview();
        this.showTempNotification('图片已删除');
    }

    // 清除所有图片
    clearAllImages() {
        this.attachedImages = [];
        this.updateImagePreview();
        this.showTempNotification('已清除所有图片');
    }

    // 查看图片
    viewImage(image) {
        // 创建模态框显示大图
        const modal = document.createElement('div');
        modal.className = 'image-view-modal';
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${image.name}</h3>
                    <button class="modal-close-btn">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 6l12 12M6 18L18 6"/>
                        </svg>
                    </button>
                </div>
                <div class="modal-body">
                    <img src="${image.dataUrl}" alt="${image.name}">
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 关闭模态框
        const closeModal = () => {
            document.body.removeChild(modal);
        };

        modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
        modal.querySelector('.modal-backdrop').addEventListener('click', closeModal);

        // ESC键关闭
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    }

    // 截断文件名
    truncateFileName(fileName, maxLength) {
        if (fileName.length <= maxLength) return fileName;
        const extension = fileName.split('.').pop();
        const nameWithoutExt = fileName.slice(0, fileName.lastIndexOf('.'));
        const truncatedName = nameWithoutExt.slice(0, maxLength - extension.length - 4) + '...';
        return truncatedName + '.' + extension;
    }

    // 格式化文件大小
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    // 重置字体大小
    resetFontScale() {
        this.fontScale = 1.0;
        document.documentElement.style.setProperty('--chat-font-scale', 1.0);
        this.saveFontScale();
        
        try {
            if (window.sikongAI && typeof window.sikongAI.showNotification === 'function') {
                window.sikongAI.showNotification('字体大小已重置为100%', 'success', 1500);
            } else {
                this.showTempNotification('字体大小已重置为100%');
            }
        } catch (error) {
            this.showTempNotification('字体大小已重置为100%');
        }
    }

    // 打开参数编辑弹窗
    openParameterEditModal(paramType) {
        try {
            // 检查是否有全局的ParameterEditModal类
            if (typeof window.ParameterEditModal !== 'undefined') {
                const settings = window.settingsManager ? window.settingsManager.getSettings() : {};
                let currentValue = '';
                
                // 根据参数类型获取当前值
                switch (paramType) {
                    case 'vendor':
                        currentValue = settings.currentBaseUrl || '';
                        break;
                    case 'key':
                        currentValue = settings.currentApiKey || '';
                        break;
                    case 'model':
                        currentValue = settings.currentModel || '';
                        break;
                }
                
                const modal = new window.ParameterEditModal(
                    paramType,
                    currentValue,
                    async () => {
                        // 保存后的回调
                        console.log('参数编辑保存回调被调用，参数类型:', paramType);
                        
                        // 稍等一下确保设置已经保存
                        await new Promise(resolve => setTimeout(resolve, 100));
                        
                        // 重新初始化快捷设置选项
                        this.initializeQuickSettingsOptions();
                        this.showTempNotification('设置已更新');
                        
                        console.log('快捷设置选项已重新初始化');
                    }
                );
                modal.open();
            } else {
                this.showTempNotification('编辑功能暂时不可用');
                console.error('ParameterEditModal class not found');
            }
        } catch (error) {
            console.error('打开参数编辑弹窗失败:', error);
            this.showTempNotification('打开编辑弹窗失败');
        }
    }

    // 打开系统提示词管理弹窗
    openSystemPromptManageModal() {
        console.log('打开系统提示词管理弹窗');
        
        try {
            // 检查是否有SystemPromptManageModal类
            if (window.SystemPromptManageModal) {
                const modal = new window.SystemPromptManageModal(() => {
                    // 保存后的回调
                    console.log('系统提示词管理保存回调被调用');
                    
                    // 重新初始化快捷设置选项
                    this.initializeQuickSettingsOptions();
                    this.showTempNotification('系统提示词已更新');
                });
                modal.open();
            } else {
                this.showTempNotification('系统提示词管理功能暂时不可用');
                console.error('SystemPromptManageModal class not found');
            }
        } catch (error) {
            console.error('打开系统提示词管理弹窗失败:', error);
            this.showTempNotification('打开系统提示词管理弹窗失败');
        }
    }

    // 编辑消息功能
    editMessage(messageId) {
        console.log('编辑消息:', messageId);
        
        const conversation = this.getCurrentConversation();
        if (!conversation) return;

        const message = conversation.messages.find(msg => msg.id === messageId);
        if (!message) return;

        // 创建消息编辑弹窗
        const modal = new MessageEditModal(
            message, 
            // 保存回调
            (newContent) => {
                // 更新消息内容
                message.content = newContent;
                
                // 保存对话
                this.saveConversations();
                
                // 重新渲染消息
                this.renderMessages();
                
                console.log('消息已更新:', messageId);
            },
            // 保存并发送回调
            (newContent) => {
                // 更新消息内容
                message.content = newContent;
                
                // 保存对话
                this.saveConversations();
                
                // 重新渲染消息
                this.renderMessages();
                
                console.log('消息已更新并准备重新发送:', messageId);
                
                // 如果是用户消息，重新发送请求
                if (message.type === 'user') {
                    this.resendFromMessage(conversation, message);
                }
            }
        );
        
        modal.open();
    }

    // 从指定用户消息重新发送请求
    async resendFromMessage(conversation, userMessage) {
        const messageIndex = conversation.messages.findIndex(msg => msg.id === userMessage.id);
        if (messageIndex === -1) {
            console.error('找不到指定的用户消息');
            return;
        }

        if (userMessage.type !== 'user') {
            console.error('只能从用户消息重新发送');
            return;
        }

        try {
            // 移除该用户消息之后的所有消息
            conversation.messages.splice(messageIndex + 1);
            
            // 保存并更新界面
            this.saveConversations();
            this.renderMessages();

            // 重新发送AI请求
            await this.sendAIRequest(conversation, userMessage);
            
            window.sikongAI.showNotification('正在重新发送请求...', 'info');

        } catch (error) {
            console.error('重新发送失败:', error);
            window.sikongAI.showNotification('重新发送失败: ' + error.message, 'error');
        }
    }

    // 显示历史记录右键菜单
    showHistoryContextMenu(event, conversation) {
        // 移除现有的右键菜单
        const existingMenu = document.querySelector('.history-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }

        // 创建右键菜单
        const contextMenu = document.createElement('div');
        contextMenu.className = 'history-context-menu';
        contextMenu.style.position = 'fixed';
        contextMenu.style.left = `${event.pageX}px`;
        contextMenu.style.top = `${event.pageY}px`;
        contextMenu.style.zIndex = '10000';
        
        // 重命名选项
        const renameItem = document.createElement('div');
        renameItem.className = 'context-menu-item';
        renameItem.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 8px;">
                <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm.176 4.823L9.75 4.81l-6.286 6.287a.253.253 0 0 0-.064.108l-.558 1.953 1.953-.558a.253.253 0 0 0 .108-.064Zm1.238-3.763a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354Z"/>
            </svg>
            重命名
        `;
        renameItem.addEventListener('click', () => {
            contextMenu.remove();
            this.renameConversation(conversation);
        });
        
        // 克隆选项
        const cloneItem = document.createElement('div');
        cloneItem.className = 'context-menu-item';
        cloneItem.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 8px;">
                <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25v-7.5z"/>
                <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25v-7.5zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25h-7.5z"/>
            </svg>
            克隆
        `;
        cloneItem.addEventListener('click', () => {
            contextMenu.remove();
            this.showCloneModal(conversation);
        });
        
        // 删除选项
        const deleteItem = document.createElement('div');
        deleteItem.className = 'context-menu-item context-menu-item-danger';
        deleteItem.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 8px;">
                <path fill-rule="evenodd" d="M5.75 1a.75.75 0 00-.75.75v1.5h6.5v-1.5a.75.75 0 00-.75-.75h-5zM4.25 1.75A2.25 2.25 0 016.5 0h3a2.25 2.25 0 012.25 2.25v1.5h2.5a.75.75 0 010 1.5h-.5v9a2.25 2.25 0 01-2.25 2.25h-7A2.25 2.25 0 012.25 14.25v-9h-.5a.75.75 0 010-1.5h2.5v-1.5zm1.5 3.75a.75.75 0 011.5 0v7a.75.75 0 01-1.5 0v-7zm3.5 0a.75.75 0 011.5 0v7a.75.75 0 01-1.5 0v-7z" clip-rule="evenodd"/>
            </svg>
            删除对话
        `;
        deleteItem.addEventListener('click', () => {
            contextMenu.remove();
            this.deleteConversation(conversation.id);
        });
        
        contextMenu.appendChild(renameItem);
        contextMenu.appendChild(cloneItem);
        contextMenu.appendChild(deleteItem);
        document.body.appendChild(contextMenu);
        
        // 点击其他地方关闭菜单
        const closeMenu = (e) => {
            if (!contextMenu.contains(e.target)) {
                contextMenu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 0);
    }

    // 重命名对话
    renameConversation(conversation) {
        // 创建重命名弹窗
        const modal = new ConversationRenameModal(conversation, (newTitle) => {
            // 更新对话标题
            conversation.title = newTitle;
            conversation.updatedAt = new Date();
            
            // 保存对话
            this.saveConversations();
            
            // 重新渲染历史记录列表
            this.renderConversationList();
            
            console.log('对话已重命名:', conversation.id, newTitle);
        });
        
        modal.open();
    }

    // 显示克隆模态框
    showCloneModal(conversation) {
        this.showCustomConfirm({
            title: '克隆对话',
            message: `确定要克隆对话 "${conversation.title}" 吗？`,
            details: '请输入要克隆的数量（1-10个）：',
            confirmText: '确定克隆',
            cancelText: '取消',
            type: 'primary',
            showInput: true,
            inputType: 'number',
            inputMin: 1,
            inputMax: 1000,
            inputValue: 1,
            inputPlaceholder: '输入克隆数量',
            onConfirm: (cloneCount) => {
                this.cloneConversations(conversation, cloneCount);
            }
        });
    }

    // 克隆对话
    cloneConversations(originalConversation, count) {
        try {
            const cloneCount = parseInt(count);
            
            // 验证克隆数量
            if (isNaN(cloneCount) || cloneCount < 1 || cloneCount > 10) {
                window.sikongAI.showNotification('克隆数量必须是1-10之间的数字', 'error');
                return;
            }

            const clonedConversations = [];

            // 创建指定数量的克隆
            for (let i = 0; i < cloneCount; i++) {
                const clonedConversation = {
                    id: window.sikongAI.generateId(),
                    title: originalConversation.title, // 保持标题一模一样
                    messages: this.deepCloneMessages(originalConversation.messages),
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                clonedConversations.push(clonedConversation);
            }

            // 将克隆的对话添加到对话列表的开头（最新位置）
            this.conversations.unshift(...clonedConversations);
            
            // 保存对话
            this.saveConversations();
            
            // 重新渲染历史记录列表
            this.renderConversationList();
            
            // 显示成功通知
            const message = cloneCount === 1 ? 
                `对话 "${originalConversation.title}" 已成功克隆` : 
                `对话 "${originalConversation.title}" 已成功克隆 ${cloneCount} 个`;
            window.sikongAI.showNotification(message, 'success');
            
            console.log(`对话 ${originalConversation.id} 已克隆 ${cloneCount} 个`, clonedConversations);

        } catch (error) {
            console.error('克隆对话失败:', error);
            window.sikongAI.showNotification('克隆对话失败: ' + error.message, 'error');
        }
    }

    // 深度克隆消息数组
    deepCloneMessages(messages) {
        return messages.map(message => {
            // 为每个克隆的消息生成新的ID
            const clonedMessage = {
                ...message,
                id: window.sikongAI.generateId(),
                timestamp: new Date(message.timestamp), // 保持原始时间戳
            };

            // 如果消息有图片，也需要克隆图片数组
            if (message.images && Array.isArray(message.images)) {
                clonedMessage.images = [...message.images];
            }

            // 如果有并发结果，也需要克隆
            if (message.concurrentResults && Array.isArray(message.concurrentResults)) {
                clonedMessage.concurrentResults = message.concurrentResults.map(result => ({...result}));
            }

            return clonedMessage;
        });
    }
}

// 初始化聊天管理器
document.addEventListener('DOMContentLoaded', () => {
    // 延迟一点确保设置管理器已经初始化
    setTimeout(() => {
        window.chatManager = new ChatManager();
        
        // 如果设置管理器还没准备好，等待它准备完成后再初始化快捷设置
        if (window.settingsManager) {
            console.log('设置管理器已就绪，直接初始化快捷设置');
            window.chatManager.initializeQuickSettingsOptions();
        } else {
            console.log('等待设置管理器初始化...');
            const checkSettings = setInterval(() => {
                if (window.settingsManager) {
                    console.log('设置管理器已就绪，现在初始化快捷设置');
                    window.chatManager.initializeQuickSettingsOptions();
                    clearInterval(checkSettings);
                }
            }, 50);
        }
    }, 100);
});