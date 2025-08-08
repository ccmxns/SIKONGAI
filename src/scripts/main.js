// 主应用脚本
class SikongAI {
    constructor() {
        this.currentTheme = 'light';
        this.init();
    }

    async init() {
        this.setupEventListeners();
        
        // 延迟主题初始化，等待设置管理器加载
        this.waitForSettingsAndInitTheme();
        
        console.log('司空AI 应用已初始化');
    }

    // 等待设置管理器加载完成后初始化主题
    waitForSettingsAndInitTheme() {
        const checkSettings = () => {
            if (window.settingsManager) {
                console.log('设置管理器已就绪，开始初始化主题');
                this.initTheme();
            } else {
                console.log('等待设置管理器初始化...');
                setTimeout(checkSettings, 50);
            }
        };
        
        // 立即检查一次，如果没有则开始轮询
        checkSettings();
    }

    async initTheme() {
        try {
            console.log('=== 开始主题初始化 ===');
            
            // 检查是否有手动主题设置
            if (window.settingsManager) {
                const themeMode = window.settingsManager.settings.themeMode || 'auto';
                const manualOverride = window.settingsManager.settings.manualThemeOverride || false;
                
                console.log('从设置管理器读取到的主题配置:');
                console.log('- themeMode:', themeMode);
                console.log('- manualThemeOverride:', manualOverride);
                
                if (manualOverride && (themeMode === 'light' || themeMode === 'dark')) {
                    // 使用手动设置的主题
                    this.setTheme(themeMode);
                    console.log('✅ 使用手动设置的主题:', themeMode);
                    
                    // 更新标题栏按钮状态
                    if (window.titleBar && typeof window.titleBar.updateThemeButton === 'function') {
                        window.titleBar.updateThemeButton(themeMode);
                    }
                    return;
                }
                
                console.log('当前为自动主题模式，将跟随系统主题');
            } else {
                console.warn('设置管理器不可用，使用系统主题');
            }

            // 获取系统主题
            const isDark = await window.electronAPI.getTheme();
            const systemTheme = isDark ? 'dark' : 'light';
            console.log('系统主题:', systemTheme);
            this.setTheme(systemTheme);

            // 监听主题变化（仅在自动模式下生效）
            window.electronAPI.onThemeChanged((event, isDark) => {
                // 检查是否为手动覆盖模式
                if (window.settingsManager && window.settingsManager.settings.manualThemeOverride) {
                    console.log('手动主题模式，忽略系统主题变化');
                    return;
                }
                const newTheme = isDark ? 'dark' : 'light';
                console.log('系统主题变化:', newTheme);
                this.setTheme(newTheme);
            });
            
            console.log('=== 主题初始化完成 ===');
        } catch (error) {
            console.error('主题初始化失败:', error);
            // 降级到默认主题
            this.setTheme('light');
        }
    }

    setTheme(theme) {
        this.currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        
        // 保存主题设置到本地存储
        localStorage.setItem('theme', theme);
        
        console.log(`主题已切换到: ${theme}`);
    }

    // 调试工具：检查当前主题状态
    debugThemeStatus() {
        console.log('=== 主题状态调试信息 ===');
        console.log('当前应用主题:', this.currentTheme);
        console.log('DOM主题属性:', document.documentElement.getAttribute('data-theme'));
        
        if (window.settingsManager) {
            console.log('设置管理器主题配置:');
            console.log('- themeMode:', window.settingsManager.settings.themeMode);
            console.log('- manualThemeOverride:', window.settingsManager.settings.manualThemeOverride);
        } else {
            console.log('设置管理器未初始化');
        }
        
        if (window.titleBar) {
            const themeBtn = document.getElementById('theme-toggle-btn');
            if (themeBtn) {
                console.log('主题按钮状态:');
                console.log('- 是否激活:', themeBtn.classList.contains('active'));
                console.log('- 标题:', themeBtn.title);
            }
        }
        
        console.log('=== 调试信息结束 ===');
    }

    // 应用主题模式（支持手动切换）
    async applyThemeMode(themeMode) {
        try {
            if (themeMode === 'auto') {
                // 自动模式：跟随系统主题
                const isDark = await window.electronAPI.getTheme();
                this.setTheme(isDark ? 'dark' : 'light');
                console.log('切换到自动主题模式，当前系统主题:', isDark ? 'dark' : 'light');
            } else if (themeMode === 'light' || themeMode === 'dark') {
                // 手动模式：使用指定主题
                this.setTheme(themeMode);
                console.log('切换到手动主题模式:', themeMode);
            }
            
            // 更新标题栏按钮状态
            if (window.titleBar && typeof window.titleBar.updateThemeButton === 'function') {
                window.titleBar.updateThemeButton(themeMode);
            }
        } catch (error) {
            console.error('应用主题模式失败:', error);
        }
    }

    setupEventListeners() {
        // 窗口加载完成后的处理
        window.addEventListener('DOMContentLoaded', () => {
            console.log('DOM 加载完成');
            // 强制刷新标题栏图标
            this.refreshTitlebarIcon();
        });

        // 处理未捕获的错误
        window.addEventListener('error', (event) => {
            console.error('应用错误:', event.error);
        });

        // 防止拖拽文件到窗口
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
        });
    }

    // 显示通知
    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // 添加到页面
        document.body.appendChild(notification);
        
        // 自动移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, duration);
    }

    // 格式化时间
    formatTime(date = new Date()) {
        return date.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // 生成唯一ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // 强制刷新标题栏图标
    refreshTitlebarIcon() {
        try {
            const titlebarIcon = document.getElementById('titlebar-icon');
            if (titlebarIcon) {
                const timestamp = Date.now();
                const random = Math.random().toString(36).substr(2, 9);
                
                // 强制破坏缓存，使用多重参数 - 从views目录到src目录
                const newSrc = `../ico.png?v=1.5.4&t=${timestamp}&r=${random}&nocache=true`;
                
                console.log('正在强制刷新标题栏图标...');
                
                // 先清空src来强制重新加载
                titlebarIcon.src = '';
                
                // 稍微延迟后设置新的src
                setTimeout(() => {
                    titlebarIcon.src = newSrc;
                    console.log('标题栏图标已强制刷新:', newSrc);
                }, 10);
                
                // 添加错误处理
                titlebarIcon.onerror = () => {
                    console.error('标题栏图标加载失败，尝试重新加载');
                    // 如果失败，尝试不带参数的版本
                    setTimeout(() => {
                        titlebarIcon.src = '../ico.png?' + Date.now();
                    }, 100);
                };
                
                titlebarIcon.onload = () => {
                    console.log('标题栏图标加载成功!');
                };
            } else {
                console.warn('未找到标题栏图标元素 (ID: titlebar-icon)');
            }
        } catch (error) {
            console.error('刷新标题栏图标时出错:', error);
        }
    }
}

// 全局应用实例
window.sikongAI = new SikongAI();