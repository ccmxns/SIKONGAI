// 设置管理器
class SettingsManager {
    constructor() {
        this.defaultSettings = {
            // 注：API和模型配置已移除，现在完全依赖会话面板的快捷设置
            
            // 性能优化
            concurrentRequests: 20,
            requestTimeout: 180,
            retryAttempts: 2,
            autoSave: true,

            windowOpacity: 100,
            windowBlur: false,
            blurIntensity: 5,
            autoScrollToBottom: true, // 自动滚动到底部
            alwaysOnTop: false, // 窗口置顶状态
            quickOpacityEnabled: false, // 快捷透明度开关
            systemTray: true, // 系统托盘图标
            autoStart: false, // 开机自动启动
            silentStart: true, // 静默启动（仅托盘）
            
            // 全局快捷键设置
            hotkeyToggle: '', // 显示/隐藏窗口
            hotkeyShow: '',   // 显示窗口
            hotkeyHide: '',   // 隐藏窗口
            
            // 快捷空间设置
            providerUrls: ['https://api.openai.com', 'https://yunwu.ai'],
            apiKeys: [],
            modelNames: ['gpt-3.5-turbo', 'gpt-4'],
            currentBaseUrl: 'https://api.openai.com',
            currentApiKey: '',
            currentModel: 'gpt-3.5-turbo',
            
            // 系统提示词设置
            systemPrompts: {}, // 用户自定义的系统提示词
            hiddenPresetPrompts: [], // 用户隐藏的预设提示词
            
            // 主题设置
            themeMode: 'auto', // 'auto', 'light', 'dark'
            manualThemeOverride: false // 是否手动覆盖系统主题
        };
        
        this.settings = { ...this.defaultSettings };
        this.init();
    }

    init() {
        this.loadSettings();
        this.setupEventListeners();
        this.setupTabSwitching();
        this.updateUI();
        // 初始化窗口透明度
        this.initializeWindowOpacity();
        // 初始化窗口模糊效果
        this.initializeWindowBlur();
        // 初始化系统托盘
        this.initializeSystemTray();
        // 初始化快捷键
        this.initializeHotkeys();
        // 初始化开机启动
        this.initializeAutoStart();
        
        // 通知主应用重新初始化主题
        this.notifyThemeReady();
        
        console.log('设置管理器已初始化');
    }

    setupEventListeners() {
        // 返回按钮
        const backBtn = document.getElementById('back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.goBackToChat();
            });
        }

        // 保存按钮
        const saveBtn = document.getElementById('save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveSettings();
            });
        }

        // 重置按钮
        const resetBtn = document.getElementById('reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetToDefault();
            });
        }

        // 注：API和模型配置已移除，现在完全依赖会话面板的快捷设置

        // 并发数滑块
        const concurrentSlider = document.getElementById('concurrent-requests');
        if (concurrentSlider) {
            concurrentSlider.addEventListener('input', (e) => {
                this.updateSliderValue('concurrent-requests', e.target.value);
                // 立即通知API管理器更新设置
                if (window.apiManager) {
                    window.apiManager.loadSettings();
                    console.log('并发请求数已更新为:', e.target.value);
                }
            });
        }

        // 窗口透明度滑块
        const opacitySlider = document.getElementById('window-opacity');
        if (opacitySlider) {
            opacitySlider.addEventListener('input', (e) => {
                this.updateSliderValue('window-opacity', e.target.value);
                // 立即应用透明度
                this.applyWindowOpacity(e.target.value);
                // 自动更新模糊设置显示状态
                this.updateBlurControlsVisibility();
            });
        }

        // 窗口模糊开关
        const blurCheckbox = document.getElementById('window-blur');
        if (blurCheckbox) {
            blurCheckbox.addEventListener('change', (e) => {
                this.settings.windowBlur = e.target.checked;
                this.saveSettings();
                this.updateBlurControlsVisibility();
                this.applyWindowBlur();
            });
        }

        // 模糊强度滑块
        const blurIntensitySlider = document.getElementById('blur-intensity');
        if (blurIntensitySlider) {
            blurIntensitySlider.addEventListener('input', (e) => {
                this.updateSliderValue('blur-intensity', e.target.value);
                this.settings.blurIntensity = parseInt(e.target.value);
                this.saveSettings();
                this.applyWindowBlur();
            });
        }

        // 系统托盘开关
        const systemTrayCheckbox = document.getElementById('system-tray');
        if (systemTrayCheckbox) {
            systemTrayCheckbox.addEventListener('change', (e) => {
                this.settings.systemTray = e.target.checked;
                this.saveSettings();
                this.updateSystemTray(e.target.checked);
            });
        }

        // 开机启动设置
        this.setupAutoStartSettings();

        // 快捷键设置
        this.setupHotkeyInputs();

        // 边栏快捷键设置
        this.setupSidebarHotkeyInputs();

        // 实时保存输入变化
        this.setupRealTimeUpdates();
    }

    setupTabSwitching() {
        const navItems = document.querySelectorAll('.nav-item');
        const panels = document.querySelectorAll('.settings-panel');

        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const targetTab = item.dataset.tab;
                
                // 更新导航状态
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                
                // 显示对应面板
                panels.forEach(panel => panel.classList.remove('active'));
                const targetPanel = document.getElementById(`${targetTab}-panel`);
                if (targetPanel) {
                    targetPanel.classList.add('active');
                }
            });
        });
    }

    setupRealTimeUpdates() {
        // 监听所有输入框和选择框的变化
        const inputs = document.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            if (input.type === 'range') return; // 滑块已单独处理
            
            input.addEventListener('input', () => {
                // 实时更新设置并自动保存
                this.updateSettingFromElement(input);
                this.autoSaveSettings();
            });

            // 对于复选框，也监听 change 事件
            if (input.type === 'checkbox') {
                input.addEventListener('change', () => {
                    this.updateSettingFromElement(input);
                    this.autoSaveSettings();
                });
            }
        });
    }

    updateSettingFromElement(element) {
        const settingMap = {
            'concurrent-requests': 'concurrentRequests',
            'request-timeout': 'requestTimeout',
            'retry-attempts': 'retryAttempts',
            'auto-save': 'autoSave',

            'system-tray': 'systemTray'
        };

        const settingKey = settingMap[element.id];
        if (settingKey) {
            let value = element.value;
            
            // 处理不同类型的值
            if (element.type === 'checkbox') {
                value = element.checked;
            } else if (element.type === 'number' || element.type === 'range') {
                value = parseFloat(value);
            }
            
            this.settings[settingKey] = value;
        }
    }

    // handleModelChange方法已移除，模型配置现在在会话面板处理

    updateSliderValue(sliderId, value) {
        const slider = document.getElementById(sliderId);
        
        // 如果滑块元素不存在（非设置页面），跳过UI更新但仍更新设置值
        if (slider) {
            const valueDisplay = slider.parentNode.querySelector('.slider-value');
            if (valueDisplay) {
                valueDisplay.textContent = value;
            }
        }
        
        // 更新设置
        if (sliderId === 'temperature') {
            this.settings.temperature = parseFloat(value);
        } else if (sliderId === 'concurrent-requests') {
            this.settings.concurrentRequests = parseInt(value);
        } else if (sliderId === 'window-opacity') {
            this.settings.windowOpacity = parseInt(value);
            // 更新显示值为百分比格式
            const valueDisplay = slider?.parentNode.querySelector('.slider-value');
            if (valueDisplay) {
                valueDisplay.textContent = `${value}%`;
            }
        } else if (sliderId === 'blur-intensity') {
            this.settings.blurIntensity = parseInt(value);
        }
        
        // 实时保存滑块设置
        this.autoSaveSettings();
    }

    // toggleApiKeyVisibility方法已移除，API密钥现在在会话面板处理

    updateUI() {
        // 检查是否在设置页面，如果不是则跳过UI更新
        if (!document.getElementById('concurrent-requests')) {
            console.log('非设置页面，跳过UI更新');
            return;
        }
        
        // 更新所有输入框的值（仅保留性能优化相关的）
        const concurrentRequests = document.getElementById('concurrent-requests');
        const requestTimeout = document.getElementById('request-timeout');
        const retryAttempts = document.getElementById('retry-attempts');
        const autoSave = document.getElementById('auto-save');

        const windowOpacity = document.getElementById('window-opacity');
        const windowBlur = document.getElementById('window-blur');
        const blurIntensity = document.getElementById('blur-intensity');
        
        if (concurrentRequests) concurrentRequests.value = this.settings.concurrentRequests;
        if (requestTimeout) requestTimeout.value = this.settings.requestTimeout;
        if (retryAttempts) retryAttempts.value = this.settings.retryAttempts;
        if (autoSave) autoSave.checked = this.settings.autoSave;

        if (windowOpacity) windowOpacity.value = this.settings.windowOpacity;
        if (windowBlur) windowBlur.checked = this.settings.windowBlur;
        if (blurIntensity) blurIntensity.value = this.settings.blurIntensity;

        // 更新滑块显示值
        this.updateSliderValue('temperature', this.settings.temperature);
        this.updateSliderValue('concurrent-requests', this.settings.concurrentRequests);
        this.updateSliderValue('window-opacity', this.settings.windowOpacity);
        this.updateSliderValue('blur-intensity', this.settings.blurIntensity);
        
        // 确保滑块的value属性也被更新
        const concurrentSlider = document.getElementById('concurrent-requests');
        if (concurrentSlider) {
            concurrentSlider.value = this.settings.concurrentRequests;
            console.log('UI同步: 并发请求数滑块值已设置为', this.settings.concurrentRequests);
        }

        const opacitySlider = document.getElementById('window-opacity');
        if (opacitySlider) {
            opacitySlider.value = this.settings.windowOpacity;
            console.log('UI同步: 窗口透明度滑块值已设置为', this.settings.windowOpacity);
        }

        // 自定义模型处理已移除，现在在会话面板处理

        // 更新技术信息
        this.updateTechInfo();
    }

    updateTechInfo() {
        const nodeVersionElement = document.getElementById('node-version');
        if (nodeVersionElement && window.electronAPI) {
            // 这里可以通过 IPC 获取 Node.js 版本信息
            nodeVersionElement.textContent = 'v18.0.0'; // 示例版本
        }
        
        // 调试：在控制台显示当前设置
        console.log('当前设置管理器中的并发请求数:', this.settings.concurrentRequests);
        console.log('localStorage中的设置:', localStorage.getItem('sikongai-settings'));
    }

    // 自动保存设置（防抖处理）
    autoSaveSettings() {
        // 清除之前的定时器
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }

        // 设置新的定时器，500ms后保存（防抖）
        this.autoSaveTimer = setTimeout(() => {
            try {
                localStorage.setItem('sikongai-settings', JSON.stringify(this.settings));
                console.log('设置已自动保存');
                
                // 显示一个简短的保存提示
                this.showAutoSaveIndicator();
            } catch (error) {
                console.error('自动保存设置失败:', error);
            }
        }, 500);
    }

    // 显示自动保存指示器
    showAutoSaveIndicator() {
        // 移除现有的指示器
        const existingIndicator = document.querySelector('.auto-save-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }

        // 创建新的指示器
        const indicator = document.createElement('div');
        indicator.className = 'auto-save-indicator';
        indicator.textContent = '✓ 已自动保存';
        
        // 添加到保存按钮旁边
        const saveBtn = document.getElementById('save-btn');
        if (saveBtn && saveBtn.parentNode) {
            saveBtn.parentNode.insertBefore(indicator, saveBtn);
            
            // 2秒后移除指示器
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.parentNode.removeChild(indicator);
                }
            }, 2000);
        }
    }

    saveSettings() {
        try {
            console.log('正在保存设置到本地存储...');
            console.log('要保存的设置:', this.settings);
            
            // 保存到本地存储
            localStorage.setItem('sikongai-settings', JSON.stringify(this.settings));
            
            // 验证保存是否成功
            const saved = localStorage.getItem('sikongai-settings');
            const parsed = JSON.parse(saved);
            console.log('验证本地存储中的设置:', parsed);
            
            // 立即通知API管理器重新加载设置
            if (window.apiManager) {
                window.apiManager.loadSettings();
                console.log('已通知API管理器重新加载设置');
            }
            
            // 显示成功通知
            this.showNotification('设置已保存', 'success');
            
            console.log('设置保存完成');
        } catch (error) {
            console.error('保存设置失败:', error);
            this.showNotification('保存设置失败', 'error');
        }
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('sikongai-settings');
            if (saved) {
                const parsedSettings = JSON.parse(saved);
                this.settings = { ...this.defaultSettings, ...parsedSettings };
                console.log('从本地存储加载的设置:', parsedSettings);
                console.log('合并后的设置:', this.settings);
            } else {
                console.log('本地存储中没有保存的设置，使用默认设置');
                this.settings = { ...this.defaultSettings };
            }
        } catch (error) {
            console.error('加载设置失败:', error);
            this.settings = { ...this.defaultSettings };
        }
    }

    resetToDefault() {
        if (confirm('确定要重置所有设置到默认值吗？此操作不可撤销。')) {
            this.settings = { ...this.defaultSettings };
            this.updateUI();
            this.saveSettings(); // 确保重置后的设置被保存
            this.showNotification('设置已重置为默认值', 'info');
        }
    }

    // 强制刷新设置（调试用）
    forceRefreshSettings() {
        console.log('强制刷新设置...');
        this.loadSettings();
        this.updateUI();
        if (window.apiManager) {
            window.apiManager.loadSettings();
        }
        console.log('设置已强制刷新');
    }

    goBackToChat() {
        try {
            console.log('正在返回聊天界面...');
            
            // 如果在 Electron 设置窗口中，关闭设置窗口
            if (window.electronAPI && window.electronAPI.closeSettingsWindow) {
                console.log('关闭设置窗口');
                window.electronAPI.closeSettingsWindow();
            } else {
                // 降级方案：如果在浏览器中，关闭标签页或返回主页
                console.warn('Electron API 不可用，使用降级方案');
                
                // 尝试关闭窗口
                if (window.opener) {
                    // 如果是通过 window.open 打开的，关闭当前窗口
                    window.close();
                } else {
                    // 否则导航到主页面
                    window.location.href = 'index.html';
                }
            }
        } catch (error) {
            console.error('返回聊天界面失败:', error);
            
            // 最后的降级方案
            try {
                window.location.href = 'index.html';
            } catch (fallbackError) {
                console.error('所有方案都失败了:', fallbackError);
                this.showNotification('无法返回聊天界面，请手动关闭窗口', 'error');
            }
        }
    }

    showNotification(message, type = 'info') {
        // 使用全局的通知系统
        if (window.sikongAI) {
            window.sikongAI.showNotification(message, type);
        } else {
            // 降级方案
            alert(message);
        }
    }

    // 获取当前设置
    getSettings() {
        return { ...this.settings };
    }

    // 更新特定设置
    updateSetting(key, value) {
        console.log(`更新设置: ${key} =`, value);
        console.log('更新前的设置:', key, this.settings[key]);
        
        // 直接设置，不检查是否存在（因为可能是新增的字段）
        this.settings[key] = value;
        
        console.log('更新后的设置:', key, this.settings[key]);
    }

    // 验证设置
    validateSettings() {
        const errors = [];

        if (!this.settings.baseUrl) {
            errors.push('Base URL 不能为空');
        }

        if (!this.settings.apiKey) {
            errors.push('API Key 不能为空');
        }

        if (this.settings.temperature < 0 || this.settings.temperature > 2) {
            errors.push('温度值必须在 0-2 之间');
        }

        if (this.settings.maxTokens < 1) {
            errors.push('最大令牌数必须大于 0');
        }

        if (this.settings.concurrentRequests < 1) {
            errors.push('并发请求数必须大于 0');
        }

        if (this.settings.windowOpacity < 10 || this.settings.windowOpacity > 100) {
            errors.push('窗口透明度必须在10%-100%之间');
        }

        return errors;
    }

    // 应用窗口透明度
    applyWindowOpacity(opacity) {
        try {
            const opacityValue = parseInt(opacity) / 100;
            console.log(`设置窗口透明度为: ${opacity}% (${opacityValue})`);
            
            // 通过 electronAPI 调用主进程设置窗口透明度
            if (window.electronAPI && window.electronAPI.setWindowOpacity) {
                window.electronAPI.setWindowOpacity(opacityValue);
            } else {
                console.warn('electronAPI 不可用，无法设置窗口透明度');
            }
        } catch (error) {
            console.error('设置窗口透明度失败:', error);
        }
    }

    // 初始化时应用保存的透明度设置
    initializeWindowOpacity() {
        this.applyWindowOpacity(this.settings.windowOpacity);
    }

    // 更新模糊控件的可见性
    updateBlurControlsVisibility() {
        const blurIntensityGroup = document.getElementById('blur-intensity-group');
        const blurCheckbox = document.getElementById('window-blur');
        const opacityValue = parseInt(this.settings.windowOpacity);
        
        if (blurIntensityGroup && blurCheckbox) {
            // 只有在透明度小于100%且启用模糊时才显示强度控制
            if (blurCheckbox.checked && opacityValue < 100) {
                blurIntensityGroup.style.display = 'block';
            } else {
                blurIntensityGroup.style.display = 'none';
            }
            
            // 如果透明度为100%，自动禁用模糊
            if (opacityValue >= 100 && blurCheckbox.checked) {
                blurCheckbox.checked = false;
                this.settings.windowBlur = false;
                this.saveSettings();
            }
        }
    }

    // 应用窗口模糊效果
    applyWindowBlur() {
        try {
            const isEnabled = this.settings.windowBlur && this.settings.windowOpacity < 100;
            const intensity = this.settings.blurIntensity;
            
            console.log(`应用窗口模糊效果: 启用=${isEnabled}, 强度=${intensity}`);
            
            // 通过 electronAPI 调用主进程设置窗口模糊
            if (window.electronAPI && window.electronAPI.setWindowBlur) {
                window.electronAPI.setWindowBlur(isEnabled, intensity);
            } else {
                console.warn('electronAPI 不可用，无法设置窗口模糊效果');
            }
        } catch (error) {
            console.error('设置窗口模糊效果失败:', error);
        }
    }

    // 初始化时应用保存的模糊设置
    initializeWindowBlur() {
        this.updateBlurControlsVisibility();
        this.applyWindowBlur();
    }

    // 更新系统托盘状态
    updateSystemTray(enabled) {
        try {
            console.log(`更新系统托盘状态: ${enabled ? '启用' : '禁用'}`);
            
            // 通过 electronAPI 调用主进程设置系统托盘
            if (window.electronAPI && window.electronAPI.setSystemTray) {
                window.electronAPI.setSystemTray(enabled);
            } else {
                console.warn('electronAPI 不可用，无法设置系统托盘');
            }
        } catch (error) {
            console.error('设置系统托盘失败:', error);
        }
    }

    // 初始化时应用保存的托盘设置
    initializeSystemTray() {
        this.updateSystemTray(this.settings.systemTray);
    }

    // 设置快捷键输入处理
    setupHotkeyInputs() {
        const hotkeyInputs = [
            { id: 'hotkey-toggle', setting: 'hotkeyToggle' },
            { id: 'hotkey-show', setting: 'hotkeyShow' },
            { id: 'hotkey-hide', setting: 'hotkeyHide' }
        ];

        hotkeyInputs.forEach(({ id, setting }) => {
            const input = document.getElementById(id);
            const clearBtn = document.getElementById(id.replace('hotkey-', 'clear-'));
            
            if (input) {
                // 设置初始值
                input.value = this.settings[setting] || '';
                if (this.settings[setting]) {
                    input.setAttribute('data-hotkey', this.settings[setting]);
                }

                // 点击输入框开始录制
                input.addEventListener('click', () => {
                    this.startHotkeyRecording(input, setting);
                });

                // 防止输入框获得焦点时显示光标
                input.addEventListener('focus', (e) => {
                    e.target.blur();
                    this.startHotkeyRecording(input, setting);
                });
            }

            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    this.clearHotkey(input, setting);
                });
            }
        });
    }

    // 设置边栏快捷键输入处理
    setupSidebarHotkeyInputs() {
        const sidebarHotkeyInputs = [
            { id: 'hotkey-left-sidebar', setting: 'sidebarLeftToggle' },
            { id: 'hotkey-right-sidebar', setting: 'sidebarRightToggle' }
        ];

        sidebarHotkeyInputs.forEach(({ id, setting }) => {
            const input = document.getElementById(id);
            const clearBtn = document.getElementById(id.replace('hotkey-', 'clear-'));
            
            if (input) {
                // 从sidebarManager获取初始值
                const shortcuts = window.sidebarManager?.getShortcuts();
                let displayValue = '';
                
                if (setting === 'sidebarLeftToggle' && shortcuts?.toggleLeftSidebar) {
                    displayValue = this.shortcutToDisplayText(shortcuts.toggleLeftSidebar);
                } else if (setting === 'sidebarRightToggle' && shortcuts?.toggleRightSidebar) {
                    displayValue = this.shortcutToDisplayText(shortcuts.toggleRightSidebar);
                }
                
                input.value = displayValue;

                // 点击输入框开始录制边栏快捷键
                input.addEventListener('click', () => {
                    this.startSidebarHotkeyRecording(input, setting);
                });

                // 防止输入框获得焦点时显示光标
                input.addEventListener('focus', (e) => {
                    e.target.blur();
                    this.startSidebarHotkeyRecording(input, setting);
                });
            }

            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    this.clearSidebarHotkey(input, setting);
                });
            }
        });
    }

    // 将快捷键对象转换为显示文本
    shortcutToDisplayText(shortcut) {
        if (!shortcut || !shortcut.key) return '';
        
        const parts = [];
        if (shortcut.modifiers.includes('ctrlKey')) parts.push('Ctrl');
        if (shortcut.modifiers.includes('altKey')) parts.push('Alt');
        if (shortcut.modifiers.includes('shiftKey')) parts.push('Shift');
        if (shortcut.modifiers.includes('metaKey')) parts.push('Meta');
        
        // 转换按键名称
        let keyName = shortcut.key;
        if (keyName === 'ArrowLeft') keyName = '←';
        if (keyName === 'ArrowRight') keyName = '→';
        if (keyName === 'ArrowUp') keyName = '↑';
        if (keyName === 'ArrowDown') keyName = '↓';
        
        parts.push(keyName);
        return parts.join(' + ');
    }

    // 开始边栏快捷键录制
    startSidebarHotkeyRecording(input, setting) {
        if (this.isRecording) return;
        
        this.isRecording = true;
        this.currentRecordingInput = input;
        this.currentRecordingSetting = setting;
        
        input.classList.add('recording');
        input.placeholder = '按下快捷键组合...';
        input.value = '';
        
        // 全局键盘事件监听
        this.hotkeyListener = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const hotkey = this.formatSidebarHotkey(e);
            if (hotkey) {
                this.finishSidebarHotkeyRecording(hotkey);
            }
        };
        
        document.addEventListener('keydown', this.hotkeyListener, true);
        
        // 5秒后自动取消录制
        this.recordingTimeout = setTimeout(() => {
            this.cancelHotkeyRecording();
        }, 5000);
    }

    // 格式化边栏快捷键
    formatSidebarHotkey(event) {
        // 过滤掉一些不适合作为快捷键的按键
        const invalidKeys = ['Tab', 'Escape', 'Enter', 'Space', 'Delete', 'Backspace'];
        if (invalidKeys.includes(event.key)) {
            return null;
        }

        const modifiers = [];
        if (event.ctrlKey) modifiers.push('ctrlKey');
        if (event.altKey) modifiers.push('altKey');
        if (event.shiftKey) modifiers.push('shiftKey');
        if (event.metaKey) modifiers.push('metaKey');

        // 边栏快捷键必须有修饰键
        if (modifiers.length === 0) {
            return null;
        }

        return {
            key: event.key,
            modifiers: modifiers
        };
    }

    // 完成边栏快捷键录制
    finishSidebarHotkeyRecording(hotkey) {
        if (!this.isRecording) return;
        
        const input = this.currentRecordingInput;
        const setting = this.currentRecordingSetting;
        
        // 显示快捷键
        const displayText = this.shortcutToDisplayText(hotkey);
        input.value = displayText;
        input.setAttribute('data-hotkey', JSON.stringify(hotkey));
        
        // 更新SidebarManager
        if (window.sidebarManager) {
            if (setting === 'sidebarLeftToggle') {
                window.sidebarManager.setShortcut('left', hotkey.key, hotkey.modifiers);
            } else if (setting === 'sidebarRightToggle') {
                window.sidebarManager.setShortcut('right', hotkey.key, hotkey.modifiers);
            }
        }
        
        this.cancelHotkeyRecording();
        
        // 显示成功提示
        this.showTempNotification(`边栏快捷键已设置: ${displayText}`);
    }

    // 清除边栏快捷键
    clearSidebarHotkey(input, setting) {
        input.value = '';
        input.removeAttribute('data-hotkey');
        
        // 更新SidebarManager
        if (window.sidebarManager) {
            if (setting === 'sidebarLeftToggle') {
                window.sidebarManager.setShortcut('left', '', []);
            } else if (setting === 'sidebarRightToggle') {
                window.sidebarManager.setShortcut('right', '', []);
            }
        }
        
        this.showTempNotification('边栏快捷键已清除');
    }

    // 开始快捷键录制
    startHotkeyRecording(input, setting) {
        if (this.isRecording) return;
        
        this.isRecording = true;
        this.currentRecordingInput = input;
        this.currentRecordingSetting = setting;
        
        input.classList.add('recording');
        input.placeholder = '按下快捷键组合...';
        input.value = '';
        
        // 全局键盘事件监听
        this.hotkeyListener = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const hotkey = this.formatHotkey(e);
            if (hotkey) {
                this.finishHotkeyRecording(hotkey);
            }
        };
        
        document.addEventListener('keydown', this.hotkeyListener, true);
        
        // 5秒后自动取消录制
        this.recordingTimeout = setTimeout(() => {
            this.cancelHotkeyRecording();
        }, 5000);
    }

    // 格式化快捷键
    formatHotkey(event) {
        const keys = [];
        
        // 修饰键
        if (event.ctrlKey) keys.push('Ctrl');
        if (event.altKey) keys.push('Alt');
        if (event.shiftKey) keys.push('Shift');
        if (event.metaKey) keys.push('Super'); // Windows键或Cmd键
        
        // 主键
        const mainKey = this.getMainKey(event);
        if (mainKey && !['Control', 'Alt', 'Shift', 'Meta'].includes(mainKey)) {
            keys.push(mainKey);
        }
        
        // 至少需要一个修饰键和一个主键
        const modifierCount = (event.ctrlKey ? 1 : 0) + (event.altKey ? 1 : 0) + 
                             (event.shiftKey ? 1 : 0) + (event.metaKey ? 1 : 0);
        
        if (modifierCount === 0 || keys.length < 2) {
            return null;
        }
        
        return keys.join('+');
    }

    // 获取主键名称
    getMainKey(event) {
        const key = event.key;
        const code = event.code;
        
        // 功能键
        if (key.startsWith('F') && key.length <= 3) return key;
        
        // 数字键
        if (key >= '0' && key <= '9') return key;
        
        // 字母键
        if (key.length === 1 && key.match(/[a-zA-Z]/)) return key.toUpperCase();
        
        // 特殊键映射
        const keyMap = {
            'ArrowUp': 'Up',
            'ArrowDown': 'Down',
            'ArrowLeft': 'Left',
            'ArrowRight': 'Right',
            'Enter': 'Return',
            'Escape': 'Escape',
            'Tab': 'Tab',
            'Space': 'Space',
            'Backspace': 'BackSpace',
            'Delete': 'Delete',
            'Home': 'Home',
            'End': 'End',
            'PageUp': 'PageUp',
            'PageDown': 'PageDown',
            'Insert': 'Insert'
        };
        
        return keyMap[key] || key;
    }

    // 完成快捷键录制
    finishHotkeyRecording(hotkey) {
        if (!this.isRecording) return;
        
        this.isRecording = false;
        document.removeEventListener('keydown', this.hotkeyListener, true);
        clearTimeout(this.recordingTimeout);
        
        const input = this.currentRecordingInput;
        const setting = this.currentRecordingSetting;
        
        input.classList.remove('recording');
        input.placeholder = '点击录入快捷键';
        input.value = hotkey;
        input.setAttribute('data-hotkey', hotkey);
        
        // 保存设置
        this.settings[setting] = hotkey;
        this.saveSettings();
        
        // 更新快捷键
        this.updateHotkey(setting, hotkey);
        
        console.log(`快捷键已设置: ${setting} = ${hotkey}`);
    }

    // 取消快捷键录制
    cancelHotkeyRecording() {
        if (!this.isRecording) return;
        
        this.isRecording = false;
        document.removeEventListener('keydown', this.hotkeyListener, true);
        clearTimeout(this.recordingTimeout);
        
        const input = this.currentRecordingInput;
        const setting = this.currentRecordingSetting;
        
        input.classList.remove('recording');
        input.placeholder = '点击录入快捷键';
        input.value = this.settings[setting] || '';
        
        if (this.settings[setting]) {
            input.setAttribute('data-hotkey', this.settings[setting]);
        } else {
            input.removeAttribute('data-hotkey');
        }
    }

    // 清除快捷键
    clearHotkey(input, setting) {
        input.value = '';
        input.removeAttribute('data-hotkey');
        
        // 保存设置
        this.settings[setting] = '';
        this.saveSettings();
        
        // 更新快捷键
        this.updateHotkey(setting, '');
        
        console.log(`快捷键已清除: ${setting}`);
    }

    // 更新快捷键
    updateHotkey(setting, hotkey) {
        try {
            if (window.electronAPI && window.electronAPI.setGlobalHotkey) {
                window.electronAPI.setGlobalHotkey(setting, hotkey);
            } else {
                console.warn('electronAPI 不可用，无法设置全局快捷键');
            }
        } catch (error) {
            console.error('设置全局快捷键失败:', error);
        }
    }

    // 初始化时应用保存的快捷键设置
    initializeHotkeys() {
        const hotkeys = {
            hotkeyToggle: this.settings.hotkeyToggle,
            hotkeyShow: this.settings.hotkeyShow,
            hotkeyHide: this.settings.hotkeyHide
        };

        Object.entries(hotkeys).forEach(([setting, hotkey]) => {
            if (hotkey) {
                this.updateHotkey(setting, hotkey);
            }
        });
    }

    // 设置开机启动相关控件
    setupAutoStartSettings() {
        const autoStartCheckbox = document.getElementById('auto-start');
        const silentStartCheckbox = document.getElementById('silent-start');
        const silentStartGroup = document.getElementById('silent-start-group');

        if (autoStartCheckbox) {
            // 设置初始值
            autoStartCheckbox.checked = this.settings.autoStart;
            this.updateSilentStartVisibility();

            // 开机启动开关事件
            autoStartCheckbox.addEventListener('change', (e) => {
                this.settings.autoStart = e.target.checked;
                this.saveSettings();
                this.updateAutoStart(e.target.checked);
                this.updateSilentStartVisibility();
            });
        }

        if (silentStartCheckbox) {
            // 设置初始值
            silentStartCheckbox.checked = this.settings.silentStart;

            // 静默启动开关事件
            silentStartCheckbox.addEventListener('change', (e) => {
                this.settings.silentStart = e.target.checked;
                this.saveSettings();
                this.updateAutoStart(this.settings.autoStart, e.target.checked);
            });
        }
    }

    // 更新静默启动选项的可见性
    updateSilentStartVisibility() {
        const silentStartGroup = document.getElementById('silent-start-group');
        const autoStartCheckbox = document.getElementById('auto-start');
        
        if (silentStartGroup && autoStartCheckbox) {
            if (autoStartCheckbox.checked) {
                silentStartGroup.style.display = 'flex';
            } else {
                silentStartGroup.style.display = 'none';
            }
        }
    }

    // 更新开机启动设置
    updateAutoStart(enabled, silentMode = null) {
        try {
            const actualSilentMode = silentMode !== null ? silentMode : this.settings.silentStart;
            console.log(`更新开机启动设置: 启用=${enabled}, 静默=${actualSilentMode}`);
            
            if (window.electronAPI && window.electronAPI.setAutoStart) {
                window.electronAPI.setAutoStart(enabled, actualSilentMode);
            } else {
                console.warn('electronAPI 不可用，无法设置开机启动');
            }
        } catch (error) {
            console.error('设置开机启动失败:', error);
        }
    }

    // 初始化时应用保存的开机启动设置
    initializeAutoStart() {
        this.updateAutoStart(this.settings.autoStart, this.settings.silentStart);
    }

    // 通知主应用主题设置已就绪
    notifyThemeReady() {
        try {
            console.log('设置管理器通知主题设置已就绪');
            
            // 如果主应用已经初始化，立即应用主题设置
            if (window.sikongAI && typeof window.sikongAI.applyThemeMode === 'function') {
                const themeMode = this.settings.themeMode || 'auto';
                const manualOverride = this.settings.manualThemeOverride || false;
                
                console.log('当前主题设置:', { themeMode, manualOverride });
                
                if (manualOverride && (themeMode === 'light' || themeMode === 'dark')) {
                    console.log('应用手动主题设置:', themeMode);
                    window.sikongAI.applyThemeMode(themeMode);
                } else {
                    console.log('应用自动主题模式');
                    window.sikongAI.applyThemeMode('auto');
                }
            }
        } catch (error) {
            console.error('通知主题设置就绪失败:', error);
        }
    }
}

// 初始化设置管理器
document.addEventListener('DOMContentLoaded', () => {
    console.log('开始初始化设置管理器...');
    window.settingsManager = new SettingsManager();
    console.log('设置管理器初始化完成，可通过 window.settingsManager 访问');
});