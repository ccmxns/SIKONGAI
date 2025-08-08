// 自定义标题栏控制
class TitleBar {
    constructor() {
        this.isHoveringOpacityBtn = false;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateMaximizeButton();
        this.updatePinButtonStatus();
        this.updateOpacityButtonStatus();
        this.updateThemeButtonStatus();
        
        // 强制刷新标题栏图标（解决缓存问题）
        setTimeout(() => {
            this.forceRefreshIcon();
        }, 100);
    }

    setupEventListeners() {
        // 最小化按钮
        const minimizeBtn = document.getElementById('minimize-btn');
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', () => {
                this.minimizeWindow();
            });
        }

        // 最大化/还原按钮
        const maximizeBtn = document.getElementById('maximize-btn');
        if (maximizeBtn) {
            maximizeBtn.addEventListener('click', () => {
                this.toggleMaximize();
            });
        }

        // 主题切换按钮
        const themeToggleBtn = document.getElementById('theme-toggle-btn');
        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', () => {
                this.toggleTheme();
            });
        }

        // 透明度按钮
        const opacityBtn = document.getElementById('opacity-btn');
        if (opacityBtn) {
            opacityBtn.addEventListener('click', () => {
                this.toggleQuickOpacity();
            });
            
            // 鼠标悬停时的滚轮事件
            opacityBtn.addEventListener('mouseenter', () => {
                this.isHoveringOpacityBtn = true;
            });
            
            opacityBtn.addEventListener('mouseleave', () => {
                this.isHoveringOpacityBtn = false;
            });
        }

        // 置顶按钮
        const pinBtn = document.getElementById('pin-btn');
        if (pinBtn) {
            pinBtn.addEventListener('click', () => {
                this.toggleAlwaysOnTop();
            });
        }

        // 设置按钮
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.openSettings();
            });
        }

        // 关闭按钮
        const closeBtn = document.getElementById('close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeWindow();
            });
        }

        // 双击标题栏切换最大化
        const dragRegion = document.querySelector('.titlebar-drag-region');
        if (dragRegion) {
            dragRegion.addEventListener('dblclick', () => {
                this.toggleMaximize();
            });
        }

        // 右键点击标题栏图标强制刷新
        const titlebarIcon = document.getElementById('titlebar-icon');
        if (titlebarIcon) {
            titlebarIcon.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                console.log('右键点击图标，强制刷新...');
                this.forceRefreshIcon();
            });
        }

        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            this.updateMaximizeButton();
        });

        // 全局滚轮事件，用于调整透明度
        window.addEventListener('wheel', (event) => {
            this.handleWheelEvent(event);
        }, { passive: false });

        // 监听窗口状态恢复事件
        if (window.electronAPI && window.electronAPI.onRestoreWindowState) {
            window.electronAPI.onRestoreWindowState(() => {
                this.restoreWindowState();
            });
        }
    }

    async minimizeWindow() {
        try {
            await window.electronAPI.minimizeWindow();
        } catch (error) {
            console.error('最小化窗口失败:', error);
        }
    }

    async toggleMaximize() {
        try {
            await window.electronAPI.maximizeWindow();
            this.updateMaximizeButton();
        } catch (error) {
            console.error('切换窗口最大化状态失败:', error);
        }
    }

    async closeWindow() {
        try {
            // 检查当前是否在设置页面
            const isSettingsPage = window.location.pathname.includes('settings.html');
            
            if (isSettingsPage && window.electronAPI.closeSettingsWindow) {
                console.log('关闭设置窗口');
                await window.electronAPI.closeSettingsWindow();
            } else {
                console.log('关闭主窗口');
                await window.electronAPI.closeWindow();
            }
        } catch (error) {
            console.error('关闭窗口失败:', error);
        }
    }

    async toggleAlwaysOnTop() {
        try {
            const isOnTop = await window.electronAPI.toggleAlwaysOnTop();
            this.updatePinButton(isOnTop);
            
            // 保存置顶状态到设置
            if (window.settingsManager) {
                window.settingsManager.settings.alwaysOnTop = isOnTop;
                window.settingsManager.saveSettings();
            }
            
            // 显示状态通知
            if (window.sikongAI && typeof window.sikongAI.showNotification === 'function') {
                window.sikongAI.showNotification(
                    isOnTop ? '窗口已置顶' : '取消窗口置顶',
                    'success',
                    2000
                );
            }
        } catch (error) {
            console.error('切换窗口置顶状态失败:', error);
        }
    }

    updatePinButton(isOnTop) {
        const pinBtn = document.getElementById('pin-btn');
        if (!pinBtn) return;

        // 更新按钮状态
        if (isOnTop) {
            pinBtn.classList.add('active');
            pinBtn.title = '取消置顶';
        } else {
            pinBtn.classList.remove('active');
            pinBtn.title = '置顶显示';
        }
    }

    async updateMaximizeButton() {
        try {
            const maximizeBtn = document.getElementById('maximize-btn');
            if (!maximizeBtn) return;

            const isMaximized = await window.electronAPI.isMaximized();
            
            // 更新按钮图标
            const svg = maximizeBtn.querySelector('svg');
            if (isMaximized) {
                // 还原图标（两个重叠的方框）
                svg.innerHTML = `
                    <rect x="0" y="2" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1"/>
                    <rect x="2" y="0" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1"/>
                `;
                maximizeBtn.title = '还原';
            } else {
                // 最大化图标（单个方框）
                svg.innerHTML = `
                    <rect x="0" y="0" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1"/>
                `;
                maximizeBtn.title = '最大化';
            }
        } catch (error) {
            console.error('更新最大化按钮状态失败:', error);
        }
    }

    async updatePinButtonStatus() {
        try {
            const isOnTop = await window.electronAPI.getAlwaysOnTop();
            this.updatePinButton(isOnTop);
        } catch (error) {
            console.error('获取窗口置顶状态失败:', error);
        }
    }

    updateOpacityButtonStatus() {
        // 延迟执行，等待设置管理器初始化
        setTimeout(() => {
            if (window.settingsManager) {
                const isEnabled = window.settingsManager.settings.quickOpacityEnabled;
                this.updateOpacityButton(isEnabled);
            }
        }, 100);
    }

    updateThemeButtonStatus() {
        // 延迟执行，等待设置管理器初始化
        setTimeout(() => {
            if (window.settingsManager) {
                const themeMode = window.settingsManager.settings.themeMode || 'auto';
                this.updateThemeButton(themeMode);
            }
        }, 100);
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
                if (window.sikongAI && typeof window.sikongAI.showNotification === 'function') {
                    window.sikongAI.showNotification('无法打开设置窗口，请稍后重试', 'error');
                }
            }
        }
    }

    async toggleQuickOpacity() {
        try {
            if (!window.settingsManager) {
                console.warn('设置管理器未初始化');
                return;
            }

            const currentEnabled = window.settingsManager.settings.quickOpacityEnabled;
            const newEnabled = !currentEnabled;
            
            // 更新设置
            window.settingsManager.settings.quickOpacityEnabled = newEnabled;
            window.settingsManager.saveSettings();
            
            // 更新按钮状态
            this.updateOpacityButton(newEnabled);
            
            if (newEnabled) {
                // 启用快捷透明度时，应用当前设置的透明度
                const opacity = window.settingsManager.settings.windowOpacity;
                await window.electronAPI.setWindowOpacityDirect(opacity);
            } else {
                // 禁用时恢复完全不透明
                await window.electronAPI.setWindowOpacityDirect(100);
            }
            
            // 显示状态通知
            if (window.sikongAI && typeof window.sikongAI.showNotification === 'function') {
                window.sikongAI.showNotification(
                    newEnabled ? '快捷透明度已启用' : '快捷透明度已禁用',
                    'success',
                    2000
                );
            }
        } catch (error) {
            console.error('切换快捷透明度失败:', error);
        }
    }

    updateOpacityButton(isEnabled) {
        const opacityBtn = document.getElementById('opacity-btn');
        if (!opacityBtn) return;

        if (isEnabled) {
            opacityBtn.classList.add('active');
            opacityBtn.title = '禁用快捷透明度';
        } else {
            opacityBtn.classList.remove('active');
            opacityBtn.title = '启用快捷透明度';
        }
    }

    // 切换主题
    async toggleTheme() {
        try {
            if (!window.settingsManager) {
                console.warn('设置管理器未初始化');
                return;
            }

            const currentMode = window.settingsManager.settings.themeMode;
            let newMode;
            
            // 循环切换：auto -> light -> dark -> auto
            switch (currentMode) {
                case 'auto':
                    newMode = 'light';
                    break;
                case 'light':
                    newMode = 'dark';
                    break;
                case 'dark':
                    newMode = 'auto';
                    break;
                default:
                    newMode = 'light';
            }

            // 更新设置
            window.settingsManager.settings.themeMode = newMode;
            window.settingsManager.settings.manualThemeOverride = (newMode !== 'auto');
            window.settingsManager.saveSettings();

            // 应用主题
            if (window.sikongAI && typeof window.sikongAI.applyThemeMode === 'function') {
                window.sikongAI.applyThemeMode(newMode);
            }

            // 更新按钮状态
            this.updateThemeButton(newMode);

            // 显示状态通知
            const themeNames = {
                'auto': '跟随系统',
                'light': '浅色模式',
                'dark': '深色模式'
            };
            
            if (window.sikongAI && typeof window.sikongAI.showNotification === 'function') {
                window.sikongAI.showNotification(
                    `已切换到${themeNames[newMode]}`,
                    'success',
                    2000
                );
            }

            console.log('主题已切换为:', newMode);
        } catch (error) {
            console.error('切换主题失败:', error);
        }
    }

    // 更新主题按钮状态
    updateThemeButton(themeMode) {
        const themeBtn = document.getElementById('theme-toggle-btn');
        if (!themeBtn) return;

        const lightIcon = themeBtn.querySelector('.theme-icon-light');
        const darkIcon = themeBtn.querySelector('.theme-icon-dark');
        
        if (!lightIcon || !darkIcon) return;

        // 根据当前主题模式显示对应图标
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        
        if (themeMode === 'auto') {
            // 自动模式：根据当前实际主题显示图标，按钮不高亮
            themeBtn.classList.remove('active');
            themeBtn.title = '切换主题 (当前: 跟随系统)';
            
            if (currentTheme === 'dark') {
                lightIcon.style.display = 'block';
                darkIcon.style.display = 'none';
            } else {
                lightIcon.style.display = 'none';
                darkIcon.style.display = 'block';
            }
        } else if (themeMode === 'light') {
            // 强制浅色模式
            themeBtn.classList.add('active');
            themeBtn.title = '切换主题 (当前: 浅色模式)';
            lightIcon.style.display = 'none';
            darkIcon.style.display = 'block';
        } else if (themeMode === 'dark') {
            // 强制深色模式
            themeBtn.classList.add('active');
            themeBtn.title = '切换主题 (当前: 深色模式)';
            lightIcon.style.display = 'block';
            darkIcon.style.display = 'none';
        }
    }

    async handleWheelEvent(event) {
        // 检查是否启用了快捷透明度
        if (!window.settingsManager?.settings?.quickOpacityEnabled) return;
        
        // 检查是否满足透明度调节条件
        const isHoveringOpacity = this.isHoveringOpacityBtn;
        const isAltPressed = event.altKey;
        
        // 两种调节方式：1) 悬停透明度按钮 2) 按住Alt键
        if (!isHoveringOpacity && !isAltPressed) return;

        event.preventDefault();
        
        try {
            const currentOpacity = window.settingsManager.settings.windowOpacity;
            
            // 根据调节方式确定步长
            let stepSize;
            let adjustmentType;
            
            if (isAltPressed) {
                // Alt+滚轮：精细调节，步长1%
                stepSize = 1;
                adjustmentType = 'fine';
            } else {
                // 悬停按钮+滚轮：常规调节，步长5%
                stepSize = 5;
                adjustmentType = 'normal';
            }
            
            const delta = event.deltaY > 0 ? -stepSize : stepSize; // 向下滚动减少透明度，向上滚动增加透明度
            const newOpacity = Math.max(10, Math.min(100, currentOpacity + delta));
            
            if (newOpacity !== currentOpacity) {
                // 更新设置
                window.settingsManager.settings.windowOpacity = newOpacity;
                window.settingsManager.saveSettings();
                
                // 立即应用透明度
                await window.electronAPI.setWindowOpacityDirect(newOpacity);
                
                // 显示透明度提示，精细调节时显示更详细的信息
                if (window.sikongAI && typeof window.sikongAI.showNotification === 'function') {
                    const message = adjustmentType === 'fine' 
                        ? `透明度: ${newOpacity}% (精细调节)`
                        : `透明度: ${newOpacity}%`;
                    
                    window.sikongAI.showNotification(
                        message,
                        'info',
                        adjustmentType === 'fine' ? 1000 : 800
                    );
                }
            }
        } catch (error) {
            console.error('调整透明度失败:', error);
        }
    }

    async restoreWindowState() {
        try {
            if (!window.settingsManager) {
                console.warn('设置管理器未初始化，无法恢复窗口状态');
                return;
            }

            const settings = window.settingsManager.settings;
            
            // 恢复置顶状态
            if (settings.alwaysOnTop) {
                await window.electronAPI.toggleAlwaysOnTop();
                this.updatePinButton(true);
                console.log('已恢复窗口置顶状态');
            }
            
            // 恢复透明度状态
            this.updateOpacityButton(settings.quickOpacityEnabled);
            
            if (settings.quickOpacityEnabled && settings.windowOpacity < 100) {
                await window.electronAPI.setWindowOpacityDirect(settings.windowOpacity);
                console.log('已恢复窗口透明度:', settings.windowOpacity);
            }
            
            // 恢复主题状态
            const themeMode = settings.themeMode || 'auto';
            this.updateThemeButton(themeMode);
            console.log('已恢复主题模式:', themeMode);
            
        } catch (error) {
            console.error('恢复窗口状态失败:', error);
        }
    }

    // 强制刷新标题栏图标
    forceRefreshIcon() {
        try {
            const titlebarIcon = document.getElementById('titlebar-icon');
            if (!titlebarIcon) {
                console.warn('未找到标题栏图标元素');
                return;
            }

            console.log('开始强制刷新标题栏图标...');
            
            // 方法1: 完全重新创建图片元素
            const parent = titlebarIcon.parentNode;
            const newIcon = document.createElement('img');
            
            // 复制所有属性 - 从views目录向上一级到src目录找ico.png
            newIcon.src = '../ico.png?' + Date.now() + '&nocache=' + Math.random();
            newIcon.alt = titlebarIcon.alt;
            newIcon.className = titlebarIcon.className;
            newIcon.id = titlebarIcon.id;
            
            // 添加加载事件监听
            newIcon.onload = () => {
                console.log('新标题栏图标加载成功!');
            };
            
            newIcon.onerror = () => {
                console.error('新标题栏图标加载失败');
                // 回退到原来的图标
                newIcon.src = '../ico.png';
            };
            
            // 替换旧的图标元素
            parent.replaceChild(newIcon, titlebarIcon);
            
            console.log('标题栏图标元素已重新创建:', newIcon.src);
            
        } catch (error) {
            console.error('强制刷新标题栏图标失败:', error);
        }
    }
}

// 初始化标题栏
document.addEventListener('DOMContentLoaded', () => {
    window.titleBar = new TitleBar();
    
    // 标题栏初始化完成后，强制刷新图标
    setTimeout(() => {
        if (window.sikongAI && typeof window.sikongAI.refreshTitlebarIcon === 'function') {
            console.log('标题栏初始化完成，正在刷新图标...');
            window.sikongAI.refreshTitlebarIcon();
        }
    }, 200);
});