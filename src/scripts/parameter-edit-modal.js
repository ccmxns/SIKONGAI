// Web环境下的参数编辑弹窗类
class ParameterEditModal {
    constructor(paramType, currentValue, onSubmit) {
        this.paramType = paramType; // 'vendor', 'key', 'model'
        this.currentValue = currentValue;
        this.onSubmit = onSubmit;
        this.modal = null;
        
        // 从设置管理器获取参数列表
        const settings = window.settingsManager ? window.settingsManager.getSettings() : {};
        let paramsList;
        switch (this.paramType) {
            case 'vendor':
                paramsList = settings.providerUrls || [];
                break;
            case 'key':
                paramsList = settings.apiKeys || [];
                break;
            case 'model':
                paramsList = settings.modelNames || [];
                break;
            default:
                paramsList = [];
        }
        
        // 解析参数和备注
        this.parsedParams = this.parseParams(paramsList);
    }

    // 解析参数字符串，分离备注和实际参数
    parseParams(paramsList) {
        if (!Array.isArray(paramsList)) return [];
        
        return paramsList.map(param => {
            let note = '';
            let value = param.trim();
            
            // 对于 vendor 和 key 类型，尝试分离备注和参数值
            if (this.paramType === 'vendor' || this.paramType === 'key') {
                // 对于 vendor 类型，尝试提取 URL
                if (this.paramType === 'vendor') {
                    // 匹配 URL 模式
                    const urlMatch = value.match(/(https?:\/\/[^\s]+)/);
                    if (urlMatch) {
                        const url = urlMatch[1];
                        note = value.replace(url, '').trim();
                        value = url;
                    }
                }
                // 对于 key 类型，尝试提取以 sk- 开头的部分
                else if (this.paramType === 'key') {
                    const keyMatch = value.match(/(sk-[^\s]+)/);
                    if (keyMatch) {
                        const key = keyMatch[1];
                        note = value.replace(key, '').trim();
                        value = key;
                    }
                }
            }
            
            return { note, value };
        });
    }

    open() {
        this.createModal();
        document.body.appendChild(this.modal);
        this.addStyles();
        
        // 聚焦到第一个输入框
        setTimeout(() => {
            const firstInput = this.modal.querySelector('.parameter-edit-input');
            if (firstInput) {
                firstInput.focus();
            }
        }, 100);
    }

    createModal() {
        // 创建遮罩层
        this.modal = document.createElement('div');
        this.modal.className = 'parameter-edit-modal-backdrop';
        
        // 创建模态框容器
        const modalContainer = document.createElement('div');
        modalContainer.className = 'parameter-edit-modal';
        
        // 标题和描述
        let title, description;
        switch (this.paramType) {
            case 'vendor':
                title = '编辑供应商列表';
                description = '在左侧输入备注，右侧输入供应商URL';
                break;
            case 'key':
                title = '编辑API密钥列表';
                description = '在左侧输入备注，右侧输入API密钥';
                break;
            case 'model':
                title = '编辑模型列表';
                description = '每行输入一个模型名称';
                break;
            default:
                title = '编辑参数列表';
                description = '请在下方编辑参数';
        }

        // 创建头部
        const header = document.createElement('div');
        header.className = 'parameter-edit-modal-header';
        header.innerHTML = `
            <h2 class="parameter-edit-modal-title">${title}</h2>
            <p class="parameter-edit-modal-description">${description}</p>
        `;
        
        // 创建内容区域
        const content = document.createElement('div');
        content.className = 'parameter-edit-modal-container';
        
        // 如果是 model 类型，只显示单列
        if (this.paramType === 'model') {
            const textArea = document.createElement('textarea');
            textArea.className = 'parameter-edit-textarea';
            textArea.rows = 15;
            textArea.placeholder = '每行输入一个模型名称';
            textArea.value = this.parsedParams.map(p => p.value).join('\n');
            this.textArea = textArea;
            content.appendChild(textArea);
        } else {
            // 创建表格式布局
            const tableContainer = document.createElement('div');
            tableContainer.className = 'parameter-edit-table-container';
            
            // 表头
            const headerRow = document.createElement('div');
            headerRow.className = 'parameter-edit-table-row parameter-edit-table-header';
            headerRow.innerHTML = `
                <div class="parameter-edit-table-cell">备注</div>
                <div class="parameter-edit-table-cell">${this.paramType === 'vendor' ? 'URL' : 'API密钥'}</div>
                <div class="parameter-edit-table-cell parameter-edit-delete-cell">操作</div>
            `;
            tableContainer.appendChild(headerRow);
            
            // 添加一个空行
            this.addEmptyRow(tableContainer);
            
            // 添加已有的参数行
            this.parsedParams.forEach(param => {
                this.addParamRow(tableContainer, param.note, param.value);
            });
            
            this.rowsContainer = tableContainer;
            content.appendChild(tableContainer);
            
            // 添加"添加行"按钮
            const addRowButton = document.createElement('button');
            addRowButton.className = 'parameter-edit-add-row-button';
            addRowButton.textContent = '+ 添加行';
            addRowButton.addEventListener('click', () => {
                this.addEmptyRow(this.rowsContainer);
                this.rowsContainer.scrollTop = this.rowsContainer.scrollHeight;
            });
            content.appendChild(addRowButton);
        }
        
        // 创建按钮区域
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'parameter-edit-modal-buttons';
        
        const cancelButton = document.createElement('button');
        cancelButton.className = 'parameter-edit-button';
        cancelButton.textContent = '取消';
        cancelButton.addEventListener('click', () => this.close());
        
        const saveButton = document.createElement('button');
        saveButton.className = 'parameter-edit-button parameter-edit-save-button';
        saveButton.textContent = '保存';
        saveButton.addEventListener('click', () => this.saveChanges());
        
        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(saveButton);
        
        // 组装模态框
        modalContainer.appendChild(header);
        modalContainer.appendChild(content);
        modalContainer.appendChild(buttonContainer);
        this.modal.appendChild(modalContainer);
        
        // 点击遮罩关闭
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });
        
        // ESC键关闭
        this.handleEsc = (e) => {
            if (e.key === 'Escape') {
                this.close();
            }
        };
        document.addEventListener('keydown', this.handleEsc);
        
        // Ctrl+Enter保存
        this.handleSave = (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                this.saveChanges();
            }
        };
        document.addEventListener('keydown', this.handleSave);
    }
    
    // 添加参数行
    addParamRow(container, note, value) {
        const rowEl = document.createElement('div');
        rowEl.className = 'parameter-edit-table-row';
        
        // 备注输入框
        const noteCell = document.createElement('div');
        noteCell.className = 'parameter-edit-table-cell';
        const noteInput = document.createElement('input');
        noteInput.className = 'parameter-edit-input parameter-edit-note';
        noteInput.type = 'text';
        noteInput.value = note;
        noteInput.placeholder = '备注（可选）';
        noteCell.appendChild(noteInput);
        
        // 参数值输入框
        const valueCell = document.createElement('div');
        valueCell.className = 'parameter-edit-table-cell';
        const valueInput = document.createElement('input');
        valueInput.className = 'parameter-edit-input parameter-edit-value';
        valueInput.type = 'text';
        valueInput.value = value;
        valueInput.placeholder = this.paramType === 'vendor' ? '输入URL' : '输入API密钥';
        valueCell.appendChild(valueInput);
        
        // 删除按钮
        const deleteCell = document.createElement('div');
        deleteCell.className = 'parameter-edit-table-cell parameter-edit-delete-cell';
        const deleteButton = document.createElement('button');
        deleteButton.className = 'parameter-edit-delete-button';
        deleteButton.textContent = '×';
        deleteButton.addEventListener('click', () => {
            rowEl.remove();
        });
        deleteCell.appendChild(deleteButton);
        
        rowEl.appendChild(noteCell);
        rowEl.appendChild(valueCell);
        rowEl.appendChild(deleteCell);
        container.appendChild(rowEl);
        
        return rowEl;
    }
    
    // 添加空白参数行
    addEmptyRow(container, note = '', value = '') {
        this.addParamRow(container, note, value);
    }
    
    // 保存更改
    async saveChanges() {
        let paramsArray = [];
        
        // 如果是 model 类型，直接从文本区域获取
        if (this.paramType === 'model') {
            paramsArray = this.textArea.value.split('\n').filter(line => line.trim());
        } else {
            // 从表格中获取参数
            const rows = this.rowsContainer.querySelectorAll('.parameter-edit-table-row:not(.parameter-edit-table-header)');
            
            rows.forEach((row) => {
                const noteInput = row.querySelector('.parameter-edit-note');
                const valueInput = row.querySelector('.parameter-edit-value');
                
                if (!noteInput || !valueInput) return;
                
                const note = noteInput.value.trim();
                const value = valueInput.value.trim();
                
                // 只有当值不为空时才添加
                if (value) {
                    // 如果有备注，则组合备注和值
                    const param = note ? `${note} ${value}` : value;
                    paramsArray.push(param);
                }
            });
        }
        
        // 保存到设置管理器
        console.log('检查设置管理器状态:');
        console.log('window.settingsManager 存在:', !!window.settingsManager);
        console.log('updateSetting 方法存在:', window.settingsManager && typeof window.settingsManager.updateSetting === 'function');
        
        if (window.settingsManager && typeof window.settingsManager.updateSetting === 'function') {
            console.log('开始保存参数设置:', this.paramType, paramsArray);
            
            switch (this.paramType) {
                case 'vendor':
                    window.settingsManager.updateSetting('providerUrls', paramsArray);
                    console.log('已更新 providerUrls:', paramsArray);
                    break;
                case 'key':
                    window.settingsManager.updateSetting('apiKeys', paramsArray);
                    console.log('已更新 apiKeys:', paramsArray);
                    break;
                case 'model':
                    window.settingsManager.updateSetting('modelNames', paramsArray);
                    console.log('已更新 modelNames:', paramsArray);
                    break;
            }
            
            // 保存设置
            window.settingsManager.saveSettings();
            console.log('设置已保存到本地存储');
            
            // 验证设置是否正确保存
            const updatedSettings = window.settingsManager.getSettings();
            console.log('验证保存后的设置:', {
                providerUrls: updatedSettings.providerUrls,
                apiKeys: updatedSettings.apiKeys,
                modelNames: updatedSettings.modelNames
            });
        } else {
            console.error('设置管理器不可用或缺少updateSetting方法');
        }
        
        // 调用回调函数
        if (this.onSubmit) {
            await this.onSubmit();
        }
        
        // 强制刷新快捷设置下拉菜单
        if (window.chatManager && typeof window.chatManager.initializeQuickSettingsOptions === 'function') {
            console.log('强制刷新快捷设置下拉菜单');
            window.chatManager.initializeQuickSettingsOptions();
        }
        
        this.close();
    }
    
    close() {
        if (this.modal && this.modal.parentNode) {
            document.body.removeChild(this.modal);
        }
        
        // 移除事件监听器
        if (this.handleEsc) {
            document.removeEventListener('keydown', this.handleEsc);
        }
        if (this.handleSave) {
            document.removeEventListener('keydown', this.handleSave);
        }
    }
    
    // 添加样式
    addStyles() {
        // 避免重复添加样式
        const existingStyle = document.getElementById('parameter-edit-modal-styles');
        if (existingStyle) return;
        
        const styleEl = document.createElement('style');
        styleEl.id = 'parameter-edit-modal-styles';
        styleEl.textContent = `
            .parameter-edit-modal-backdrop {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
            }
            
            .parameter-edit-modal {
                background-color: var(--background-primary, #ffffff);
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                width: 90%;
                max-width: 1000px;
                max-height: 90%;
                overflow-y: auto;
                padding: 20px;
            }
            
            .parameter-edit-modal-header {
                margin-bottom: 16px;
            }
            
            .parameter-edit-modal-title {
                margin: 0 0 8px 0;
                font-size: 1.5em;
                color: var(--text-normal, #000000);
            }
            
            .parameter-edit-modal-description {
                margin: 0;
                color: var(--text-muted, #666666);
            }
            
            .parameter-edit-modal-container {
                margin-bottom: 16px;
            }
            
            .parameter-edit-textarea {
                width: 100%;
                height: 500px;
                min-height: 400px;
                font-family: monospace;
                resize: vertical;
                background-color: var(--background-modifier-form-field, #f5f5f5);
                padding: 10px;
                border-radius: 4px;
                border: 1px solid var(--background-modifier-border, #cccccc);
                font-size: 15px;
                color: var(--text-normal, #000000);
            }
            
            .parameter-edit-table-container {
                border: 1px solid var(--background-modifier-border, #cccccc);
                border-radius: 4px;
                max-height: 700px;
                overflow-y: auto;
                margin-bottom: 12px;
                background-color: var(--background-secondary, #f9f9f9);
            }
            
            .parameter-edit-table-row {
                display: flex;
                border-bottom: 1px solid var(--background-modifier-border, #cccccc);
                align-items: center;
            }
            
            .parameter-edit-table-row:last-child {
                border-bottom: none;
            }
            
            .parameter-edit-table-header {
                font-weight: bold;
                background-color: var(--interactive-accent-hover, #e0e0e0);
                color: var(--text-on-accent, #000000);
                position: sticky;
                top: 0;
                z-index: 1;
            }
            
            .parameter-edit-table-cell {
                padding: 10px 12px;
                flex: 1;
            }
            
            .parameter-edit-delete-cell {
                flex: 0 0 60px;
                text-align: center;
            }
            
            .parameter-edit-input {
                width: 100%;
                background-color: var(--background-modifier-form-field, #ffffff);
                border: 1px solid var(--background-modifier-border, #cccccc);
                border-radius: 4px;
                padding: 10px;
                font-size: 15px;
                height: 36px;
                color: var(--text-normal, #000000);
            }
            
            .parameter-edit-input:focus {
                outline: none;
                border-color: var(--interactive-accent, #007acc);
            }
            
            .parameter-edit-delete-button {
                background-color: var(--background-modifier-error-hover, #ff6b6b);
                color: white;
                border: none;
                border-radius: 50%;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                cursor: pointer;
                padding: 0;
                line-height: 1;
            }
            
            .parameter-edit-delete-button:hover {
                background-color: var(--background-modifier-error, #e55555);
            }
            
            .parameter-edit-add-row-button {
                background-color: var(--interactive-accent, #007acc);
                color: white;
                border: none;
                border-radius: 6px;
                padding: 12px 16px;
                cursor: pointer;
                width: 100%;
                margin-top: 12px;
                font-size: 16px;
                font-weight: 600;
            }
            
            .parameter-edit-add-row-button:hover {
                background-color: var(--interactive-accent-hover, #0066aa);
            }
            
            .parameter-edit-modal-buttons {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
            }
            
            .parameter-edit-button {
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                border: 1px solid var(--background-modifier-border, #cccccc);
                background-color: var(--background-primary, #ffffff);
                color: var(--text-normal, #000000);
            }
            
            .parameter-edit-button:hover {
                background-color: var(--background-modifier-hover, #f0f0f0);
            }
            
            .parameter-edit-save-button {
                background-color: var(--interactive-accent, #007acc);
                color: white;
                border: 1px solid var(--interactive-accent, #007acc);
            }
            
            .parameter-edit-save-button:hover {
                background-color: var(--interactive-accent-hover, #0066aa);
            }
        `;
        document.head.appendChild(styleEl);
    }
}

// 将类暴露为全局变量
window.ParameterEditModal = ParameterEditModal;

// 系统提示词管理弹窗类
class SystemPromptManageModal {
    constructor(onSubmit) {
        this.onSubmit = onSubmit;
        this.modal = null;
        
        // 从设置管理器获取系统提示词
        const settings = window.settingsManager ? window.settingsManager.getSettings() : {};
        this.systemPrompts = settings.systemPrompts || {};
        this.hiddenPresetPrompts = settings.hiddenPresetPrompts || [];
        
        // 预设的系统提示词
        this.presetPrompts = {
            'assistant': '你是一个有用的AI助手，请为用户提供准确、有用的回答。',
            'translator': '你是一个专业的翻译助手，请为用户提供准确的翻译服务。',
            'coder': '你是一个专业的编程助手，请帮助用户解决编程问题，提供准确的代码和技术建议。',
            'writer': '你是一个专业的写作助手，请帮助用户改进文字表达，提供写作建议。'
        };
        
        // 过滤掉被隐藏的预设提示词
        const visiblePresetPrompts = {};
        Object.keys(this.presetPrompts).forEach(key => {
            if (!this.hiddenPresetPrompts.includes(key)) {
                visiblePresetPrompts[key] = this.presetPrompts[key];
            }
        });
        
        // 合并可见的预设提示词和自定义提示词
        this.allPrompts = { ...visiblePresetPrompts, ...this.systemPrompts };
    }

    open() {
        this.createModal();
        document.body.appendChild(this.modal);
        this.addStyles();
        
        // 聚焦到第一个输入框
        setTimeout(() => {
            const firstInput = this.modal.querySelector('.system-prompt-name-input');
            if (firstInput) {
                firstInput.focus();
            }
        }, 100);
    }

    createModal() {
        // 创建遮罩层
        this.modal = document.createElement('div');
        this.modal.className = 'system-prompt-modal-backdrop';
        
        // 创建模态框容器
        const modalContainer = document.createElement('div');
        modalContainer.className = 'system-prompt-modal';
        
        // 创建头部
        const header = document.createElement('div');
        header.className = 'system-prompt-modal-header';
        header.innerHTML = `
            <h2 class="system-prompt-modal-title">系统提示词管理</h2>
            <p class="system-prompt-modal-description">管理您的系统提示词，每个提示词包含名称和内容</p>
        `;
        
        // 创建内容区域
        const content = document.createElement('div');
        content.className = 'system-prompt-modal-container';
        
        // 创建现有提示词列表
        const existingPromptsContainer = document.createElement('div');
        existingPromptsContainer.className = 'system-prompt-existing-container';
        
        const existingTitle = document.createElement('h3');
        existingTitle.textContent = '现有系统提示词';
        existingTitle.className = 'system-prompt-section-title';
        existingPromptsContainer.appendChild(existingTitle);
        
        this.existingPromptsContainer = existingPromptsContainer;
        this.renderExistingPrompts();
        content.appendChild(existingPromptsContainer);
        
        // 创建添加新提示词区域
        const newPromptContainer = document.createElement('div');
        newPromptContainer.className = 'system-prompt-new-container';
        
        const newTitle = document.createElement('h3');
        newTitle.textContent = '添加新系统提示词';
        newTitle.className = 'system-prompt-section-title';
        newPromptContainer.appendChild(newTitle);
        
        // 名称输入框
        const nameContainer = document.createElement('div');
        nameContainer.className = 'system-prompt-input-container';
        const nameLabel = document.createElement('label');
        nameLabel.textContent = '名称:';
        nameLabel.className = 'system-prompt-label';
        const nameInput = document.createElement('input');
        nameInput.className = 'system-prompt-name-input';
        nameInput.type = 'text';
        nameInput.placeholder = '输入系统提示词名称';
        nameContainer.appendChild(nameLabel);
        nameContainer.appendChild(nameInput);
        this.nameInput = nameInput;
        
        // 为名称输入框添加点击和聚焦事件
        nameInput.addEventListener('click', (e) => {
            e.stopPropagation();
            nameInput.focus();
        });
        
        // 内容输入框
        const contentContainer = document.createElement('div');
        contentContainer.className = 'system-prompt-input-container';
        const contentLabel = document.createElement('label');
        contentLabel.textContent = '内容:';
        contentLabel.className = 'system-prompt-label';
        const contentTextarea = document.createElement('textarea');
        contentTextarea.className = 'system-prompt-content-textarea';
        contentTextarea.rows = 5;
        contentTextarea.placeholder = '输入系统提示词内容';
        contentContainer.appendChild(contentLabel);
        contentContainer.appendChild(contentTextarea);
        this.contentTextarea = contentTextarea;
        
        // 为内容输入框添加点击和聚焦事件
        contentTextarea.addEventListener('click', (e) => {
            e.stopPropagation();
            contentTextarea.focus();
        });
        
        // 添加按钮
        const addButton = document.createElement('button');
        addButton.className = 'system-prompt-add-button';
        addButton.textContent = '添加系统提示词';
        addButton.addEventListener('click', () => this.addNewPrompt());
        
        newPromptContainer.appendChild(nameContainer);
        newPromptContainer.appendChild(contentContainer);
        newPromptContainer.appendChild(addButton);
        content.appendChild(newPromptContainer);
        
        // 创建按钮区域
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'system-prompt-modal-buttons';
        
        // 恢复预设提示词按钮
        const restoreButton = document.createElement('button');
        restoreButton.className = 'system-prompt-button system-prompt-restore-button';
        restoreButton.textContent = '恢复预设提示词';
        restoreButton.addEventListener('click', () => this.restoreHiddenPresets());
        
        const cancelButton = document.createElement('button');
        cancelButton.className = 'system-prompt-button';
        cancelButton.textContent = '取消';
        cancelButton.addEventListener('click', () => this.close());
        
        const saveButton = document.createElement('button');
        saveButton.className = 'system-prompt-button system-prompt-save-button';
        saveButton.textContent = '保存';
        saveButton.addEventListener('click', () => this.saveChanges());
        
        buttonContainer.appendChild(restoreButton);
        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(saveButton);
        
        // 组装模态框
        modalContainer.appendChild(header);
        modalContainer.appendChild(content);
        modalContainer.appendChild(buttonContainer);
        this.modal.appendChild(modalContainer);
        
        // 点击遮罩关闭，但不要干扰输入框事件
        // 注释掉：用户要求点击弹窗外部区域不关闭弹窗
        // this.modal.addEventListener('click', (e) => {
        //     // 只有在点击遮罩层本身时才关闭，不要阻止输入框的事件
        //     if (e.target === this.modal) {
        //         this.close();
        //     }
        // });
        
        // 阻止模态框内容区域的点击事件冒泡
        modalContainer.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // ESC键关闭 - 增强逻辑
        this.handleEsc = (e) => {
            if (e.key === 'Escape') {
                // 1. 优先检查是否有编辑弹窗
                const editModal = document.querySelector('.system-prompt-edit-modal-backdrop');
                if (editModal) {
                    // 关闭编辑弹窗
                    document.body.removeChild(editModal);
                    return;
                }
                
                // 2. 检查添加新系统提示词的输入框是否有内容
                const nameValue = this.nameInput ? this.nameInput.value.trim() : '';
                const contentValue = this.contentTextarea ? this.contentTextarea.value.trim() : '';
                
                if (nameValue || contentValue) {
                    // 有内容时提示用户确认
                    this.showExitConfirmDialog(() => {
                        // 用户确认退出
                        this.close();
                    });
                    return; // 等待用户选择
                }
                
                // 3. 关闭主弹窗
                this.close();
            }
        };
        document.addEventListener('keydown', this.handleEsc);
        
        // Ctrl+Enter保存
        this.handleSave = (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                this.saveChanges();
            }
        };
        document.addEventListener('keydown', this.handleSave);
    }
    
    // 渲染现有提示词
    renderExistingPrompts() {
        // 清空现有内容
        const container = this.existingPromptsContainer;
        const existingItems = container.querySelectorAll('.system-prompt-item');
        existingItems.forEach(item => item.remove());
        
        Object.keys(this.allPrompts).forEach(key => {
            const item = this.createPromptItem(key, this.allPrompts[key], this.presetPrompts.hasOwnProperty(key));
            container.appendChild(item);
        });
    }
    
    // 创建提示词项目
    createPromptItem(key, content, isPreset) {
        const item = document.createElement('div');
        item.className = 'system-prompt-item';
        
        // 名称显示
        const nameEl = document.createElement('div');
        nameEl.className = 'system-prompt-item-name';
        nameEl.textContent = key;
        if (isPreset) {
            nameEl.classList.add('system-prompt-preset');
        }
        
        // 内容显示（截断显示）
        const contentEl = document.createElement('div');
        contentEl.className = 'system-prompt-item-content';
        contentEl.textContent = content.length > 100 ? content.substring(0, 100) + '...' : content;
        contentEl.title = content; // 完整内容作为工具提示
        
        // 操作按钮容器
        const actionsEl = document.createElement('div');
        actionsEl.className = 'system-prompt-item-actions';
        
        // 编辑按钮
        const editButton = document.createElement('button');
        editButton.className = 'system-prompt-action-button system-prompt-edit-button';
        editButton.textContent = '编辑';
        editButton.addEventListener('click', () => this.editPrompt(key, content, isPreset));
        actionsEl.appendChild(editButton);
        
        // 删除按钮（所有提示词都可以删除）
        const deleteButton = document.createElement('button');
        deleteButton.className = 'system-prompt-action-button system-prompt-delete-button';
        deleteButton.textContent = '删除';
        deleteButton.addEventListener('click', () => this.deletePrompt(key, isPreset));
        actionsEl.appendChild(deleteButton);
        
        item.appendChild(nameEl);
        item.appendChild(contentEl);
        item.appendChild(actionsEl);
        
        return item;
    }
    
    // 编辑提示词
    editPrompt(key, content, isPreset) {
        // 创建编辑弹窗
        const editModal = this.createEditModal(key, content, isPreset);
        document.body.appendChild(editModal);
    }
    
    // 创建编辑弹窗
    createEditModal(key, content, isPreset) {
        const editModal = document.createElement('div');
        editModal.className = 'system-prompt-edit-modal-backdrop';
        
        const editContainer = document.createElement('div');
        editContainer.className = 'system-prompt-edit-modal';
        
        // 标题
        const title = document.createElement('h3');
        title.textContent = isPreset ? `编辑预设提示词: ${key}` : `编辑自定义提示词: ${key}`;
        title.className = 'system-prompt-edit-title';
        editContainer.appendChild(title);
        
        // 名称输入框（预设提示词不能修改名称）
        const nameContainer = document.createElement('div');
        nameContainer.className = 'system-prompt-input-container';
        const nameLabel = document.createElement('label');
        nameLabel.textContent = '名称:';
        nameLabel.className = 'system-prompt-label';
        const nameInput = document.createElement('input');
        nameInput.className = 'system-prompt-name-input';
        nameInput.type = 'text';
        nameInput.value = key;
        nameInput.disabled = isPreset;
        nameContainer.appendChild(nameLabel);
        nameContainer.appendChild(nameInput);
        
        // 为名称输入框添加点击和聚焦事件
        if (!isPreset) {
            nameInput.addEventListener('click', (e) => {
                e.stopPropagation();
                nameInput.focus();
            });
        }
        
        // 内容输入框
        const contentContainer = document.createElement('div');
        contentContainer.className = 'system-prompt-input-container';
        const contentLabel = document.createElement('label');
        contentLabel.textContent = '内容:';
        contentLabel.className = 'system-prompt-label';
        const contentTextarea = document.createElement('textarea');
        contentTextarea.className = 'system-prompt-content-textarea';
        contentTextarea.rows = 8;
        contentTextarea.value = content;
        contentContainer.appendChild(contentLabel);
        contentContainer.appendChild(contentTextarea);
        
        // 为内容输入框添加点击和聚焦事件
        contentTextarea.addEventListener('click', (e) => {
            e.stopPropagation();
            contentTextarea.focus();
        });
        
        // 按钮容器
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'system-prompt-modal-buttons';
        
        const cancelButton = document.createElement('button');
        cancelButton.className = 'system-prompt-button';
        cancelButton.textContent = '取消';
        cancelButton.addEventListener('click', () => document.body.removeChild(editModal));
        
        const saveButton = document.createElement('button');
        saveButton.className = 'system-prompt-button system-prompt-save-button';
        saveButton.textContent = '保存';
        saveButton.addEventListener('click', () => {
            const newName = nameInput.value.trim();
            const newContent = contentTextarea.value.trim();
            
            if (!newName || !newContent) {
                alert('名称和内容都不能为空');
                return;
            }
            
            // 如果是预设提示词，只能修改内容
            if (isPreset) {
                this.allPrompts[key] = newContent;
            } else {
                // 如果名称有变化，删除旧的，添加新的
                if (newName !== key) {
                    delete this.allPrompts[key];
                }
                this.allPrompts[newName] = newContent;
            }
            
            this.renderExistingPrompts();
            document.body.removeChild(editModal);
        });
        
        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(saveButton);
        
        editContainer.appendChild(nameContainer);
        editContainer.appendChild(contentContainer);
        editContainer.appendChild(buttonContainer);
        editModal.appendChild(editContainer);
        
        // 点击遮罩关闭
        editModal.addEventListener('click', (e) => {
            if (e.target === editModal) {
                document.body.removeChild(editModal);
            }
        });
        
        // 聚焦到内容输入框
        setTimeout(() => contentTextarea.focus(), 100);
        
        return editModal;
    }
    
    // 删除提示词
    deletePrompt(key, isPreset = false) {
        delete this.allPrompts[key];
        
        // 如果是预设提示词，需要记录到隐藏列表中
        if (isPreset) {
            if (!this.hiddenPresetPrompts) {
                this.hiddenPresetPrompts = [];
            }
            if (!this.hiddenPresetPrompts.includes(key)) {
                this.hiddenPresetPrompts.push(key);
            }
        }
        
        this.renderExistingPrompts();
    }
    
    // 添加新提示词
    addNewPrompt() {
        const name = this.nameInput.value.trim();
        const content = this.contentTextarea.value.trim();
        
        if (!name) {
            alert('名称不能为空');
            return;
        }
        
        if (this.allPrompts.hasOwnProperty(name)) {
            alert('该名称已存在，请使用其他名称');
            return;
        }
        
        // 内容可以为空，使用空字符串
        this.allPrompts[name] = content || '';
        this.renderExistingPrompts();
        
        // 清空输入框
        this.nameInput.value = '';
        this.contentTextarea.value = '';
    }
    
    // 恢复被隐藏的预设提示词
    restoreHiddenPresets() {
        if (!this.hiddenPresetPrompts || this.hiddenPresetPrompts.length === 0) {
            alert('没有被隐藏的预设提示词需要恢复');
            return;
        }
        
        const hiddenCount = this.hiddenPresetPrompts.length;
        
        // 恢复所有被隐藏的预设提示词
        this.hiddenPresetPrompts.forEach(key => {
            if (this.presetPrompts[key]) {
                this.allPrompts[key] = this.presetPrompts[key];
            }
        });
        
        // 清空隐藏列表
        this.hiddenPresetPrompts = [];
        
        // 重新渲染
        this.renderExistingPrompts();
        
        alert(`已恢复 ${hiddenCount} 个预设提示词`);
    }
    
    // 保存更改
    async saveChanges() {
        // 首先检查是否有待添加的新提示词
        const name = this.nameInput.value.trim();
        if (name) {
            // 检查名称是否已存在
            if (this.allPrompts.hasOwnProperty(name)) {
                alert('该名称已存在，请使用其他名称');
                return;
            }
            
            // 获取内容，如果为空则使用空字符串
            const content = this.contentTextarea.value.trim() || '';
            
            // 添加新提示词
            this.allPrompts[name] = content;
            this.renderExistingPrompts();
            
            // 清空输入框
            this.nameInput.value = '';
            this.contentTextarea.value = '';
        }
        
        // 分离预设和自定义提示词
        const customPrompts = {};
        Object.keys(this.allPrompts).forEach(key => {
            if (this.presetPrompts.hasOwnProperty(key)) {
                // 预设提示词，如果内容有变化则保存到自定义中
                if (this.allPrompts[key] !== this.presetPrompts[key]) {
                    customPrompts[key] = this.allPrompts[key];
                }
            } else {
                // 自定义提示词
                customPrompts[key] = this.allPrompts[key];
            }
        });
        
        // 保存到设置管理器
        if (window.settingsManager && typeof window.settingsManager.updateSetting === 'function') {
            console.log('保存系统提示词设置:', customPrompts);
            console.log('保存隐藏的预设提示词:', this.hiddenPresetPrompts);
            
            window.settingsManager.updateSetting('systemPrompts', customPrompts);
            window.settingsManager.updateSetting('hiddenPresetPrompts', this.hiddenPresetPrompts || []);
            window.settingsManager.saveSettings();
            
            console.log('系统提示词设置已保存');
        } else {
            console.error('设置管理器不可用');
        }
        
        // 调用回调函数
        if (this.onSubmit) {
            await this.onSubmit();
        }
        
        this.close();
    }
    
    // 显示退出确认对话框
    showExitConfirmDialog(onConfirm) {
        // 创建确认弹窗遮罩
        const confirmBackdrop = document.createElement('div');
        confirmBackdrop.className = 'system-prompt-confirm-backdrop';
        
        // 创建确认弹窗容器
        const confirmModal = document.createElement('div');
        confirmModal.className = 'system-prompt-confirm-modal';
        
        // 标题
        const title = document.createElement('h3');
        title.className = 'system-prompt-confirm-title';
        title.textContent = '确认退出';
        
        // 消息内容
        const message = document.createElement('p');
        message.className = 'system-prompt-confirm-message';
        message.textContent = '当前有新建系统提示词，退出会取消保存，是否退出？';
        
        // 按钮容器
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'system-prompt-confirm-buttons';
        
        // 取消按钮
        const cancelButton = document.createElement('button');
        cancelButton.className = 'system-prompt-confirm-button system-prompt-confirm-cancel';
        cancelButton.textContent = '取消';
        cancelButton.addEventListener('click', () => {
            document.body.removeChild(confirmBackdrop);
        });
        
        // 确认按钮
        const confirmButton = document.createElement('button');
        confirmButton.className = 'system-prompt-confirm-button system-prompt-confirm-confirm';
        confirmButton.textContent = '确认退出';
        confirmButton.addEventListener('click', () => {
            document.body.removeChild(confirmBackdrop);
            if (onConfirm) {
                onConfirm();
            }
        });
        
        // 组装弹窗
        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(confirmButton);
        confirmModal.appendChild(title);
        confirmModal.appendChild(message);
        confirmModal.appendChild(buttonContainer);
        confirmBackdrop.appendChild(confirmModal);
        
        // 点击遮罩关闭
        confirmBackdrop.addEventListener('click', (e) => {
            if (e.target === confirmBackdrop) {
                document.body.removeChild(confirmBackdrop);
            }
        });
        
        // ESC键关闭确认弹窗
        const handleConfirmEsc = (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(confirmBackdrop);
                document.removeEventListener('keydown', handleConfirmEsc);
            }
        };
        document.addEventListener('keydown', handleConfirmEsc);
        
        // 添加到页面
        document.body.appendChild(confirmBackdrop);
        
        // 聚焦到取消按钮
        setTimeout(() => cancelButton.focus(), 100);
    }
    
    close() {
        if (this.modal && this.modal.parentNode) {
            document.body.removeChild(this.modal);
        }
        
        // 移除事件监听器
        if (this.handleEsc) {
            document.removeEventListener('keydown', this.handleEsc);
        }
        if (this.handleSave) {
            document.removeEventListener('keydown', this.handleSave);
        }
    }
    
    // 添加样式
    addStyles() {
        // 避免重复添加样式
        const existingStyle = document.getElementById('system-prompt-modal-styles');
        if (existingStyle) return;
        
        const styleEl = document.createElement('style');
        styleEl.id = 'system-prompt-modal-styles';
        styleEl.textContent = `
            .system-prompt-modal-backdrop {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
            }
            
            .system-prompt-modal {
                background-color: var(--background-primary, #ffffff);
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                width: 90%;
                max-width: 1200px;
                max-height: 90%;
                overflow-y: auto;
                padding: 20px;
            }
            
            .system-prompt-modal-header {
                margin-bottom: 20px;
            }
            
            .system-prompt-modal-title {
                margin: 0 0 8px 0;
                font-size: 1.5em;
                color: var(--text-normal, #000000);
            }
            
            .system-prompt-modal-description {
                margin: 0;
                color: var(--text-muted, #666666);
            }
            
            .system-prompt-section-title {
                margin: 0 0 16px 0;
                font-size: 1.2em;
                color: var(--text-normal, #000000);
                border-bottom: 2px solid var(--interactive-accent, #007acc);
                padding-bottom: 8px;
            }
            
            .system-prompt-existing-container {
                margin-bottom: 30px;
            }
            
            .system-prompt-item {
                display: flex;
                align-items: center;
                padding: 12px;
                border: 1px solid var(--background-modifier-border, #cccccc);
                border-radius: 6px;
                margin-bottom: 8px;
                background-color: var(--background-secondary, #f9f9f9);
            }
            
            .system-prompt-item-name {
                font-weight: bold;
                color: var(--text-normal, #000000);
                min-width: 120px;
                margin-right: 16px;
            }
            
            .system-prompt-preset {
                color: var(--interactive-accent, #007acc);
            }
            
            .system-prompt-item-content {
                flex: 1;
                color: var(--text-muted, #666666);
                margin-right: 16px;
                line-height: 1.4;
            }
            
            .system-prompt-item-actions {
                display: flex;
                gap: 8px;
            }
            
            .system-prompt-action-button {
                padding: 6px 12px;
                border: 1px solid var(--background-modifier-border, #cccccc);
                border-radius: 4px;
                background-color: var(--background-primary, #ffffff);
                color: var(--text-normal, #000000);
                cursor: pointer;
                font-size: 12px;
            }
            
            .system-prompt-edit-button:hover {
                background-color: var(--interactive-accent, #007acc);
                color: white;
            }
            
            .system-prompt-delete-button {
                background-color: var(--background-modifier-error-hover, #ff6b6b);
                color: white;
                border-color: var(--background-modifier-error-hover, #ff6b6b);
            }
            
            .system-prompt-delete-button:hover {
                background-color: var(--background-modifier-error, #e55555);
            }
            
            .system-prompt-new-container {
                border: 2px dashed var(--background-modifier-border, #cccccc);
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 20px;
            }
            
            .system-prompt-input-container {
                margin-bottom: 16px;
            }
            
            .system-prompt-label {
                display: block;
                margin-bottom: 8px;
                font-weight: bold;
                color: var(--text-normal, #000000);
            }
            
            .system-prompt-name-input {
                width: 100%;
                padding: 10px;
                border: 1px solid var(--background-modifier-border, #cccccc);
                border-radius: 4px;
                background-color: var(--background-modifier-form-field, #ffffff);
                color: var(--text-normal, #000000);
                font-size: 14px;
                box-sizing: border-box;
                cursor: text;
                pointer-events: auto;
                z-index: 1;
            }
            
            .system-prompt-name-input:focus {
                outline: none;
                border-color: var(--interactive-accent, #007acc);
                box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2);
            }
            
            .system-prompt-content-textarea {
                width: 100%;
                padding: 10px;
                border: 1px solid var(--background-modifier-border, #cccccc);
                border-radius: 4px;
                background-color: var(--background-modifier-form-field, #ffffff);
                color: var(--text-normal, #000000);
                font-size: 14px;
                font-family: var(--font-monospace, monospace);
                resize: vertical;
                min-height: 80px;
                box-sizing: border-box;
                cursor: text;
                pointer-events: auto;
                z-index: 1;
            }
            
            .system-prompt-content-textarea:focus {
                outline: none;
                border-color: var(--interactive-accent, #007acc);
                box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2);
            }
            
            .system-prompt-add-button {
                background-color: var(--interactive-accent, #007acc);
                color: white;
                border: none;
                border-radius: 6px;
                padding: 12px 20px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
            }
            
            .system-prompt-add-button:hover {
                background-color: var(--interactive-accent-hover, #0066aa);
            }
            
            .system-prompt-modal-buttons {
                display: flex;
                justify-content: flex-end;
                gap: 12px;
                margin-top: 20px;
            }
            
            .system-prompt-button {
                padding: 10px 20px;
                border: 1px solid var(--background-modifier-border, #cccccc);
                border-radius: 4px;
                background-color: var(--background-primary, #ffffff);
                color: var(--text-normal, #000000);
                cursor: pointer;
                font-size: 14px;
            }
            
            .system-prompt-button:hover {
                background-color: var(--background-modifier-hover, #f0f0f0);
            }
            
            .system-prompt-save-button {
                background-color: var(--interactive-accent, #007acc);
                color: white;
                border-color: var(--interactive-accent, #007acc);
            }
            
            .system-prompt-save-button:hover {
                background-color: var(--interactive-accent-hover, #0066aa);
            }
            
            .system-prompt-restore-button {
                background-color: #28a745;
                color: white;
                border-color: #28a745;
            }
            
            .system-prompt-restore-button:hover {
                background-color: #218838;
            }
            
            .system-prompt-edit-modal-backdrop {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10001;
            }
            
            .system-prompt-edit-modal {
                background-color: var(--background-primary, #ffffff);
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                width: 90%;
                max-width: 600px;
                padding: 20px;
            }
            
            .system-prompt-edit-title {
                margin: 0 0 20px 0;
                font-size: 1.3em;
                color: var(--text-normal, #000000);
            }
            
            /* 确认弹窗样式 */
            .system-prompt-confirm-backdrop {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.6);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10002;
            }
            
            .system-prompt-confirm-modal {
                background-color: var(--background-primary, #ffffff);
                border-radius: 8px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
                padding: 24px;
                max-width: 400px;
                width: 90%;
                text-align: center;
            }
            
            .system-prompt-confirm-title {
                margin: 0 0 16px 0;
                font-size: 1.2em;
                font-weight: 600;
                color: var(--text-normal, #000000);
            }
            
            .system-prompt-confirm-message {
                margin: 0 0 24px 0;
                color: var(--text-muted, #666666);
                line-height: 1.5;
            }
            
            .system-prompt-confirm-buttons {
                display: flex;
                justify-content: center;
                gap: 12px;
            }
            
            .system-prompt-confirm-button {
                padding: 10px 20px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.2s ease;
                min-width: 80px;
            }
            
            .system-prompt-confirm-cancel {
                background-color: var(--background-modifier-border, #e0e0e0);
                color: var(--text-normal, #000000);
            }
            
            .system-prompt-confirm-cancel:hover {
                background-color: var(--background-modifier-hover, #d0d0d0);
            }
            
            .system-prompt-confirm-confirm {
                background-color: #dc3545;
                color: white;
            }
            
            .system-prompt-confirm-confirm:hover {
                background-color: #c82333;
            }
        `;
        document.head.appendChild(styleEl);
    }
}

// 将类暴露为全局变量
window.SystemPromptManageModal = SystemPromptManageModal;

// 消息编辑弹窗类
class MessageEditModal {
    constructor(message, onSave, onSaveAndSend = null) {
        this.message = message;
        this.onSave = onSave;
        this.onSaveAndSend = onSaveAndSend;
        this.modal = null;
    }

    open() {
        this.createModal();
        document.body.appendChild(this.modal);
        this.addStyles();
        
        // 聚焦到输入框
        setTimeout(() => {
            const textArea = this.modal.querySelector('.message-edit-textarea');
            if (textArea) {
                textArea.focus();
                textArea.select();
            }
        }, 100);
    }

    createModal() {
        // 创建遮罩层
        this.modal = document.createElement('div');
        this.modal.className = 'message-edit-modal-backdrop';
        
        // 创建模态框容器
        const modalContainer = document.createElement('div');
        modalContainer.className = 'message-edit-modal';
        
        // 创建头部
        const header = document.createElement('div');
        header.className = 'message-edit-modal-header';
        
        const title = document.createElement('h2');
        title.className = 'message-edit-modal-title';
        title.textContent = this.message.type === 'user' ? '编辑用户消息' : '编辑AI回复';
        header.appendChild(title);
        
        // 创建内容区域
        const content = document.createElement('div');
        content.className = 'message-edit-modal-content';
        
        // 创建文本输入区域
        const textArea = document.createElement('textarea');
        textArea.className = 'message-edit-textarea';
        textArea.value = this.message.content;
        textArea.rows = 10;
        textArea.placeholder = '输入消息内容...';
        
        // 为文本区域添加点击和聚焦事件
        textArea.addEventListener('click', (e) => {
            e.stopPropagation();
            textArea.focus();
        });
        
        content.appendChild(textArea);
        this.textArea = textArea;
        
        // 创建按钮区域
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'message-edit-modal-buttons';
        
        const cancelButton = document.createElement('button');
        cancelButton.className = 'message-edit-button';
        cancelButton.textContent = '取消';
        cancelButton.addEventListener('click', () => this.close());
        
        const saveButton = document.createElement('button');
        saveButton.className = 'message-edit-button message-edit-save-button';
        saveButton.textContent = '保存';
        saveButton.addEventListener('click', () => this.saveMessage());
        
        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(saveButton);
        
        // 如果提供了发送回调，添加发送按钮
        if (this.onSaveAndSend) {
            const sendButton = document.createElement('button');
            sendButton.className = 'message-edit-button message-edit-send-button';
            sendButton.textContent = '发送';
            sendButton.addEventListener('click', () => this.saveAndSend());
            buttonContainer.appendChild(sendButton);
        }
        
        // 组装模态框
        modalContainer.appendChild(header);
        modalContainer.appendChild(content);
        modalContainer.appendChild(buttonContainer);
        this.modal.appendChild(modalContainer);
        
        // 点击遮罩不再关闭弹窗，只阻止事件冒泡
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                e.stopPropagation();
            }
        });
        
        // 阻止模态框内容区域的点击事件冒泡
        modalContainer.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // ESC键关闭
        this.handleEsc = (e) => {
            if (e.key === 'Escape') {
                this.close();
            }
        };
        document.addEventListener('keydown', this.handleEsc);
        
        // Ctrl+Enter保存
        this.handleSave = (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                this.saveMessage();
            }
        };
        document.addEventListener('keydown', this.handleSave);
    }
    
    saveMessage() {
        const newContent = this.textArea.value.trim();
        
        if (!newContent) {
            alert('消息内容不能为空');
            return;
        }
        
        // 调用保存回调
        if (this.onSave) {
            this.onSave(newContent);
        }
        
        this.close();
    }
    
    saveAndSend() {
        const newContent = this.textArea.value.trim();
        
        if (!newContent) {
            alert('消息内容不能为空');
            return;
        }
        
        // 调用保存并发送回调
        if (this.onSaveAndSend) {
            this.onSaveAndSend(newContent);
        }
        
        this.close();
    }
    
    close() {
        if (this.modal && this.modal.parentNode) {
            document.body.removeChild(this.modal);
        }
        
        // 移除事件监听器
        if (this.handleEsc) {
            document.removeEventListener('keydown', this.handleEsc);
        }
        if (this.handleSave) {
            document.removeEventListener('keydown', this.handleSave);
        }
    }
    
    // 添加样式
    addStyles() {
        // 避免重复添加样式
        const existingStyle = document.getElementById('message-edit-modal-styles');
        if (existingStyle) return;
        
        const styleEl = document.createElement('style');
        styleEl.id = 'message-edit-modal-styles';
        styleEl.textContent = `
            .message-edit-modal-backdrop {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
            }
            
            .message-edit-modal {
                background-color: var(--background-primary, #ffffff);
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                width: 90%;
                max-width: 800px;
                max-height: 90%;
                overflow-y: auto;
                padding: 20px;
            }
            
            .message-edit-modal-header {
                margin-bottom: 20px;
            }
            
            .message-edit-modal-title {
                margin: 0;
                font-size: 1.4em;
                color: var(--text-normal, #000000);
            }
            
            .message-edit-modal-content {
                margin-bottom: 20px;
            }
            
            .message-edit-textarea {
                width: 100%;
                min-height: 200px;
                padding: 12px;
                border: 1px solid var(--background-modifier-border, #cccccc);
                border-radius: 6px;
                background-color: var(--background-modifier-form-field, #ffffff);
                color: var(--text-normal, #000000);
                font-size: 14px;
                font-family: inherit;
                line-height: 1.5;
                resize: vertical;
                box-sizing: border-box;
                cursor: text;
                pointer-events: auto;
            }
            
            .message-edit-textarea:focus {
                outline: none;
                border-color: var(--interactive-accent, #007acc);
                box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2);
            }
            
            .message-edit-modal-buttons {
                display: flex;
                justify-content: flex-end;
                gap: 12px;
            }
            
            .message-edit-button {
                padding: 10px 20px;
                border: 1px solid var(--background-modifier-border, #cccccc);
                border-radius: 4px;
                background-color: var(--background-primary, #ffffff);
                color: var(--text-normal, #000000);
                cursor: pointer;
                font-size: 14px;
            }
            
            .message-edit-button:hover {
                background-color: var(--background-modifier-hover, #f0f0f0);
            }
            
            .message-edit-save-button {
                background-color: var(--interactive-accent, #007acc);
                color: white;
                border-color: var(--interactive-accent, #007acc);
            }
            
            .message-edit-save-button:hover {
                background-color: var(--interactive-accent-hover, #0066aa);
            }
            
            .message-edit-send-button {
                background-color: #28a745;
                color: white;
                border-color: #28a745;
            }
            
            .message-edit-send-button:hover {
                background-color: #218838;
            }
        `;
        document.head.appendChild(styleEl);
    }
}

// 将类暴露为全局变量
window.MessageEditModal = MessageEditModal;

// 对话重命名弹窗类
class ConversationRenameModal {
    constructor(conversation, onSave) {
        this.conversation = conversation;
        this.onSave = onSave;
        this.modal = null;
    }

    open() {
        this.createModal();
        document.body.appendChild(this.modal);
        this.addStyles();
        
        // 聚焦到输入框并选中所有文本
        setTimeout(() => {
            const input = this.modal.querySelector('.conversation-rename-input');
            if (input) {
                input.focus();
                input.select();
            }
        }, 100);
    }

    createModal() {
        // 创建遮罩层
        this.modal = document.createElement('div');
        this.modal.className = 'conversation-rename-modal-backdrop';
        
        // 创建模态框容器
        const modalContainer = document.createElement('div');
        modalContainer.className = 'conversation-rename-modal';
        
        // 创建头部
        const header = document.createElement('div');
        header.className = 'conversation-rename-modal-header';
        
        const title = document.createElement('h2');
        title.className = 'conversation-rename-modal-title';
        title.textContent = '重命名对话';
        header.appendChild(title);
        
        // 创建内容区域
        const content = document.createElement('div');
        content.className = 'conversation-rename-modal-content';
        
        // 创建输入框
        const input = document.createElement('input');
        input.className = 'conversation-rename-input';
        input.type = 'text';
        input.value = this.conversation.title;
        input.placeholder = '输入新的对话标题...';
        input.maxLength = 100; // 限制标题长度
        
        // 为输入框添加点击和聚焦事件
        input.addEventListener('click', (e) => {
            e.stopPropagation();
            input.focus();
        });
        
        // 添加Enter键保存功能
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.saveTitle();
            }
        });
        
        content.appendChild(input);
        this.input = input;
        
        // 创建按钮区域
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'conversation-rename-modal-buttons';
        
        const cancelButton = document.createElement('button');
        cancelButton.className = 'conversation-rename-button';
        cancelButton.textContent = '取消';
        cancelButton.addEventListener('click', () => this.close());
        
        const saveButton = document.createElement('button');
        saveButton.className = 'conversation-rename-button conversation-rename-save-button';
        saveButton.textContent = '保存';
        saveButton.addEventListener('click', () => this.saveTitle());
        
        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(saveButton);
        
        // 组装模态框
        modalContainer.appendChild(header);
        modalContainer.appendChild(content);
        modalContainer.appendChild(buttonContainer);
        this.modal.appendChild(modalContainer);
        
        // 点击遮罩关闭
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });
        
        // 阻止模态框内容区域的点击事件冒泡
        modalContainer.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // ESC键关闭
        this.handleEsc = (e) => {
            if (e.key === 'Escape') {
                this.close();
            }
        };
        document.addEventListener('keydown', this.handleEsc);
    }
    
    saveTitle() {
        const newTitle = this.input.value.trim();
        
        if (!newTitle) {
            alert('对话标题不能为空');
            return;
        }
        
        if (newTitle === this.conversation.title) {
            // 标题没有变化，直接关闭
            this.close();
            return;
        }
        
        // 调用保存回调
        if (this.onSave) {
            this.onSave(newTitle);
        }
        
        this.close();
    }
    
    close() {
        if (this.modal && this.modal.parentNode) {
            document.body.removeChild(this.modal);
        }
        
        // 移除事件监听器
        if (this.handleEsc) {
            document.removeEventListener('keydown', this.handleEsc);
        }
    }
    
    // 添加样式
    addStyles() {
        // 避免重复添加样式
        const existingStyle = document.getElementById('conversation-rename-modal-styles');
        if (existingStyle) return;
        
        const styleEl = document.createElement('style');
        styleEl.id = 'conversation-rename-modal-styles';
        styleEl.textContent = `
            .conversation-rename-modal-backdrop {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
            }
            
            .conversation-rename-modal {
                background-color: var(--background-primary, #ffffff);
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                width: 90%;
                max-width: 500px;
                padding: 20px;
            }
            
            .conversation-rename-modal-header {
                margin-bottom: 20px;
            }
            
            .conversation-rename-modal-title {
                margin: 0;
                font-size: 1.3em;
                color: var(--text-normal, #000000);
            }
            
            .conversation-rename-modal-content {
                margin-bottom: 20px;
            }
            
            .conversation-rename-input {
                width: 100%;
                padding: 12px;
                border: 1px solid var(--background-modifier-border, #cccccc);
                border-radius: 6px;
                background-color: var(--background-modifier-form-field, #ffffff);
                color: var(--text-normal, #000000);
                font-size: 14px;
                font-family: inherit;
                box-sizing: border-box;
                cursor: text;
                pointer-events: auto;
            }
            
            .conversation-rename-input:focus {
                outline: none;
                border-color: var(--interactive-accent, #007acc);
                box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2);
            }
            
            .conversation-rename-modal-buttons {
                display: flex;
                justify-content: flex-end;
                gap: 12px;
            }
            
            .conversation-rename-button {
                padding: 10px 20px;
                border: 1px solid var(--background-modifier-border, #cccccc);
                border-radius: 4px;
                background-color: var(--background-primary, #ffffff);
                color: var(--text-normal, #000000);
                cursor: pointer;
                font-size: 14px;
            }
            
            .conversation-rename-button:hover {
                background-color: var(--background-modifier-hover, #f0f0f0);
            }
            
            .conversation-rename-save-button {
                background-color: var(--interactive-accent, #007acc);
                color: white;
                border-color: var(--interactive-accent, #007acc);
            }
            
            .conversation-rename-save-button:hover {
                background-color: var(--interactive-accent-hover, #0066aa);
            }
        `;
        document.head.appendChild(styleEl);
    }
}

// 将类暴露为全局变量
window.ConversationRenameModal = ConversationRenameModal;