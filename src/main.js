const { app, BrowserWindow, ipcMain, nativeTheme, Tray, Menu, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { spawn } = require('child_process');
const windowStateKeeper = require('electron-window-state');

let mainWindow;
let settingsWindow;
let tray;
let registeredHotkeys = new Map(); // 存储已注册的快捷键
let isSilentStart = false; // 是否为静默启动模式
let isQuitting = false; // 是否正在退出应用
let goServerProcess = null; // Go服务器进程

function createWindow() {
  // 加载窗口状态
  let mainWindowState = windowStateKeeper({
    defaultWidth: 1200,
    defaultHeight: 800
  });

  // 创建主窗口
  mainWindow = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    minWidth: 800,
    minHeight: 600,
    frame: false, // 移除默认标题栏
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../ico.png'),
    show: false, // 先不显示，等页面加载完成后再显示
    backgroundColor: '#ffffff'
  });

  // 让窗口状态管理器管理新窗口
  mainWindowState.manage(mainWindow);

  // 加载主页面
  mainWindow.loadFile(path.join(__dirname, 'views/index.html'));

  // 页面加载完成后显示窗口
  mainWindow.once('ready-to-show', () => {
    // 检查是否为静默启动模式
    if (!isSilentStart) {
      mainWindow.show();
    }
    
    // 开发模式下打开开发者工具
    if (process.argv.includes('--dev')) {
      mainWindow.webContents.openDevTools();
    }
    
    // 延迟恢复窗口状态，确保设置管理器已初始化
    setTimeout(() => {
      mainWindow.webContents.send('restore-window-state');
    }, 1000);
  });

  // 监听主题变化
  nativeTheme.on('updated', () => {
    mainWindow.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors);
  });

  // 处理窗口关闭事件
  mainWindow.on('close', (event) => {
    // 如果正在退出应用，允许正常关闭
    if (isQuitting) {
      return;
    }
    
    // 如果托盘存在且未销毁，隐藏窗口而不是关闭
    if (tray && !tray.isDestroyed()) {
      event.preventDefault();
      mainWindow.hide();
      return;
    }
  });

  mainWindow.on('closed', async () => {
    mainWindow = null;
    // 主窗口关闭时也关闭设置窗口
    if (settingsWindow) {
      settingsWindow.close();
    }
    // 销毁托盘
    destroySystemTray();
    
    // 如果没有托盘，主窗口关闭时启动完整清理流程
    if (!tray || tray.isDestroyed()) {
      console.log('主窗口关闭，开始完整清理流程...');
      if (!isQuitting) {
        isQuitting = true;
        try {
          await stopGoServer();
          await clearPort10301();
          console.log('主窗口关闭清理完成');
        } catch (error) {
          console.error('主窗口关闭时清理失败:', error);
        }
      }
    }
  });
}

// 创建设置窗口
function createSettingsWindow() {
  // 如果设置窗口已存在，只需要显示和聚焦
  if (settingsWindow) {
    if (settingsWindow.isMinimized()) {
      settingsWindow.restore();
    }
    settingsWindow.focus();
    return;
  }

  // 创建设置窗口
  settingsWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    frame: false,
    titleBarStyle: 'hidden',
    parent: mainWindow, // 设置为主窗口的子窗口
    modal: false, // 不设置为模态窗口，允许同时操作两个窗口
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../ico.png'),
    show: false,
    backgroundColor: '#ffffff'
  });

  // 加载设置页面
  settingsWindow.loadFile(path.join(__dirname, 'views/settings.html'));

  // 页面加载完成后显示
  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();
  });

  // 窗口关闭时清理引用
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  // 监听主题变化
  nativeTheme.on('updated', () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors);
    }
  });
}

// 创建系统托盘
function createSystemTray() {
  try {
    // 创建托盘图标
    tray = new Tray(path.join(__dirname, '../ico.png'));
    
    // 设置托盘提示文本
    tray.setToolTip('司空AI');
    
    // 创建托盘右键菜单
    const contextMenu = Menu.buildFromTemplate([
      {
        label: '显示主窗口',
        click: () => {
          showMainWindow();
        }
      },
      {
        label: '打开设置',
        click: () => {
          createSettingsWindow();
        }
      },
      { type: 'separator' },
      {
        label: '退出',
        click: async () => {
          console.log('系统托盘退出被点击，开始清理...');
          
          if (!isQuitting) {
            isQuitting = true;
            
            try {
              // 先清理快捷键
              unregisterAllHotkeys();
              
              // 停止Go服务器
              await stopGoServer();
              
              // 清理端口
              await clearPort10301();
              
              // 销毁系统托盘
              destroySystemTray();
              
              console.log('托盘退出清理完成，应用即将退出');
              
              // 使用process.exit()确保完全退出
              process.exit(0);
              
            } catch (error) {
              console.error('托盘退出清理过程中出错:', error);
              process.exit(1);
            }
          }
        }
      }
    ]);
    
    // 设置托盘右键菜单
    tray.setContextMenu(contextMenu);
    
    // 单击托盘图标显示/隐藏主窗口
    tray.on('click', () => {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        showMainWindow();
      }
    });
    
    // 双击托盘图标显示主窗口
    tray.on('double-click', () => {
      showMainWindow();
    });
    
    console.log('系统托盘已创建');
  } catch (error) {
    console.error('创建系统托盘失败:', error);
  }
}

// 销毁系统托盘
function destroySystemTray() {
  if (tray && !tray.isDestroyed()) {
    tray.destroy();
    tray = null;
    console.log('系统托盘已销毁');
  }
}

// 显示主窗口
function showMainWindow() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  }
}

// 隐藏主窗口
function hideMainWindow() {
  if (mainWindow) {
    mainWindow.hide();
  }
}

// 注册全局快捷键
function registerGlobalHotkey(setting, hotkey) {
  try {
    // 如果已存在相同设置的快捷键，先取消注册
    if (registeredHotkeys.has(setting)) {
      const oldHotkey = registeredHotkeys.get(setting);
      if (oldHotkey && globalShortcut.isRegistered(oldHotkey)) {
        globalShortcut.unregister(oldHotkey);
      }
    }
    
    // 如果快捷键为空，只取消注册，不注册新的
    if (!hotkey) {
      registeredHotkeys.delete(setting);
      console.log(`快捷键已取消注册: ${setting}`);
      return { success: true };
    }
    
    // 转换快捷键格式（从设置格式转换为Electron格式）
    const electronHotkey = convertHotkeyFormat(hotkey);
    
    // 检查快捷键是否已被其他应用占用
    if (globalShortcut.isRegistered(electronHotkey)) {
      console.warn(`快捷键已被占用: ${electronHotkey}`);
      return { success: false, error: '快捷键已被其他应用占用' };
    }
    
    // 注册快捷键
    const success = globalShortcut.register(electronHotkey, () => {
      handleHotkeyAction(setting);
    });
    
    if (success) {
      registeredHotkeys.set(setting, electronHotkey);
      console.log(`快捷键注册成功: ${setting} = ${electronHotkey}`);
      return { success: true };
    } else {
      console.error(`快捷键注册失败: ${electronHotkey}`);
      return { success: false, error: '快捷键注册失败' };
    }
  } catch (error) {
    console.error('注册全局快捷键时出错:', error);
    return { success: false, error: error.message };
  }
}

// 转换快捷键格式
function convertHotkeyFormat(hotkey) {
  // 将设置中的格式转换为Electron格式
  // 设置格式: Ctrl+Alt+H
  // Electron格式: CommandOrControl+Alt+H
  return hotkey
    .replace(/Ctrl/g, 'CommandOrControl')
    .replace(/Super/g, process.platform === 'darwin' ? 'Cmd' : 'Super');
}

// 处理快捷键动作
function handleHotkeyAction(setting) {
  try {
    switch (setting) {
      case 'hotkeyToggle':
        // 显示/隐藏窗口切换
        if (mainWindow) {
          if (mainWindow.isVisible() && !mainWindow.isMinimized()) {
            hideMainWindow();
          } else {
            showMainWindow();
          }
        }
        break;
        
      case 'hotkeyShow':
        // 显示窗口
        showMainWindow();
        break;
        
      case 'hotkeyHide':
        // 隐藏窗口
        hideMainWindow();
        break;
        
      default:
        console.warn(`未知的快捷键设置: ${setting}`);
    }
  } catch (error) {
    console.error('处理快捷键动作时出错:', error);
  }
}

// 取消注册所有快捷键
function unregisterAllHotkeys() {
  try {
    registeredHotkeys.forEach((hotkey, setting) => {
      if (globalShortcut.isRegistered(hotkey)) {
        globalShortcut.unregister(hotkey);
        console.log(`快捷键已取消注册: ${setting} = ${hotkey}`);
      }
    });
    registeredHotkeys.clear();
    return { success: true };
  } catch (error) {
    console.error('取消注册快捷键时出错:', error);
    return { success: false, error: error.message };
  }
}

// 检查启动参数
function checkStartupArgs() {
  // 检查是否为静默启动
  if (process.argv.includes('--silent-start') || process.argv.includes('--hidden')) {
    isSilentStart = true;
    console.log('静默启动模式已启用');
  }
}

// 设置开机启动
function setAutoStart(enabled, silentMode = true) {
  try {
    const appPath = app.getPath('exe');
    const appName = app.getName();
    
    if (enabled) {
      // 构建启动参数
      let args = [];
      
      if (silentMode) {
        args.push('--silent-start');
      }
      
      // 设置开机启动
      const success = app.setLoginItemSettings({
        openAtLogin: true,
        path: appPath,
        args: args
      });
      
      console.log(`开机启动已启用: 静默模式=${silentMode}, 参数=${args.join(' ')}`);
      return { success: true, message: '开机启动已启用' };
    } else {
      // 取消开机启动
      app.setLoginItemSettings({
        openAtLogin: false
      });
      
      console.log('开机启动已禁用');
      return { success: true, message: '开机启动已禁用' };
    }
  } catch (error) {
    console.error('设置开机启动失败:', error);
    return { success: false, error: error.message };
  }
}

// 获取开机启动状态
function getAutoStartStatus() {
  try {
    const loginItemSettings = app.getLoginItemSettings();
    return {
      success: true,
      enabled: loginItemSettings.openAtLogin,
      executableWillLaunchAtLogin: loginItemSettings.executableWillLaunchAtLogin,
      launchItems: loginItemSettings.launchItems || []
    };
  } catch (error) {
    console.error('获取开机启动状态失败:', error);
    return { success: false, error: error.message };
  }
}

// 启动Go服务器
function startGoServer() {
  return new Promise(async (resolve, reject) => {
    try {
      // 先清理可能存在的端口占用，避免冲突
      console.log('清理端口占用...');
      try {
        await clearPort10301();
      } catch (e) {
        console.warn('清理端口占用时出错:', e.message);
      }
      // 等待端口释放片刻
      await new Promise(r => setTimeout(r, 1000));
      
      // 优先尝试使用已编译好的 Go 服务器可执行文件（生产或开发均适用）
      const exeName = process.platform === 'win32' ? 'sikongai-server.exe' : 'sikongai-server';
      const fs = require('fs');
      const candidatePaths = [];
      if (process.resourcesPath) {
        candidatePaths.push(
          path.join(process.resourcesPath, 'app.asar.unpacked', 'go-server', exeName),
          path.join(process.resourcesPath, 'go-server', exeName)
        );
      }
      candidatePaths.push(path.join(__dirname, '../go-server', exeName));

      for (const exePath of candidatePaths) {
        if (fs.existsSync(exePath)) {
          console.log('使用编译好的Go服务器二进制:', exePath);
          goServerProcess = spawn(exePath, [], { cwd: path.dirname(exePath), shell: false });
          goServerProcess.stdout.on('data', data => console.log('Go服务器输出:', data.toString()));
          goServerProcess.stderr.on('data', data => console.error('Go服务器错误:', data.toString()));
          goServerProcess.on('error', error => { console.error('Go服务器启动失败:', error); reject(error); });
          goServerProcess.on('close', code => { console.log('Go服务器已退出:', code); goServerProcess = null; });
          // 等待服务器启动后进行健康检查
          setTimeout(() => {
            checkGoServerHealth()
              .then(() => { console.log('Go服务器启动成功！'); resolve(); })
              .catch(err => { console.error('Go服务器健康检查失败:', err); reject(err); });
          }, 3000);
          return; // 已启动可执行文件，后续逻辑无需执行
        }
      }

      const goServerPath = path.join(__dirname, '../go-server');
      const goServerMainFile = path.join(goServerPath, 'main.go');
      
      console.log('正在启动Go服务器...');
      console.log('Go服务器路径:', goServerPath);
      
      // 检查Go服务器文件是否存在
      if (!require('fs').existsSync(goServerMainFile)) {
        console.error('Go服务器文件不存在:', goServerMainFile);
        reject(new Error('Go服务器文件不存在'));
        return;
      }
      
      // 检查是否安装了Go
      const checkGoProcess = spawn('go', ['version'], { 
        cwd: goServerPath,
        shell: true 
      });
      
      checkGoProcess.on('error', (error) => {
        console.error('未找到Go环境:', error);
        reject(new Error('请先安装Go语言环境 (https://golang.org/dl/)'));
      });
      
      checkGoProcess.on('close', (code) => {
        if (code !== 0) {
          console.error('Go版本检查失败');
          reject(new Error('Go语言环境检查失败'));
          return;
        }
        
        console.log('Go环境检查通过，正在下载依赖...');
        
        // 下载Go依赖
        const tidyProcess = spawn('go', ['mod', 'tidy'], {
          cwd: goServerPath,
          shell: true
        });
        
        tidyProcess.on('close', (tidyCode) => {
          if (tidyCode !== 0) {
            console.warn('Go依赖下载可能失败，继续尝试启动服务器...');
          }
          
          // 启动Go服务器
          console.log('正在启动Go HTTP服务器...');
          goServerProcess = spawn('go', ['run', 'main.go'], {
            cwd: goServerPath,
            shell: true
          });
          
          goServerProcess.stdout.on('data', (data) => {
            console.log('Go服务器输出:', data.toString());
          });
          
          goServerProcess.stderr.on('data', (data) => {
            console.error('Go服务器错误:', data.toString());
          });
          
          goServerProcess.on('error', (error) => {
            console.error('Go服务器启动失败:', error);
            reject(error);
          });
          
          goServerProcess.on('close', (code) => {
            if (code !== 0) {
              console.error('Go服务器异常退出，退出码:', code);
            } else {
              console.log('Go服务器已关闭');
            }
            goServerProcess = null;
          });
          
          // 等待服务器启动
          setTimeout(() => {
            checkGoServerHealth()
              .then(() => {
                console.log('Go服务器启动成功！');
                resolve();
              })
              .catch((error) => {
                console.error('Go服务器健康检查失败:', error);
                reject(error);
              });
          }, 3000); // 等待3秒让服务器启动
        });
      });
      
    } catch (error) {
      console.error('启动Go服务器时出错:', error);
      reject(error);
    }
  });
}

// 检查Go服务器健康状态
async function checkGoServerHealth() {
  try {
    const response = await fetch('http://localhost:10301/health');
    if (response.ok) {
      const data = await response.json();
      console.log('Go服务器健康检查通过:', data);
      return true;
    } else {
      throw new Error(`健康检查失败: ${response.status}`);
    }
  } catch (error) {
    throw new Error(`Go服务器连接失败: ${error.message}`);
  }
}

// 停止Go服务器（改进：确保生产环境可正确终止已编译的 exe）
function stopGoServer() {
  return new Promise((resolve) => {
    if (!goServerProcess) {
      return resolve();
    }

    console.log('正在停止Go服务器...');
    const pid = goServerProcess.pid;
    const done = () => {
      if (goServerProcess) {
        goServerProcess.removeAllListeners();
        goServerProcess = null;
      }
      resolve();
    };

    // 如果进程自行退出则直接完成
    goServerProcess.once('close', () => {
      console.log('Go服务器进程已关闭');
      done();
    });

    if (process.platform === 'win32') {
      // Windows 使用 taskkill 终止整个进程树
      const { execFile } = require('child_process');
      execFile('taskkill', ['/F', '/T', '/PID', pid.toString()], (err) => {
        if (err) {
          console.warn('taskkill 执行失败:', err.message);
        }
        // 保险：1 秒后若仍存活则强制 kill
        setTimeout(() => {
          try {
            process.kill(pid, 0); // 检测是否仍存在
            try { process.kill(pid, 'SIGKILL'); } catch (_) {}
          } catch (_) {}
          done();
        }, 1000);
      });
    } else {
      // macOS / Linux
      try { process.kill(pid, 'SIGTERM'); } catch (_) {}
      // 1 秒后若还在则 SIGKILL
      setTimeout(() => {
        try { process.kill(pid, 'SIGKILL'); } catch (_) {}
        done();
      }, 1000);
    }
  });
}

// 清理占用10301端口的进程
async function clearPort10301() {
  try {
    if (process.platform === 'win32') {
      const { spawn } = require('child_process');
      
      console.log('检查端口10301占用情况...');
      
      // 查找占用端口的进程
      const netstat = spawn('netstat', ['-ano'], { stdio: 'pipe' });
      let output = '';
      
      netstat.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      netstat.on('close', (code) => {
        const lines = output.split('\n');
        const port10301Lines = lines.filter(line => line.includes(':10301'));
        
        if (port10301Lines.length > 0) {
          console.log('发现端口10301被占用，正在清理...');
          
          port10301Lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 5) {
              const pid = parts[4];
              if (pid && pid !== '0') {
                console.log(`终止占用端口的进程 PID: ${pid}`);
                spawn('taskkill', ['/F', '/PID', pid], { stdio: 'ignore' });
              }
            }
          });
        } else {
          console.log('端口10301已释放');
        }
      });
    } else {
      // Unix系统使用lsof
      const { exec } = require('child_process');
      exec('lsof -ti :10301', (error, stdout) => {
        if (!error && stdout.trim()) {
          const pids = stdout.trim().split('\n');
          pids.forEach(pid => {
            if (pid) {
              console.log(`终止占用端口的进程 PID: ${pid}`);
              exec(`kill -9 ${pid}`, () => {});
            }
          });
        }
      });
    }
  } catch (error) {
    console.error('清理端口失败:', error);
  }
}

// 应用就绪时创建窗口
app.whenReady().then(async () => {
  checkStartupArgs();
  
  try {
    // 启动Go服务器
    await startGoServer();
    console.log('Go服务器启动完成');
  } catch (error) {
    console.error('Go服务器启动失败:', error);
    // 显示错误提示但不阻止应用启动
  }
  
  createWindow();
  // 默认创建系统托盘
  createSystemTray();
});

// 所有窗口关闭时退出应用（macOS除外）
app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    console.log('所有窗口已关闭，准备退出应用...');
    await stopGoServer();
    isQuitting = true;
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 应用退出前清理
app.on('before-quit', async (event) => {
  console.log('应用即将退出，开始清理... (isQuitting:', isQuitting, ')');
  
  if (!isQuitting) {
    event.preventDefault(); // 暂停退出过程
    isQuitting = true; // 立即设置退出标志
    
    try {
      // 清理快捷键
      unregisterAllHotkeys();
      
      // 停止Go服务器（无论是否有进程引用）
      await stopGoServer();
      
      // 额外的端口清理
      await clearPort10301();
      
      // 销毁系统托盘
      destroySystemTray();
      
      console.log('所有清理工作完成，应用即将退出');
      
      // 清理完成，强制退出
      setTimeout(() => {
        process.exit(0);
      }, 100);
      
    } catch (error) {
      console.error('清理过程中出错:', error);
      // 即使出错也要退出
      setTimeout(() => {
        process.exit(1);
      }, 100);
    }
  } else {
    console.log('清理已完成或正在进行中，允许退出');
  }
});

// IPC 处理器
ipcMain.handle('get-theme', () => {
  return nativeTheme.shouldUseDarkColors;
});

ipcMain.handle('window-minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('window-close', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

// 关闭设置窗口
ipcMain.handle('close-settings-window', () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close();
  }
});

// 打开设置窗口
ipcMain.handle('open-settings', () => {
  createSettingsWindow();
});

// 窗口置顶切换
ipcMain.handle('toggle-always-on-top', () => {
  if (mainWindow) {
    const isAlwaysOnTop = mainWindow.isAlwaysOnTop();
    mainWindow.setAlwaysOnTop(!isAlwaysOnTop);
    return !isAlwaysOnTop;
  }
  return false;
});

// 获取窗口置顶状态
ipcMain.handle('get-always-on-top', () => {
  return mainWindow ? mainWindow.isAlwaysOnTop() : false;
});

// 设置窗口透明度
ipcMain.handle('set-window-opacity', (event, opacity) => {
  if (mainWindow) {
    mainWindow.setOpacity(opacity / 100);
  }
});

// 获取窗口透明度
ipcMain.handle('get-window-opacity', () => {
  return mainWindow ? Math.round(mainWindow.getOpacity() * 100) : 100;
});

ipcMain.handle('is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// 文件系统操作
ipcMain.handle('get-desktop-path', () => {
  return path.join(os.homedir(), 'Desktop');
});

ipcMain.handle('create-directory', async (event, dirPath) => {
  try {
    // 规范化路径，确保路径格式正确
    const normalizedPath = path.normalize(dirPath);
    console.log('创建目录:', normalizedPath);
    
    // 检查目录是否已存在
    try {
      const stats = await fs.stat(normalizedPath);
      if (stats.isDirectory()) {
        console.log('目录已存在:', normalizedPath);
        return { success: true, message: '目录已存在' };
      }
    } catch (statError) {
      // 目录不存在，继续创建
      console.log('目录不存在，准备创建:', normalizedPath);
    }
    
    // 递归创建目录
    await fs.mkdir(normalizedPath, { recursive: true });
    console.log('目录创建成功:', normalizedPath);
    return { success: true, message: '目录创建成功' };
  } catch (error) {
    console.error('创建目录失败:', {
      path: dirPath,
      error: error.message,
      code: error.code
    });
    
    // 提供更友好的错误信息
    let errorMessage = '创建目录失败';
    if (error.code === 'EACCES') {
      errorMessage = '权限不足，无法创建目录';
    } else if (error.code === 'ENOTDIR') {
      errorMessage = '路径中包含非目录文件';
    } else if (error.code === 'ENOENT') {
      errorMessage = '父目录不存在且无法创建';
    }
    
    throw new Error(`${errorMessage}: ${error.message}`);
  }
});

ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    await fs.writeFile(filePath, content, 'utf8');
    return { success: true };
  } catch (error) {
    console.error('写入文件失败:', error);
    throw error;
  }
});

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return { success: true, content };
  } catch (error) {
    console.error('读取文件失败:', error);
    throw error;
  }
});

ipcMain.handle('file-exists', async (event, filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
});

// 设置窗口透明度
ipcMain.on('set-window-opacity', (event, opacity) => {
  try {
    if (mainWindow) {
      // 确保透明度值在有效范围内 (0.1 到 1.0)
      const clampedOpacity = Math.max(0.1, Math.min(1.0, opacity));
      mainWindow.setOpacity(clampedOpacity);
      console.log(`窗口透明度已设置为: ${clampedOpacity}`);
    }
  } catch (error) {
    console.error('设置窗口透明度失败:', error);
  }
});

// 设置窗口模糊效果
ipcMain.on('set-window-blur', (event, enabled, intensity) => {
  try {
    if (mainWindow && process.platform === 'win32') {
      if (enabled) {
        // 在Windows上使用内置的背景材质效果
        mainWindow.setBackgroundMaterial('acrylic');
        console.log(`窗口模糊效果已启用，强度: ${intensity}`);
      } else {
        mainWindow.setBackgroundMaterial('none');
        console.log('窗口模糊效果已禁用');
      }
    } else if (mainWindow && process.platform === 'darwin') {
      // macOS平台使用vibrancy
      if (enabled) {
        mainWindow.setVibrancy('sidebar');
        console.log('macOS窗口模糊效果已启用');
      } else {
        mainWindow.setVibrancy(null);
        console.log('macOS窗口模糊效果已禁用');
      }
    } else {
      console.log('当前平台不支持窗口模糊效果');
    }
  } catch (error) {
    console.error('设置窗口模糊效果失败:', error);
    // 如果内置API不可用，尝试使用传统方法
    console.log('尝试使用传统模糊方法...');
    // 这里可以添加更多的fallback方案
  }
});

// 系统托盘IPC处理器
ipcMain.handle('set-system-tray', (event, enabled) => {
  try {
    if (enabled) {
      if (!tray || tray.isDestroyed()) {
        createSystemTray();
      }
    } else {
      destroySystemTray();
    }
    return { success: true };
  } catch (error) {
    console.error('设置系统托盘失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('show-window', () => {
  showMainWindow();
  return { success: true };
});

ipcMain.handle('hide-window', () => {
  hideMainWindow();
  return { success: true };
});

// 全局快捷键IPC处理器
ipcMain.handle('set-global-hotkey', (event, setting, hotkey) => {
  try {
    const result = registerGlobalHotkey(setting, hotkey);
    return result;
  } catch (error) {
    console.error('设置全局快捷键失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('unregister-all-hotkeys', () => {
  try {
    const result = unregisterAllHotkeys();
    return result;
  } catch (error) {
    console.error('取消注册所有快捷键失败:', error);
    return { success: false, error: error.message };
  }
});

// 开机启动IPC处理器
ipcMain.handle('set-auto-start', (event, enabled, silentMode) => {
  try {
    const result = setAutoStart(enabled, silentMode);
    return result;
  } catch (error) {
    console.error('设置开机启动失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-auto-start-status', () => {
  try {
    const result = getAutoStartStatus();
    return result;
  } catch (error) {
    console.error('获取开机启动状态失败:', error);
    return { success: false, error: error.message };
  }
});

// Go服务器相关IPC处理器
ipcMain.handle('check-go-server-status', async () => {
  try {
    await checkGoServerHealth();
    return { success: true, running: true };
  } catch (error) {
    return { success: false, running: false, error: error.message };
  }
});

ipcMain.handle('restart-go-server', async () => {
  try {
    console.log('重启Go服务器...');
    await stopGoServer(); // 等待停止完成
    await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
    await startGoServer();
    return { success: true, message: 'Go服务器重启成功' };
  } catch (error) {
    console.error('重启Go服务器失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-go-server', async () => {
  try {
    console.log('手动停止Go服务器...');
    await stopGoServer();
    return { success: true, message: 'Go服务器已停止' };
  } catch (error) {
    console.error('停止Go服务器失败:', error);
    return { success: false, error: error.message };
  }
});