// 预设管理器
class PresetManager {
    constructor() {
        this.presets = [];
        this.currentPresetId = null;
        this.isEditMode = false;
        this.editingPresetId = null;
        
        // DOM 元素
        this.addPresetBtn = null;
        this.toggleLayoutBtn = null;
        this.presetsContainer = null;
        this.presetModal = null;
        this.presetForm = null;
        this.presetModalTitle = null;
        this.presetModalClose = null;
        this.presetCancelBtn = null;
        this.presetSaveBtn = null;
        this.temperatureSlider = null;
        this.temperatureValue = null;
        this.contextMenu = null;
        
        // 布局状态
        this.layoutMode = 'compact'; // 默认紧凑布局
        this.contextTargetPresetId = null;
        
        this.init();
    }

    async init() {
        console.log('=== 预设管理器初始化开始 ===');
        
        // 等待DOM加载完成
        if (document.readyState === 'loading') {
            console.log('等待DOM加载完成...');
            document.addEventListener('DOMContentLoaded', () => {
                this.setupDOM();
            });
        } else {
            console.log('DOM已加载完成，直接初始化');
            this.setupDOM();
        }
    }

    setupDOM() {
        // 获取DOM元素
        this.addPresetBtn = document.getElementById('add-preset-btn');
        this.toggleLayoutBtn = document.getElementById('toggle-layout-btn');
        this.presetsContainer = document.getElementById('presets-container');
        this.presetModal = document.getElementById('preset-modal');
        this.presetForm = document.getElementById('preset-form');
        this.presetModalTitle = document.getElementById('preset-modal-title');
        this.presetModalClose = document.getElementById('preset-modal-close');
        this.presetCancelBtn = document.getElementById('preset-cancel-btn');
        this.presetSaveBtn = document.getElementById('preset-save-btn');
        this.temperatureSlider = document.getElementById('preset-temperature');
        this.temperatureValue = document.getElementById('preset-temperature-value');
        this.contextMenu = document.getElementById('preset-context-menu');

        if (!this.addPresetBtn || !this.presetsContainer || !this.presetModal || !this.toggleLayoutBtn) {
            console.error('预设管理器: 无法找到必要的DOM元素');
            return;
        }

        // 设置事件监听器
        this.setupEventListeners();
        
        // 设置页面卸载保护
        this.setupUnloadProtection();
        
        // 设置跨实例同步
        this.setupCrossInstanceSync();
        
        // 加载预设数据
        this.loadPresets();
        
        // 初始化布局
        this.initializeLayout();
        
        // 渲染预设列表
        this.renderPresets();

        console.log('=== 预设管理器初始化完成 ===');
        console.log('初始化后预设数量:', this.presets.length);
        console.log('当前布局模式:', this.layoutMode);
    }

    setupEventListeners() {
        // 新增预设按钮
        this.addPresetBtn.addEventListener('click', () => {
            this.openModal('add');
        });

        // 布局切换按钮
        this.toggleLayoutBtn.addEventListener('click', () => {
            this.toggleLayout();
        });

        // 弹窗关闭按钮
        this.presetModalClose.addEventListener('click', () => {
            this.closeModal();
        });

        // 取消按钮
        this.presetCancelBtn.addEventListener('click', () => {
            this.closeModal();
        });

        // 表单提交
        this.presetForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.savePreset();
        });

        // API密钥选择事件（如果需要特殊处理可以在这里添加）

        // 温度参数滑块
        this.temperatureSlider.addEventListener('input', (e) => {
            this.temperatureValue.textContent = e.target.value;
        });

        // 点击遮罩层关闭弹窗
        this.presetModal.addEventListener('click', (e) => {
            if (e.target === this.presetModal || e.target.classList.contains('preset-modal-overlay')) {
                this.closeModal();
            }
        });

        // ESC键关闭弹窗和右键菜单
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.presetModal.classList.contains('show')) {
                    this.closeModal();
                }
                this.hideContextMenu();
            }
        });

        // 点击其他地方关闭右键菜单
        document.addEventListener('click', (e) => {
            if (!this.contextMenu.contains(e.target)) {
                this.hideContextMenu();
            }
        });

        // 右键菜单事件
        this.setupContextMenuEvents();
    }

    // 设置页面卸载保护
    setupUnloadProtection() {
        // 在页面卸载前保存预设数据
        window.addEventListener('beforeunload', () => {
            console.log('页面即将卸载，保存预设数据...');
            if (this.presets.length > 0) {
                this.savePresets();
                console.log('已在页面卸载前保存预设数据');
            }
        });

        // 定期自动保存
        setInterval(() => {
            if (this.presets.length > 0) {
                this.savePresets();
                console.log('定期自动保存预设数据');
            }
        }, 30000); // 每30秒自动保存一次
    }

    // 初始化预设表单选项（使用快捷设置的数据源）
    initializePresetFormOptions() {
        // 使用快捷设置的初始化方法来填充选项
        if (window.chatManager && typeof window.chatManager.initializeQuickSettingsOptions === 'function') {
            console.log('使用快捷设置数据初始化预设表单选项');
            
            // 先初始化快捷设置选项
            window.chatManager.initializeQuickSettingsOptions();
            
            // 然后将快捷设置的选项复制到预设表单
            this.copyOptionsFromQuickSettings();
        } else {
            console.warn('快捷设置初始化方法不可用，使用默认选项');
        }
    }

    // 从快捷设置复制选项到预设表单
    copyOptionsFromQuickSettings() {
        // 复制供应商选项
        this.copySelectOptions('quick-provider', 'preset-provider');
        
        // 复制API密钥选项
        this.copySelectOptions('quick-api-key', 'preset-api-key');
        
        // 复制模型选项
        this.copySelectOptions('quick-model', 'preset-model');
        
        // 复制系统提示词选项
        this.copySelectOptions('quick-system-prompt', 'preset-system-prompt');
        
        console.log('预设表单选项复制完成');
    }

    // 复制下拉菜单选项的通用方法
    copySelectOptions(sourceId, targetId) {
        const sourceSelect = document.getElementById(sourceId);
        const targetSelect = document.getElementById(targetId);
        
        if (!sourceSelect || !targetSelect) {
            console.warn(`无法复制选项: ${sourceId} -> ${targetId}`);
            return;
        }

        // 保存目标下拉菜单的默认选项
        const defaultOptions = Array.from(targetSelect.querySelectorAll('option[data-default]'));
        
        // 清空目标下拉菜单
        targetSelect.innerHTML = '';
        
        // 如果有默认选项，重新添加
        if (defaultOptions.length > 0) {
            defaultOptions.forEach(option => {
                targetSelect.appendChild(option.cloneNode(true));
            });
        } else {
            // 如果没有默认选项，添加一个请选择选项
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = `请选择${this.getFieldDisplayName(targetId)}`;
            targetSelect.appendChild(defaultOption);
        }
        
        // 复制源下拉菜单的选项（跳过空值选项）
        Array.from(sourceSelect.options).forEach(option => {
            if (option.value && option.value !== '') {
                const newOption = document.createElement('option');
                newOption.value = option.value;
                newOption.textContent = option.textContent;
                targetSelect.appendChild(newOption);
            }
        });
        
        console.log(`复制选项: ${sourceId} -> ${targetId}, 共${targetSelect.options.length}个选项`);
    }

    // 获取字段显示名称
    getFieldDisplayName(fieldId) {
        const displayNames = {
            'preset-provider': '供应商',
            'preset-api-key': 'API密钥',
            'preset-model': '模型',
            'preset-system-prompt': '系统提示词'
        };
        return displayNames[fieldId] || '选项';
    }

    // 初始化布局
    initializeLayout() {
        // 从localStorage加载布局设置
        try {
            const savedLayout = localStorage.getItem('sikongai-preset-layout');
            if (savedLayout && ['normal', 'compact'].includes(savedLayout)) {
                this.layoutMode = savedLayout;
            }
        } catch (error) {
            console.error('加载布局设置失败:', error);
        }

        // 应用布局
        this.applyLayout();
    }

    // 切换布局
    toggleLayout() {
        this.layoutMode = this.layoutMode === 'compact' ? 'normal' : 'compact';
        this.applyLayout();
        this.saveLayoutPreference();
        
        console.log('布局已切换为:', this.layoutMode);
    }

    // 应用布局
    applyLayout() {
        if (!this.presetsContainer) return;

        // 移除现有布局类
        this.presetsContainer.classList.remove('layout-normal', 'layout-compact');
        
        // 添加当前布局类
        this.presetsContainer.classList.add(`layout-${this.layoutMode}`);

        // 更新切换按钮图标
        this.updateLayoutButton();
    }

    // 更新布局按钮
    updateLayoutButton() {
        if (!this.toggleLayoutBtn) return;

        const gridIcon = this.toggleLayoutBtn.querySelector('.layout-grid-icon');
        const listIcon = this.toggleLayoutBtn.querySelector('.layout-list-icon');

        if (this.layoutMode === 'compact') {
            // 当前是紧凑布局，显示网格图标，点击切换到正常布局
            gridIcon.style.display = 'block';
            listIcon.style.display = 'none';
            this.toggleLayoutBtn.title = '切换到详细布局';
            this.toggleLayoutBtn.classList.remove('active');
        } else {
            // 当前是正常布局，显示列表图标，点击切换到紧凑布局
            gridIcon.style.display = 'none';
            listIcon.style.display = 'block';
            this.toggleLayoutBtn.title = '切换到紧凑布局';
            this.toggleLayoutBtn.classList.add('active');
        }
    }

    // 保存布局偏好
    saveLayoutPreference() {
        try {
            localStorage.setItem('sikongai-preset-layout', this.layoutMode);
        } catch (error) {
            console.error('保存布局设置失败:', error);
        }
    }

    // 设置右键菜单事件
    setupContextMenuEvents() {
        if (!this.contextMenu) return;

        // 编辑预设
        const editItem = document.getElementById('context-edit-preset');
        if (editItem) {
            editItem.addEventListener('click', () => {
                if (this.contextTargetPresetId) {
                    this.openModal('edit', this.contextTargetPresetId);
                    this.hideContextMenu();
                }
            });
        }

        // 激活预设
        const activateItem = document.getElementById('context-activate-preset');
        if (activateItem) {
            activateItem.addEventListener('click', () => {
                if (this.contextTargetPresetId) {
                    this.activatePreset(this.contextTargetPresetId);
                    this.hideContextMenu();
                }
            });
        }

        // 激活预设并新建会话
        const activateNewSessionItem = document.getElementById('context-activate-preset-new-session');
        if (activateNewSessionItem) {
            activateNewSessionItem.addEventListener('click', () => {
                if (this.contextTargetPresetId) {
                    this.activatePresetAndCreateNewSession(this.contextTargetPresetId);
                    this.hideContextMenu();
                }
            });
        }

        // 删除预设
        const deleteItem = document.getElementById('context-delete-preset');
        if (deleteItem) {
            deleteItem.addEventListener('click', () => {
                if (this.contextTargetPresetId) {
                    this.deletePreset(this.contextTargetPresetId);
                    this.hideContextMenu();
                }
            });
        }
    }

    // 显示右键菜单
    showContextMenu(x, y, presetId) {
        if (!this.contextMenu) return;

        this.contextTargetPresetId = presetId;
        
        // 设置菜单位置
        this.contextMenu.style.left = x + 'px';
        this.contextMenu.style.top = y + 'px';
        this.contextMenu.style.display = 'block';

        // 确保菜单不超出视窗
        const rect = this.contextMenu.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        if (rect.right > windowWidth) {
            this.contextMenu.style.left = (windowWidth - rect.width - 10) + 'px';
        }
        if (rect.bottom > windowHeight) {
            this.contextMenu.style.top = (windowHeight - rect.height - 10) + 'px';
        }

        // 更新菜单项状态
        this.updateContextMenuItems(presetId);
    }

    // 隐藏右键菜单
    hideContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.style.display = 'none';
            this.contextTargetPresetId = null;
        }
    }

    // 更新右键菜单项状态
    updateContextMenuItems(presetId) {
        const activateItem = document.getElementById('context-activate-preset');
        const activateNewSessionItem = document.getElementById('context-activate-preset-new-session');
        
        const isActive = this.currentPresetId === presetId;
        
        if (activateItem) {
            activateItem.style.display = isActive ? 'none' : 'flex';
        }
        
        if (activateNewSessionItem) {
            // 新建会话选项始终显示，无论当前预设是否激活
            activateNewSessionItem.style.display = 'flex';
        }
    }

    // 获取API密钥的显示文本
    getApiKeyDisplayText(apiKey) {
        if (!apiKey) return '未设置';
        
        // 尝试从API密钥下拉菜单中找到对应的显示文本
        const apiKeySelect = document.getElementById('quick-api-key');
        if (apiKeySelect) {
            const option = Array.from(apiKeySelect.options).find(opt => opt.value === apiKey);
            if (option && option.textContent && option.textContent !== '默认') {
                return option.textContent;
            }
        }
        
        // 如果找不到下拉菜单选项，使用默认的掩码显示方式
        if (apiKey.startsWith('sk-') && apiKey.length > 10) {
            return `${apiKey.substring(0, 10)}...`;
        } else if (apiKey.length > 8) {
            return `${apiKey.substring(0, 4)}...${apiKey.slice(-4)}`;
        } else {
            return '****';
        }
    }

    // 获取供应商显示名称
    getProviderDisplayName(url) {
        if (!url) return '未设置';
        
        // 尝试从供应商下拉菜单中找到对应的显示文本
        const providerSelect = document.getElementById('quick-provider');
        if (providerSelect) {
            const option = Array.from(providerSelect.options).find(opt => opt.value === url);
            if (option && option.textContent && option.textContent !== '默认') {
                return option.textContent;
            }
        }
        
        // 如果找不到下拉菜单选项，使用URL生成显示名称
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

    // 打开弹窗
    openModal(mode = 'add', presetId = null) {
        this.isEditMode = mode === 'edit';
        this.editingPresetId = presetId;

        // 设置弹窗标题
        this.presetModalTitle.textContent = this.isEditMode ? '编辑预设' : '新增预设';

        // 初始化表单选项（从快捷设置获取最新数据）
        this.initializePresetFormOptions();

        // 重置表单
        this.resetForm();

        // 如果是编辑模式，填充表单数据
        if (this.isEditMode && presetId) {
            this.populateForm(presetId);
        }

        // 显示弹窗
        this.presetModal.classList.add('show');
        
        // 聚焦到预设名称输入框
        setTimeout(() => {
            const nameInput = document.getElementById('preset-name');
            if (nameInput) nameInput.focus();
        }, 300);
    }

    // 关闭弹窗
    closeModal() {
        this.presetModal.classList.remove('show');
        this.isEditMode = false;
        this.editingPresetId = null;
        
        // 延迟重置表单，等待动画完成
        setTimeout(() => {
            this.resetForm();
        }, 300);
    }

    // 重置表单
    resetForm() {
        this.presetForm.reset();
        this.temperatureValue.textContent = '0.7';
    }

    // 填充表单数据（编辑模式）
    populateForm(presetId) {
        const preset = this.presets.find(p => p.id === presetId);
        if (!preset) return;

        document.getElementById('preset-name').value = preset.name;
        document.getElementById('preset-provider').value = preset.provider;
        document.getElementById('preset-api-key').value = preset.apiKey;
        document.getElementById('preset-model').value = preset.model;
        document.getElementById('preset-system-prompt').value = preset.systemPrompt;
        document.getElementById('preset-temperature').value = preset.temperature;
        document.getElementById('preset-temperature-value').textContent = preset.temperature;
    }

    // 保存预设
    savePreset() {
        const formData = new FormData(this.presetForm);
        const presetData = {
            name: formData.get('name').trim(),
            provider: formData.get('provider'),
            apiKey: formData.get('apiKey').trim(),
            model: formData.get('model'),
            systemPrompt: formData.get('systemPrompt'),
            temperature: parseFloat(formData.get('temperature'))
        };

        // 验证数据
        if (!this.validatePresetData(presetData)) {
            return;
        }

        if (this.isEditMode) {
            // 更新现有预设
            this.updatePreset(this.editingPresetId, presetData);
        } else {
            // 创建新预设
            this.createPreset(presetData);
        }

        // 保存到localStorage
        this.savePresets();

        // 重新渲染列表
        this.renderPresets();

        // 关闭弹窗
        this.closeModal();

        // 显示成功消息
        this.showNotification(
            this.isEditMode ? '预设更新成功！' : '预设创建成功！', 
            'success'
        );
    }

    // 验证预设数据
    validatePresetData(data) {
        if (!data.name) {
            this.showNotification('请输入预设名称', 'error');
            return false;
        }

        if (!data.provider) {
            this.showNotification('请选择供应商', 'error');
            return false;
        }

        if (!data.apiKey) {
            this.showNotification('请输入API密钥', 'error');
            return false;
        }

        if (!data.model) {
            this.showNotification('请选择模型', 'error');
            return false;
        }

        // 检查预设名称是否重复（编辑时排除当前预设）
        const existingPreset = this.presets.find(p => 
            p.name === data.name && p.id !== this.editingPresetId
        );
        if (existingPreset) {
            this.showNotification('预设名称已存在', 'error');
            return false;
        }

        return true;
    }

    // 创建新预设
    createPreset(data) {
        const preset = {
            id: this.generateId(),
            ...data,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        console.log('=== 创建新预设 ===');
        console.log('创建前预设数量:', this.presets.length);
        this.presets.push(preset);
        console.log('创建后预设数量:', this.presets.length);
        console.log('新创建的预设:', preset);
        console.log('当前所有预设:', this.presets);
    }

    // 更新预设
    updatePreset(presetId, data) {
        const index = this.presets.findIndex(p => p.id === presetId);
        if (index === -1) return;

        this.presets[index] = {
            ...this.presets[index],
            ...data,
            updatedAt: new Date().toISOString()
        };

        console.log('更新预设:', this.presets[index]);
    }

    // 删除预设
    deletePreset(presetId) {
        if (!confirm('确定要删除这个预设吗？')) {
            return;
        }

        const index = this.presets.findIndex(p => p.id === presetId);
        if (index === -1) return;

        // 如果删除的是当前激活的预设，清除激活状态
        if (this.currentPresetId === presetId) {
            this.currentPresetId = null;
        }

        this.presets.splice(index, 1);
        this.savePresets();
        this.renderPresets();

        this.showNotification('预设删除成功！', 'success');
    }

    // 激活预设
    activatePreset(presetId) {
        const preset = this.presets.find(p => p.id === presetId);
        if (!preset) return;

        this.currentPresetId = presetId;
        
        // 更新UI状态
        this.renderPresets();

        // 应用预设参数到聊天系统
        this.applyPresetToChat(preset);

        this.showNotification(`已切换到预设：${preset.name}`, 'success');
    }

    // 激活预设并新建会话
    activatePresetAndCreateNewSession(presetId) {
        const preset = this.presets.find(p => p.id === presetId);
        if (!preset) return;

        console.log('Ctrl+点击预设，切换预设并新建会话:', preset.name);

        // 首先激活预设
        this.currentPresetId = presetId;
        
        // 更新UI状态
        this.renderPresets();

        // 应用预设参数到聊天系统
        this.applyPresetToChat(preset);

        // 新建会话
        if (window.chatManager && typeof window.chatManager.createNewConversation === 'function') {
            window.chatManager.createNewConversation();
            this.showNotification(`已切换到预设"${preset.name}"并创建新会话`, 'success');
        } else {
            console.warn('聊天管理器不可用，无法创建新会话');
            this.showNotification(`已切换到预设"${preset.name}"，但无法创建新会话`, 'warning');
        }
    }

    // 应用预设到聊天系统
    applyPresetToChat(preset) {
        // 这里需要与聊天系统集成，应用预设参数
        console.log('应用预设到聊天系统:', preset);
        
        // 将预设参数传递给聊天管理器
        if (window.chatManager && typeof window.chatManager.applyPresetSettings === 'function') {
            window.chatManager.applyPresetSettings({
                provider: preset.provider,
                apiKey: preset.apiKey,
                model: preset.model,
                systemPrompt: preset.systemPrompt,
                temperature: preset.temperature
            });
        }

        // 也可以临时存储当前预设信息，供API调用时使用
        this.storeCurrentPreset(preset);
    }

    // 存储当前预设信息
    storeCurrentPreset(preset) {
        try {
            const currentPreset = {
                id: preset.id,
                name: preset.name,
                provider: preset.provider,
                apiKey: preset.apiKey,
                model: preset.model,
                systemPrompt: preset.systemPrompt,
                temperature: preset.temperature,
                appliedAt: new Date().toISOString()
            };
            
            localStorage.setItem('sikongai-current-preset', JSON.stringify(currentPreset));
            console.log('当前预设已存储:', currentPreset);
        } catch (error) {
            console.error('存储当前预设失败:', error);
        }
    }

    // 获取当前预设
    getCurrentPreset() {
        try {
            const saved = localStorage.getItem('sikongai-current-preset');
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('获取当前预设失败:', error);
            return null;
        }
    }

    // 渲染预设列表
    renderPresets() {
        if (!this.presetsContainer) return;

        // 清空容器
        this.presetsContainer.innerHTML = '';

        if (this.presets.length === 0) {
            // 显示占位符
            this.presetsContainer.innerHTML = `
                <div class="preset-placeholder">
                    <div class="preset-placeholder-icon">⚙️</div>
                    <p>暂无预设</p>
                    <p class="preset-placeholder-tip">点击上方 + 按钮添加预设</p>
                </div>
            `;
            return;
        }

        // 渲染预设项
        this.presets.forEach(preset => {
            const presetElement = this.createPresetElement(preset);
            this.presetsContainer.appendChild(presetElement);
        });
    }

    // 创建预设元素
    createPresetElement(preset) {
        const div = document.createElement('div');
        div.className = `preset-item ${this.currentPresetId === preset.id ? 'active' : ''}`;
        div.dataset.presetId = preset.id;
        div.title = `点击切换预设，Ctrl+点击切换预设并新建会话`;

        // 获取API密钥的显示文本
        const maskedApiKey = this.getApiKeyDisplayText(preset.apiKey);

        // 截取系统提示词显示
        const promptDisplay = preset.systemPrompt 
            ? (preset.systemPrompt.length > 20 
                ? preset.systemPrompt.substring(0, 20) + '...' 
                : preset.systemPrompt)
            : '无';

        div.innerHTML = `
            <div class="preset-item-header">
                <h4 class="preset-item-name">${preset.name}</h4>
                <div class="preset-item-actions">
                    <button class="preset-action-btn edit" title="编辑">
                        <svg width="12" height="12" viewBox="0 0 12 12">
                            <path d="M8.5 1L11 3.5 4 10.5H1.5V8L8.5 1Z" stroke="currentColor" fill="none"/>
                        </svg>
                    </button>
                    <button class="preset-action-btn delete" title="删除">
                        <svg width="12" height="12" viewBox="0 0 12 12">
                            <path d="M2 3h8M4 3V1h4v2M5 5v4M7 5v4M3 3v7a1 1 0 001 1h4a1 1 0 001-1V3" stroke="currentColor" fill="none"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="preset-item-details">
                <div class="preset-detail-row">
                    <span class="preset-detail-label">供应商:</span>
                    <span class="preset-detail-value">${this.getProviderDisplayName(preset.provider)}</span>
                </div>
                <div class="preset-detail-row">
                    <span class="preset-detail-label">密钥:</span>
                    <span class="preset-detail-value">${maskedApiKey}</span>
                </div>
                <div class="preset-detail-row">
                    <span class="preset-detail-label">模型:</span>
                    <span class="preset-detail-value">${preset.model}</span>
                </div>
                <div class="preset-detail-row">
                    <span class="preset-detail-label">提示词:</span>
                    <span class="preset-detail-value">${promptDisplay}</span>
                </div>
                <div class="preset-detail-row">
                    <span class="preset-detail-label">温度:</span>
                    <span class="preset-detail-value">${preset.temperature}</span>
                </div>
            </div>
        `;

        // 添加事件监听器
        this.setupPresetItemListeners(div, preset);

        return div;
    }

    // 设置预设项事件监听器
    setupPresetItemListeners(element, preset) {
        // 点击预设项激活
        element.addEventListener('click', (e) => {
            // 如果点击的是操作按钮，不触发激活
            if (e.target.closest('.preset-action-btn')) {
                return;
            }
            
            // 检查是否按住了Ctrl键
            if (e.ctrlKey) {
                // Ctrl+点击：切换预设并新建会话
                this.activatePresetAndCreateNewSession(preset.id);
            } else {
                // 普通点击：只切换预设
                this.activatePreset(preset.id);
            }
        });

        // 右键菜单
        element.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e.clientX, e.clientY, preset.id);
        });

        // 编辑按钮（仅在正常布局下可见）
        const editBtn = element.querySelector('.preset-action-btn.edit');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openModal('edit', preset.id);
            });
        }

        // 删除按钮（仅在正常布局下可见）
        const deleteBtn = element.querySelector('.preset-action-btn.delete');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deletePreset(preset.id);
            });
        }
    }

    // 加载预设数据
    loadPresets() {
        try {
            console.log('=== 加载预设数据 ===');
            const saved = localStorage.getItem('sikongai-presets');
            console.log('localStorage中的原始数据:', saved);
            
            if (saved) {
                let data;
                try {
                    data = JSON.parse(saved);
                } catch (parseError) {
                    console.error('解析预设数据失败:', parseError);
                    this.presets = [];
                    return;
                }
                
                // 兼容新旧数据格式
                if (Array.isArray(data)) {
                    // 旧格式：直接是预设数组
                    console.log('检测到旧格式数据，进行兼容处理');
                    this.presets = data;
                    
                    // 自动升级到新格式并保存
                    console.log('自动升级数据格式...');
                    setTimeout(() => {
                        this.savePresets();
                        console.log('数据格式升级完成');
                    }, 1000);
                    
                } else if (data.presets && Array.isArray(data.presets)) {
                    // 新格式：包含版本信息的对象
                    console.log('检测到新格式数据');
                    console.log('数据版本:', data.version);
                    console.log('最后更新时间:', data.lastUpdated);
                    this.presets = data.presets;
                } else {
                    console.error('未知的预设数据格式:', data);
                    
                    // 尝试从备份恢复
                    const recovered = this.attemptDataRecovery();
                    if (recovered) {
                        console.log('从备份恢复数据成功，重新加载...');
                        this.loadPresets();
                        return;
                    } else {
                        console.log('无法恢复数据，使用空数组');
                        this.presets = [];
                        return;
                    }
                }
                
                console.log('成功加载预设数据，数量:', this.presets.length);
                console.log('预设列表:', this.presets);
            } else {
                console.log('localStorage中没有找到预设数据');
                this.presets = [];
            }

            // 恢复当前激活的预设
            const currentPreset = this.getCurrentPreset();
            if (currentPreset) {
                this.currentPresetId = currentPreset.id;
                console.log('恢复当前预设:', currentPreset.name);
            } else {
                console.log('没有找到当前激活的预设');
            }
        } catch (error) {
            console.error('加载预设数据失败:', error);
            this.presets = [];
        }
    }

    // 保存预设数据
    savePresets() {
        try {
            console.log('=== 保存预设数据 ===');
            console.log('当前预设数量:', this.presets.length);
            console.log('预设列表:', this.presets);
            
            // 添加时间戳以便追踪
            const dataToSave = {
                presets: this.presets,
                lastUpdated: new Date().toISOString(),
                version: '1.0'
            };
            
            // 多重保存机制
            const jsonData = JSON.stringify(dataToSave);
            
            // 1. 主要存储
            localStorage.setItem('sikongai-presets', jsonData);
            
            // 2. 备份存储
            localStorage.setItem('sikongai-presets-backup', jsonData);
            
            // 3. 带时间戳的备份
            const timestamp = Date.now();
            localStorage.setItem(`sikongai-presets-backup-${timestamp}`, jsonData);
            
            // 清理旧的时间戳备份（只保留最近3个）
            this.cleanupOldBackups();
            
            // 验证所有存储是否成功
            const mainSaved = localStorage.getItem('sikongai-presets');
            const backupSaved = localStorage.getItem('sikongai-presets-backup');
            
            if (mainSaved && backupSaved) {
                const mainParsed = JSON.parse(mainSaved);
                const backupParsed = JSON.parse(backupSaved);
                
                console.log('保存验证 - 主存储中的预设数量:', mainParsed.presets ? mainParsed.presets.length : 'N/A');
                console.log('保存验证 - 备份存储中的预设数量:', backupParsed.presets ? backupParsed.presets.length : 'N/A');
                console.log('保存时间:', mainParsed.lastUpdated);
                console.log('预设数据已成功保存到localStorage（含备份）');
                
                // 立即同步到所有可能的实例
                this.syncToAllInstances();
                
                // 设置保存成功标记
                this.lastSaveTime = Date.now();
                localStorage.setItem('sikongai-presets-last-save', this.lastSaveTime.toString());
                
            } else {
                throw new Error('保存验证失败：数据未正确写入localStorage');
            }
            
        } catch (error) {
            console.error('保存预设数据失败:', error);
            // 尝试恢复机制
            this.attemptDataRecovery();
        }
    }

    // 生成唯一ID
    generateId() {
        return 'preset_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // 显示通知
    showNotification(message, type = 'info') {
        if (window.sikongAI && typeof window.sikongAI.showNotification === 'function') {
            window.sikongAI.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    // 导出预设
    exportPresets() {
        if (this.presets.length === 0) {
            this.showNotification('没有预设可以导出', 'warning');
            return;
        }

        try {
            const exportData = {
                version: '1.0',
                timestamp: new Date().toISOString(),
                presets: this.presets.map(preset => ({
                    ...preset,
                    // 出于安全考虑，导出时不包含完整的API密钥
                    apiKey: '*** HIDDEN ***'
                }))
            };

            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `sikongai-presets-${Date.now()}.json`;
            link.click();
            
            URL.revokeObjectURL(url);
            this.showNotification('预设导出成功！', 'success');
        } catch (error) {
            console.error('导出预设失败:', error);
            this.showNotification('导出预设失败', 'error');
        }
    }

    // 导入预设
    importPresets(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importData = JSON.parse(e.target.result);
                
                if (!importData.presets || !Array.isArray(importData.presets)) {
                    throw new Error('无效的预设文件格式');
                }

                let importCount = 0;
                importData.presets.forEach(presetData => {
                    // 检查必要字段
                    if (presetData.name && presetData.provider && presetData.model) {
                        // 生成新的ID避免冲突
                        const preset = {
                            ...presetData,
                            id: this.generateId(),
                            apiKey: '', // 需要用户重新输入
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        };
                        
                        this.presets.push(preset);
                        importCount++;
                    }
                });

                if (importCount > 0) {
                    this.savePresets();
                    this.renderPresets();
                    this.showNotification(`成功导入 ${importCount} 个预设！请重新设置API密钥。`, 'success');
                } else {
                    this.showNotification('没有有效的预设可以导入', 'warning');
                }
            } catch (error) {
                console.error('导入预设失败:', error);
                this.showNotification('导入预设失败，请检查文件格式', 'error');
            }
        };
        
        reader.readAsText(file);
    }

    // 获取预设数量
    getPresetCount() {
        return this.presets.length;
    }

    // 获取当前激活预设的详情
    getCurrentPresetDetails() {
        if (!this.currentPresetId) return null;
        return this.presets.find(p => p.id === this.currentPresetId);
    }

    // 调试工具：清除所有预设
    debugClearAllPresets() {
        if (confirm('确定要清除所有预设吗？此操作不可恢复！')) {
            this.presets = [];
            this.currentPresetId = null;
            this.savePresets();
            localStorage.removeItem('sikongai-current-preset');
            this.renderPresets();
            this.showNotification('所有预设已清除', 'success');
        }
    }

    // 调试工具：检查localStorage状态
    debugCheckStorage() {
        console.log('=== localStorage调试信息 ===');
        
        // 检查预设数据
        const presetData = localStorage.getItem('sikongai-presets');
        console.log('localStorage中的预设数据:', presetData);
        
        if (presetData) {
            try {
                const parsed = JSON.parse(presetData);
                console.log('解析后的预设数量:', parsed.length);
                console.log('解析后的预设列表:', parsed);
            } catch (error) {
                console.error('解析预设数据失败:', error);
            }
        } else {
            console.log('localStorage中没有预设数据');
        }
        
        // 检查当前预设
        const currentPreset = localStorage.getItem('sikongai-current-preset');
        console.log('当前激活预设:', currentPreset);
        
        // 检查内存中的预设
        console.log('内存中的预设数量:', this.presets.length);
        console.log('内存中的预设列表:', this.presets);
        
        // 检查其他相关的localStorage项
        console.log('所有localStorage项:');
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.includes('sikong') || key.includes('preset')) {
                console.log(`${key}:`, localStorage.getItem(key));
            }
        }
        
        console.log('=== 调试信息结束 ===');
    }

    // 调试工具：强制重新加载预设
    debugReloadPresets() {
        console.log('=== 强制重新加载预设 ===');
        this.loadPresets();
        this.renderPresets();
        console.log('预设重新加载完成');
    }

    // 调试工具：数据完整性报告
    debugDataIntegrityReport() {
        console.log('=== 数据完整性报告 ===');
        
        const verification = this.verifyDataIntegrity();
        console.log('完整性验证结果:', verification);
        
        // 显示所有相关的localStorage项
        console.log('localStorage中的预设相关项:');
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.includes('preset') || key.includes('sikongai'))) {
                const value = localStorage.getItem(key);
                console.log(`${key}:`, value.length > 200 ? `${value.substring(0, 200)}...` : value);
            }
        }
        
        console.log('内存中预设数量:', this.presets.length);
        console.log('内存中预设列表:', this.presets);
        
        console.log('=== 报告结束 ===');
    }

    // 调试工具：修复数据不一致
    debugFixDataInconsistency() {
        console.log('=== 修复数据不一致 ===');
        
        const verification = this.verifyDataIntegrity();
        if (verification.success) {
            console.log('数据一致性良好，无需修复');
            return;
        }
        
        console.log('检测到数据不一致，尝试修复...');
        console.log('问题:', verification.reason);
        
        // 强制保存当前内存数据
        this.forceSave();
        
        // 再次验证
        const newVerification = this.verifyDataIntegrity();
        if (newVerification.success) {
            console.log('数据修复成功！');
        } else {
            console.error('数据修复失败:', newVerification.reason);
        }
    }

    // 清理旧的备份数据
    cleanupOldBackups() {
        try {
            const backupKeys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('sikongai-presets-backup-')) {
                    const timestamp = parseInt(key.replace('sikongai-presets-backup-', ''));
                    if (!isNaN(timestamp)) {
                        backupKeys.push({ key, timestamp });
                    }
                }
            }
            
            // 按时间戳排序，只保留最近的3个
            backupKeys.sort((a, b) => b.timestamp - a.timestamp);
            const toDelete = backupKeys.slice(3);
            
            toDelete.forEach(backup => {
                localStorage.removeItem(backup.key);
                console.log('清理旧备份:', backup.key);
            });
            
        } catch (error) {
            console.error('清理备份数据失败:', error);
        }
    }

    // 数据恢复机制
    attemptDataRecovery() {
        console.log('=== 尝试数据恢复 ===');
        
        try {
            // 尝试从备份恢复
            const backup = localStorage.getItem('sikongai-presets-backup');
            if (backup) {
                console.log('从备份存储恢复数据');
                localStorage.setItem('sikongai-presets', backup);
                return true;
            }
            
            // 尝试从时间戳备份恢复
            const backupKeys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('sikongai-presets-backup-')) {
                    const timestamp = parseInt(key.replace('sikongai-presets-backup-', ''));
                    if (!isNaN(timestamp)) {
                        backupKeys.push({ key, timestamp });
                    }
                }
            }
            
            if (backupKeys.length > 0) {
                // 使用最新的备份
                backupKeys.sort((a, b) => b.timestamp - a.timestamp);
                const latestBackup = localStorage.getItem(backupKeys[0].key);
                if (latestBackup) {
                    console.log('从时间戳备份恢复数据:', backupKeys[0].key);
                    localStorage.setItem('sikongai-presets', latestBackup);
                    localStorage.setItem('sikongai-presets-backup', latestBackup);
                    return true;
                }
            }
            
            console.log('没有可用的备份数据');
            return false;
            
        } catch (error) {
            console.error('数据恢复失败:', error);
            return false;
        }
    }

    // 强制保存当前数据
    forceSave() {
        console.log('=== 强制保存当前数据 ===');
        
        // 备份当前内存中的数据
        const currentData = [...this.presets];
        
        // 清理可能损坏的存储
        localStorage.removeItem('sikongai-presets');
        localStorage.removeItem('sikongai-presets-backup');
        
        // 重新保存
        this.savePresets();
        
        // 验证保存结果
        const verification = this.verifyDataIntegrity();
        if (!verification.success) {
            console.error('强制保存失败，数据可能丢失');
            // 尝试最后的恢复措施
            this.presets = currentData;
            setTimeout(() => this.savePresets(), 1000);
        } else {
            console.log('强制保存成功');
        }
    }

    // 验证数据完整性
    verifyDataIntegrity() {
        try {
            const mainData = localStorage.getItem('sikongai-presets');
            const backupData = localStorage.getItem('sikongai-presets-backup');
            
            if (!mainData || !backupData) {
                return { success: false, reason: '主存储或备份存储缺失' };
            }
            
            const mainParsed = JSON.parse(mainData);
            const backupParsed = JSON.parse(backupData);
            
            const mainPresets = mainParsed.presets || [];
            const backupPresets = backupParsed.presets || [];
            const memoryPresets = this.presets || [];
            
            if (mainPresets.length !== memoryPresets.length) {
                return { success: false, reason: `主存储预设数量(${mainPresets.length})与内存不符(${memoryPresets.length})` };
            }
            
            if (backupPresets.length !== memoryPresets.length) {
                return { success: false, reason: `备份存储预设数量(${backupPresets.length})与内存不符(${memoryPresets.length})` };
            }
            
            return { success: true, mainCount: mainPresets.length, backupCount: backupPresets.length, memoryCount: memoryPresets.length };
            
        } catch (error) {
            return { success: false, reason: `验证过程出错: ${error.message}` };
        }
    }

    // 同步到所有实例
    syncToAllInstances() {
        try {
            // 设置一个全局事件来通知其他可能的实例
            const event = new CustomEvent('presetDataUpdated', {
                detail: {
                    presets: [...this.presets],
                    timestamp: new Date().toISOString()
                }
            });
            window.dispatchEvent(event);
            console.log('已发送预设数据同步事件');
        } catch (error) {
            console.error('同步数据到其他实例失败:', error);
        }
    }

    // 监听其他实例的数据更新
    setupCrossInstanceSync() {
        window.addEventListener('presetDataUpdated', (event) => {
            console.log('收到其他实例的预设数据更新事件');
            if (event.detail && event.detail.presets) {
                // 检查数据是否比当前新
                if (event.detail.presets.length !== this.presets.length) {
                    console.log('检测到预设数据变化，同步更新');
                    this.presets = [...event.detail.presets];
                    this.renderPresets();
                }
            }
        });
    }

    // 检查数据完整性
    validateDataIntegrity() {
        try {
            const saved = localStorage.getItem('sikongai-presets');
            if (saved) {
                const data = JSON.parse(saved);
                const savedPresets = Array.isArray(data) ? data : (data.presets || []);
                
                if (savedPresets.length !== this.presets.length) {
                    console.warn('检测到内存与localStorage数据不同步！');
                    console.warn('内存中预设数量:', this.presets.length);
                    console.warn('localStorage中预设数量:', savedPresets.length);
                    
                    // 使用数量更多的那个
                    if (savedPresets.length > this.presets.length) {
                        console.log('使用localStorage中的数据（数量更多）');
                        this.presets = savedPresets;
                        this.renderPresets();
                    } else {
                        console.log('保存内存中的数据到localStorage（数量更多）');
                        this.savePresets();
                    }
                    return false;
                }
            }
            return true;
        } catch (error) {
            console.error('数据完整性检查失败:', error);
            return false;
        }
    }
}

// 创建全局实例（增强的单例模式）
if (!window.presetManager) {
    console.log('创建PresetManager全局实例');
    window.presetManager = new PresetManager();
    
    // 设置定期数据完整性检查
    setInterval(() => {
        if (window.presetManager) {
            window.presetManager.validateDataIntegrity();
        }
    }, 10000); // 每10秒检查一次
} else {
    console.log('PresetManager实例已存在，检查数据同步状态');
    // 强制重新加载以确保数据同步
    if (window.presetManager.loadPresets) {
        window.presetManager.loadPresets();
        window.presetManager.renderPresets();
    }
}