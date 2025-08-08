const { contextBridge, ipcRenderer } = require('electron');

// 向渲染进程暴露安全的API
contextBridge.exposeInMainWorld('electronAPI', {
  // 主题相关
  getTheme: () => ipcRenderer.invoke('get-theme'),
  onThemeChanged: (callback) => ipcRenderer.on('theme-changed', callback),
  
  // 窗口控制
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
  isMaximized: () => ipcRenderer.invoke('is-maximized'),
  setWindowOpacity: (opacity) => ipcRenderer.send('set-window-opacity', opacity),
  setWindowBlur: (enabled, intensity) => ipcRenderer.send('set-window-blur', enabled, intensity),
  openSettings: () => ipcRenderer.invoke('open-settings'),
  closeSettingsWindow: () => ipcRenderer.invoke('close-settings-window'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('toggle-always-on-top'),
  getAlwaysOnTop: () => ipcRenderer.invoke('get-always-on-top'),
  setWindowOpacityDirect: (opacity) => ipcRenderer.invoke('set-window-opacity', opacity),
  getWindowOpacity: () => ipcRenderer.invoke('get-window-opacity'),
  onRestoreWindowState: (callback) => ipcRenderer.on('restore-window-state', callback),
  
  // 系统托盘
  setSystemTray: (enabled) => ipcRenderer.invoke('set-system-tray', enabled),
  showWindow: () => ipcRenderer.invoke('show-window'),
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  
  // 全局快捷键
  setGlobalHotkey: (setting, hotkey) => ipcRenderer.invoke('set-global-hotkey', setting, hotkey),
  unregisterAllHotkeys: () => ipcRenderer.invoke('unregister-all-hotkeys'),
  
  // 开机启动
  setAutoStart: (enabled, silentMode) => ipcRenderer.invoke('set-auto-start', enabled, silentMode),
  getAutoStartStatus: () => ipcRenderer.invoke('get-auto-start-status'),
  
  // 移除监听器
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  
  // 文件系统操作
  getDesktopPath: () => ipcRenderer.invoke('get-desktop-path'),
  createDirectory: (dirPath) => ipcRenderer.invoke('create-directory', dirPath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  fileExists: (filePath) => ipcRenderer.invoke('file-exists', filePath),
  
  // Go服务器相关
  checkGoServerStatus: () => ipcRenderer.invoke('check-go-server-status'),
  restartGoServer: () => ipcRenderer.invoke('restart-go-server'),
  stopGoServer: () => ipcRenderer.invoke('stop-go-server')
});