// 端口清理工具
const { spawn, exec } = require('child_process');
const os = require('os');

const PORT = 10301;

function cleanupPort() {
    console.log(`🧹 清理端口 ${PORT} 占用进程...`);
    
    if (os.platform() === 'win32') {
        // Windows系统
        cleanupWindowsPort();
    } else {
        // Unix系统 (macOS, Linux)
        cleanupUnixPort();
    }
}

function cleanupWindowsPort() {
    console.log('🔍 查找占用端口的进程...');
    
    // 使用netstat查找占用端口的进程
    const netstat = spawn('netstat', ['-ano'], { stdio: 'pipe' });
    let output = '';
    
    netstat.stdout.on('data', (data) => {
        output += data.toString();
    });
    
    netstat.on('close', (code) => {
        const lines = output.split('\n');
        const portLines = lines.filter(line => line.includes(`:${PORT}`));
        
        if (portLines.length === 0) {
            console.log(`✅ 端口 ${PORT} 未被占用`);
            return;
        }
        
        console.log(`⚠️  发现 ${portLines.length} 个进程占用端口 ${PORT}`);
        
        const pids = new Set();
        portLines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 5) {
                const pid = parts[4];
                if (pid && pid !== '0' && !isNaN(pid)) {
                    pids.add(pid);
                }
            }
        });
        
        if (pids.size === 0) {
            console.log('❌ 未找到有效的进程ID');
            return;
        }
        
        console.log(`🔥 正在终止 ${pids.size} 个进程...`);
        let killedCount = 0;
        
        pids.forEach(pid => {
            console.log(`   终止进程 PID: ${pid}`);
            
            const kill = spawn('taskkill', ['/F', '/PID', pid], { 
                stdio: ['ignore', 'pipe', 'pipe'] 
            });
            
            kill.on('close', (code) => {
                killedCount++;
                if (code === 0) {
                    console.log(`   ✅ 进程 ${pid} 已终止`);
                } else {
                    console.log(`   ❌ 进程 ${pid} 终止失败`);
                }
                
                if (killedCount === pids.size) {
                    // 所有进程处理完成，等待一下再检查
                    setTimeout(() => {
                        console.log('\n🔄 重新检查端口状态...');
                        verifyPortCleared();
                    }, 1000);
                }
            });
        });
        
        // 额外清理：终止所有go.exe进程
        setTimeout(() => {
            console.log('🧹 清理所有Go进程...');
            spawn('taskkill', ['/F', '/IM', 'go.exe'], { stdio: 'ignore' });
        }, 500);
    });
    
    netstat.on('error', (error) => {
        console.error('❌ 查找进程失败:', error.message);
    });
}

function cleanupUnixPort() {
    console.log('🔍 查找占用端口的进程...');
    
    exec(`lsof -ti :${PORT}`, (error, stdout, stderr) => {
        if (error) {
            if (error.code === 1) {
                console.log(`✅ 端口 ${PORT} 未被占用`);
            } else {
                console.error('❌ 查找进程失败:', error.message);
            }
            return;
        }
        
        const pids = stdout.trim().split('\n').filter(pid => pid.trim());
        
        if (pids.length === 0) {
            console.log(`✅ 端口 ${PORT} 未被占用`);
            return;
        }
        
        console.log(`⚠️  发现 ${pids.length} 个进程占用端口 ${PORT}`);
        console.log('🔥 正在终止进程...');
        
        pids.forEach(pid => {
            console.log(`   终止进程 PID: ${pid}`);
            exec(`kill -9 ${pid}`, (killError) => {
                if (!killError) {
                    console.log(`   ✅ 进程 ${pid} 已终止`);
                } else {
                    console.log(`   ❌ 进程 ${pid} 终止失败:`, killError.message);
                }
            });
        });
        
        setTimeout(() => {
            console.log('\n🔄 重新检查端口状态...');
            verifyPortCleared();
        }, 1000);
    });
}

function verifyPortCleared() {
    if (os.platform() === 'win32') {
        const netstat = spawn('netstat', ['-ano'], { stdio: 'pipe' });
        let output = '';
        
        netstat.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        netstat.on('close', () => {
            const portLines = output.split('\n').filter(line => line.includes(`:${PORT}`));
            if (portLines.length === 0) {
                console.log(`🎉 端口 ${PORT} 已成功清理！`);
            } else {
                console.log(`⚠️  端口 ${PORT} 仍被占用，可能需要重启系统`);
                console.log('占用进程:');
                portLines.forEach(line => console.log('   ', line.trim()));
            }
        });
    } else {
        exec(`lsof -ti :${PORT}`, (error, stdout) => {
            if (error && error.code === 1) {
                console.log(`🎉 端口 ${PORT} 已成功清理！`);
            } else if (stdout.trim()) {
                console.log(`⚠️  端口 ${PORT} 仍被占用:`, stdout.trim());
            } else {
                console.log(`🎉 端口 ${PORT} 已成功清理！`);
            }
        });
    }
}

// 运行清理
if (require.main === module) {
    console.log('🚀 司空AI端口清理工具');
    console.log('====================');
    cleanupPort();
}