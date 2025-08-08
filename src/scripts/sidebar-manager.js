// 边栏管理器
class SidebarManager {
    constructor() {
        this.leftSidebar = null;
        this.rightSidebar = null;
        this.leftSidebarCollapsed = false;
        this.rightSidebarCollapsed = false;
        
        // 边栏宽度设置
        this.sidebarWidths = {
            left: 280,      // 左侧边栏默认宽度
            right: 280,     // 右侧边栏默认宽度
            leftMin: 200,   // 最小宽度
            leftMax: 500,   // 最大宽度
            rightMin: 200,  // 最小宽度
            rightMax: 500   // 最大宽度
        };
        
        // 拖拽状态
        this.isDragging = false;
        this.dragTarget = null;
        this.dragStartX = 0;
        this.dragStartWidth = 0;
        this.rafId = null; // 用于requestAnimationFrame优化
        
        // 默认快捷键
        this.shortcuts = {
            toggleLeftSidebar: { key: 'ArrowLeft', modifiers: ['ctrlKey'] },
            toggleRightSidebar: { key: 'ArrowRight', modifiers: ['ctrlKey'] }
        };
        
        this.init();
    }

    init() {
        console.log('初始化边栏管理器...');
        
        this.leftSidebar = document.querySelector('.sidebar');
        this.rightSidebar = document.querySelector('.right-sidebar');
        
        console.log('边栏元素查找结果:', {
            leftSidebar: !!this.leftSidebar,
            rightSidebar: !!this.rightSidebar
        });
        
        // 立即设置初始宽度，确保边栏有宽度显示
        this.setInitialWidths();
        
        this.loadSettings();
        this.setupEventListeners();
        this.setupDragResizers();
        
        // 延迟恢复状态，确保DOM完全加载
        setTimeout(() => {
            this.restoreState();
        }, 100);
        
        console.log('边栏管理器初始化完成');
    }

    setupEventListeners() {
        // 监听键盘事件
        document.addEventListener('keydown', (event) => {
            this.handleKeyDown(event);
        });
        
        // 监听设置变化
        if (window.settingsManager) {
            window.settingsManager.on('settingsChanged', () => {
                this.loadSettings();
            });
        }
    }

    handleKeyDown(event) {
        // 检查左侧边栏快捷键
        if (this.matchesShortcut(event, this.shortcuts.toggleLeftSidebar)) {
            event.preventDefault();
            this.toggleLeftSidebar();
            return;
        }
        
        // 检查右侧边栏快捷键
        if (this.matchesShortcut(event, this.shortcuts.toggleRightSidebar)) {
            event.preventDefault();
            this.toggleRightSidebar();
            return;
        }
    }

    matchesShortcut(event, shortcut) {
        // 检查按键是否匹配
        if (event.key !== shortcut.key && event.code !== shortcut.key) {
            return false;
        }
        
        // 检查修饰键
        for (const modifier of shortcut.modifiers) {
            if (!event[modifier]) {
                return false;
            }
        }
        
        // 确保没有其他不需要的修饰键
        const requiredModifiers = new Set(shortcut.modifiers);
        const modifiers = ['ctrlKey', 'altKey', 'shiftKey', 'metaKey'];
        
        for (const modifier of modifiers) {
            if (event[modifier] && !requiredModifiers.has(modifier)) {
                return false;
            }
        }
        
        return true;
    }



    // 设置快捷键
    setShortcut(type, key, modifiers) {
        if (type === 'left') {
            this.shortcuts.toggleLeftSidebar = { key, modifiers };
        } else if (type === 'right') {
            this.shortcuts.toggleRightSidebar = { key, modifiers };
        }
        
        this.saveSettings();
    }

    // 获取快捷键配置
    getShortcuts() {
        return this.shortcuts;
    }

    // 加载设置
    loadSettings() {
        try {
            if (window.settingsManager && window.settingsManager.settings.sidebarShortcuts) {
                const savedShortcuts = window.settingsManager.settings.sidebarShortcuts;
                this.shortcuts = { ...this.shortcuts, ...savedShortcuts };
            }
        } catch (error) {
            console.error('加载边栏快捷键设置失败:', error);
        }
    }

    // 保存设置
    saveSettings() {
        try {
            if (window.settingsManager) {
                window.settingsManager.settings.sidebarShortcuts = this.shortcuts;
                window.settingsManager.saveSettings();
            }
        } catch (error) {
            console.error('保存边栏快捷键设置失败:', error);
        }
    }

    // 显示通知
    showNotification(message, type = 'info', duration = 2000) {
        if (window.sikongAI && typeof window.sikongAI.showNotification === 'function') {
            window.sikongAI.showNotification(message, type, duration);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    // 将快捷键转换为显示文本
    shortcutToText(shortcut) {
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

    // 获取边栏状态
    getSidebarStates() {
        return {
            leftCollapsed: this.leftSidebarCollapsed,
            rightCollapsed: this.rightSidebarCollapsed,
            leftWidth: this.sidebarWidths.left,
            rightWidth: this.sidebarWidths.right
        };
    }

    // 设置拖拽分隔条
    setupDragResizers() {
        const leftResizer = document.getElementById('left-resizer');
        const rightResizer = document.getElementById('right-resizer');

        if (leftResizer) {
            leftResizer.addEventListener('mousedown', (e) => {
                this.startDrag(e, 'left');
            });
        }

        if (rightResizer) {
            rightResizer.addEventListener('mousedown', (e) => {
                this.startDrag(e, 'right');
            });
        }

        // 全局鼠标事件（使用passive优化性能）
        document.addEventListener('mousemove', (e) => {
            this.handleDrag(e);
        }, { passive: true });

        document.addEventListener('mouseup', () => {
            this.endDrag();
        });
    }

    // 开始拖拽
    startDrag(event, target) {
        event.preventDefault();
        
        this.isDragging = true;
        this.dragTarget = target;
        this.dragStartX = event.clientX;
        
        // 记录当前宽度
        if (target === 'left') {
            this.dragStartWidth = this.sidebarWidths.left;
        } else {
            this.dragStartWidth = this.sidebarWidths.right;
        }
        
        // 禁用CSS过渡动画以提高拖拽性能
        this.disableTransitions();
        
        // 添加拖拽样式
        const resizer = document.getElementById(`${target}-resizer`);
        if (resizer) {
            resizer.classList.add('dragging');
        }
        
        // 防止文本选择
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'ew-resize';
    }

    // 处理拖拽
    handleDrag(event) {
        if (!this.isDragging) return;
        
        // 取消之前的动画帧，避免堆积
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
        }
        
        // 使用requestAnimationFrame优化性能
        this.rafId = requestAnimationFrame(() => {
            const deltaX = event.clientX - this.dragStartX;
            let newWidth;
            
            if (this.dragTarget === 'left') {
                newWidth = Math.max(
                    this.sidebarWidths.leftMin,
                    Math.min(this.sidebarWidths.leftMax, this.dragStartWidth + deltaX)
                );
                this.setSidebarWidthFast('left', newWidth);
            } else if (this.dragTarget === 'right') {
                newWidth = Math.max(
                    this.sidebarWidths.rightMin,
                    Math.min(this.sidebarWidths.rightMax, this.dragStartWidth - deltaX)
                );
                this.setSidebarWidthFast('right', newWidth);
            }
        });
    }

    // 结束拖拽
    endDrag() {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        
        // 取消任何待处理的动画帧
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        
        // 重新启用CSS过渡动画
        this.enableTransitions();
        
        // 移除拖拽样式
        const resizer = document.getElementById(`${this.dragTarget}-resizer`);
        if (resizer) {
            resizer.classList.remove('dragging');
        }
        
        // 恢复默认样式
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        
        // 保存设置
        this.saveState();
        
        this.dragTarget = null;
    }

    // 设置边栏宽度（带日志，用于非拖拽场景）
    setSidebarWidth(side, width) {
        console.log(`设置${side === 'left' ? '左' : '右'}侧边栏宽度:`, width);
        
        if (side === 'left' && this.leftSidebar) {
            this.sidebarWidths.left = width;
            this.leftSidebar.style.width = `${width}px`;
            console.log('左侧边栏宽度已设置为:', width + 'px');
        } else if (side === 'right' && this.rightSidebar) {
            this.sidebarWidths.right = width;
            this.rightSidebar.style.width = `${width}px`;
            console.log('右侧边栏宽度已设置为:', width + 'px');
        } else {
            console.warn(`无法设置${side === 'left' ? '左' : '右'}侧边栏宽度，元素不存在`);
        }
    }

    // 快速设置边栏宽度（无日志，用于拖拽优化）
    setSidebarWidthFast(side, width) {
        if (side === 'left' && this.leftSidebar) {
            this.sidebarWidths.left = width;
            this.leftSidebar.style.width = `${width}px`;
        } else if (side === 'right' && this.rightSidebar) {
            this.sidebarWidths.right = width;
            this.rightSidebar.style.width = `${width}px`;
        }
    }

    // 禁用CSS过渡动画（拖拽开始时）
    disableTransitions() {
        if (this.leftSidebar) {
            this.leftSidebar.style.transition = 'none';
        }
        if (this.rightSidebar) {
            this.rightSidebar.style.transition = 'none';
        }
        
        // 禁用分隔条的过渡动画
        const leftResizer = document.getElementById('left-resizer');
        const rightResizer = document.getElementById('right-resizer');
        if (leftResizer) {
            leftResizer.style.transition = 'background-color 0.2s ease'; // 保留悬停效果
        }
        if (rightResizer) {
            rightResizer.style.transition = 'background-color 0.2s ease'; // 保留悬停效果
        }
    }

    // 启用CSS过渡动画（拖拽结束时）
    enableTransitions() {
        if (this.leftSidebar) {
            this.leftSidebar.style.transition = 'width 0.3s ease, min-width 0.3s ease, opacity 0.3s ease';
        }
        if (this.rightSidebar) {
            this.rightSidebar.style.transition = 'width 0.3s ease, min-width 0.3s ease, opacity 0.3s ease';
        }
        
        // 恢复分隔条的过渡动画
        const leftResizer = document.getElementById('left-resizer');
        const rightResizer = document.getElementById('right-resizer');
        if (leftResizer) {
            leftResizer.style.transition = 'width 0.3s ease, opacity 0.3s ease, background-color 0.2s ease';
        }
        if (rightResizer) {
            rightResizer.style.transition = 'width 0.3s ease, opacity 0.3s ease, background-color 0.2s ease';
        }
    }

    // 恢复状态
    restoreState() {
        console.log('开始恢复边栏状态...');
        console.log('当前状态:', {
            leftSidebar: !!this.leftSidebar,
            rightSidebar: !!this.rightSidebar,
            leftCollapsed: this.leftSidebarCollapsed,
            rightCollapsed: this.rightSidebarCollapsed,
            leftWidth: this.sidebarWidths.left,
            rightWidth: this.sidebarWidths.right
        });
        
        // 应用保存的宽度
        console.log('应用边栏宽度...');
        this.setSidebarWidth('left', this.sidebarWidths.left);
        this.setSidebarWidth('right', this.sidebarWidths.right);
        
                 // 恢复折叠状态
         console.log('恢复边栏折叠状态...');
         console.log('当前折叠状态值:', {
             leftSidebarCollapsed: this.leftSidebarCollapsed,
             rightSidebarCollapsed: this.rightSidebarCollapsed,
             leftSidebarExists: !!this.leftSidebar,
             rightSidebarExists: !!this.rightSidebar
         });
         
         if (this.leftSidebar) {
             console.log('左侧边栏处理前的类名:', this.leftSidebar.className);
             if (this.leftSidebarCollapsed) {
                 console.log('折叠左侧边栏');
                 this.leftSidebar.classList.add('collapsed');
             } else {
                 console.log('展开左侧边栏');
                 this.leftSidebar.classList.remove('collapsed');
             }
             console.log('左侧边栏处理后的类名:', this.leftSidebar.className);
         } else {
             console.error('左侧边栏元素未找到！');
         }
         
         if (this.rightSidebar) {
             console.log('右侧边栏处理前的类名:', this.rightSidebar.className);
             if (this.rightSidebarCollapsed) {
                 console.log('折叠右侧边栏');
                 this.rightSidebar.classList.add('collapsed');
             } else {
                 console.log('展开右侧边栏');
                 this.rightSidebar.classList.remove('collapsed');
             }
             console.log('右侧边栏处理后的类名:', this.rightSidebar.className);
         } else {
             console.error('右侧边栏元素未找到！');
         }
        
        // 如果没有保存的状态，则使用默认设置
        const savedState = localStorage.getItem('sidebarState');
        if (!savedState && this.rightSidebar) {
            console.log('使用默认设置：右侧边栏默认折叠');
            this.rightSidebar.classList.add('collapsed');
            this.rightSidebarCollapsed = true;
            // 保存初始状态
            this.saveState();
        }
        
                 // 更新分隔条显示状态
         this.updateResizerVisibility();
         
         console.log('边栏状态恢复完成');
    }

    // 保存状态
    saveState() {
        const state = {
            leftCollapsed: this.leftSidebarCollapsed,
            rightCollapsed: this.rightSidebarCollapsed,
            leftWidth: this.sidebarWidths.left,
            rightWidth: this.sidebarWidths.right,
            shortcuts: this.shortcuts
        };
        
        // 简化日志输出以提高性能
        // console.log('保存边栏状态:', state);
        
        try {
            localStorage.setItem('sidebarState', JSON.stringify(state));
            // console.log('边栏状态已保存到localStorage');
        } catch (error) {
            console.error('保存边栏状态失败:', error);
        }
    }

    // 加载设置（重写原方法）
    loadSettings() {
        try {
            console.log('开始加载边栏设置...');
            
            // 从localStorage加载状态
            const savedState = localStorage.getItem('sidebarState');
            console.log('从localStorage读取的状态:', savedState);
            
            if (savedState) {
                const state = JSON.parse(savedState);
                console.log('解析后的状态:', state);
                
                // 恢复折叠状态
                console.log('原始状态值:', {
                    'state.leftCollapsed': state.leftCollapsed,
                    'state.rightCollapsed': state.rightCollapsed,
                    'typeof state.leftCollapsed': typeof state.leftCollapsed,
                    'typeof state.rightCollapsed': typeof state.rightCollapsed
                });
                
                this.leftSidebarCollapsed = state.leftCollapsed === true;
                this.rightSidebarCollapsed = state.rightCollapsed !== false; // 默认折叠
                
                console.log('恢复的折叠状态:', {
                    leftCollapsed: this.leftSidebarCollapsed,
                    rightCollapsed: this.rightSidebarCollapsed
                });
                
                // 恢复宽度
                if (state.leftWidth) {
                    this.sidebarWidths.left = Math.max(
                        this.sidebarWidths.leftMin,
                        Math.min(this.sidebarWidths.leftMax, state.leftWidth)
                    );
                }
                if (state.rightWidth) {
                    this.sidebarWidths.right = Math.max(
                        this.sidebarWidths.rightMin,
                        Math.min(this.sidebarWidths.rightMax, state.rightWidth)
                    );
                }
                
                console.log('恢复的宽度:', {
                    leftWidth: this.sidebarWidths.left,
                    rightWidth: this.sidebarWidths.right
                });
                
                // 恢复快捷键
                if (state.shortcuts) {
                    this.shortcuts = { ...this.shortcuts, ...state.shortcuts };
                }
            } else {
                console.log('没有找到保存的边栏状态，使用默认值');
            }
            
            // 从settingsManager加载快捷键设置
            if (window.settingsManager && window.settingsManager.settings.sidebarShortcuts) {
                const savedShortcuts = window.settingsManager.settings.sidebarShortcuts;
                this.shortcuts = { ...this.shortcuts, ...savedShortcuts };
                console.log('从settingsManager加载快捷键:', savedShortcuts);
            }
            
            console.log('边栏设置加载完成');
        } catch (error) {
            console.error('加载边栏设置失败:', error);
        }
    }

    // 更新切换方法以保存状态
    toggleLeftSidebar() {
        if (!this.leftSidebar) return;
        
        this.leftSidebarCollapsed = !this.leftSidebarCollapsed;
        
        if (this.leftSidebarCollapsed) {
            this.leftSidebar.classList.add('collapsed');
        } else {
            this.leftSidebar.classList.remove('collapsed');
        }
        
        console.log('左侧边栏状态:', this.leftSidebarCollapsed ? '折叠' : '展开');
        
        // 更新分隔条显示状态
        this.updateResizerVisibility();
        
        this.saveState();
    }

    toggleRightSidebar() {
        if (!this.rightSidebar) return;
        
        this.rightSidebarCollapsed = !this.rightSidebarCollapsed;
        
        if (this.rightSidebarCollapsed) {
            this.rightSidebar.classList.add('collapsed');
        } else {
            this.rightSidebar.classList.remove('collapsed');
        }
        
        console.log('右侧边栏状态:', this.rightSidebarCollapsed ? '折叠' : '展开');
        
        // 更新分隔条显示状态
        this.updateResizerVisibility();
        
        this.saveState();
    }

    // 更新分隔条的显示状态
    updateResizerVisibility() {
        const leftResizer = document.getElementById('left-resizer');
        const rightResizer = document.getElementById('right-resizer');
        
        if (leftResizer) {
            if (this.leftSidebarCollapsed) {
                leftResizer.classList.add('hidden');
            } else {
                leftResizer.classList.remove('hidden');
            }
        }
        
        if (rightResizer) {
            if (this.rightSidebarCollapsed) {
                rightResizer.classList.add('hidden');
            } else {
                rightResizer.classList.remove('hidden');
            }
        }
        
        // 简化日志输出以提高性能
        // console.log('分隔条显示状态已更新');
    }

    // 设置初始宽度
    setInitialWidths() {
        console.log('设置边栏初始宽度...');
        
        // 为左侧边栏设置初始宽度
        if (this.leftSidebar) {
            const initialLeftWidth = this.sidebarWidths.left;
            this.leftSidebar.style.width = `${initialLeftWidth}px`;
            console.log('左侧边栏初始宽度设置为:', initialLeftWidth + 'px');
        }
        
        // 为右侧边栏设置初始宽度
        if (this.rightSidebar) {
            const initialRightWidth = this.sidebarWidths.right;
            this.rightSidebar.style.width = `${initialRightWidth}px`;
            console.log('右侧边栏初始宽度设置为:', initialRightWidth + 'px');
        }
    }

    // 调试工具：清除保存的状态，重新开始
    debugClearState() {
        console.log('=== 清除边栏状态 ===');
        try {
            localStorage.removeItem('sidebarState');
            console.log('localStorage中的边栏状态已清除');
            console.log('请刷新页面以重新开始测试');
        } catch (error) {
            console.error('清除状态失败:', error);
        }
        console.log('=== 清除完成 ===');
    }

    // 调试工具：手动测试状态恢复
    debugTestRestore() {
        console.log('=== 调试测试开始 ===');
        console.log('当前localStorage中的状态:');
        const saved = localStorage.getItem('sidebarState');
        if (saved) {
            console.log(JSON.parse(saved));
        } else {
            console.log('无保存状态');
        }
        console.log('当前内存中的状态:', {
            leftCollapsed: this.leftSidebarCollapsed,
            rightCollapsed: this.rightSidebarCollapsed,
            leftWidth: this.sidebarWidths.left,
            rightWidth: this.sidebarWidths.right
        });
        console.log('DOM元素状态:', {
            leftHasCollapsedClass: this.leftSidebar?.classList.contains('collapsed'),
            rightHasCollapsedClass: this.rightSidebar?.classList.contains('collapsed'),
            leftActualWidth: this.leftSidebar?.style.width,
            rightActualWidth: this.rightSidebar?.style.width,
            leftResizerHidden: document.getElementById('left-resizer')?.classList.contains('hidden'),
            rightResizerHidden: document.getElementById('right-resizer')?.classList.contains('hidden')
        });
        console.log('=== 调试测试结束 ===');
    }

    // 调试工具：强制恢复状态
    debugForceRestore() {
        console.log('=== 强制恢复边栏状态 ===');
        this.restoreState();
        console.log('=== 强制恢复完成 ===');
    }

    // 调试工具：测试拖拽性能
    debugDragPerformance() {
        console.log('=== 拖拽性能信息 ===');
        console.log('当前优化状态:', {
            'requestAnimationFrame': '已启用',
            'CSS transition禁用': '拖拽时禁用',
            'passive事件监听': '已启用',
            '日志输出': '已优化'
        });
        console.log('拖拽优化说明:');
        console.log('1. 拖拽开始时禁用CSS过渡动画');
        console.log('2. 使用requestAnimationFrame防止重复计算');
        console.log('3. 拖拽专用的快速设置方法（无日志）');
        console.log('4. 拖拽结束时恢复过渡动画');
        console.log('5. 使用passive事件监听器');
        console.log('=== 性能测试完成 ===');
    }
}

// 创建全局实例
window.sidebarManager = new SidebarManager();