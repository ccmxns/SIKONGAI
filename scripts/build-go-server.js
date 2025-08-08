const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 开始构建Go服务器...');

// Go服务器目录
const goServerDir = path.join(__dirname, '..', 'go-server');
const outputPath = path.join(goServerDir, 'sikongai-server.exe');

try {
    // 检查Go是否安装
    console.log('📋 检查Go环境...');
    try {
        execSync('go version', { stdio: 'pipe' });
        console.log('✅ Go环境检查通过');
    } catch (error) {
        throw new Error('❌ 未找到Go环境，请先安装Go语言\n下载地址: https://golang.org/dl/');
    }

    // 进入Go服务器目录
    process.chdir(goServerDir);
    console.log(`📁 切换到目录: ${goServerDir}`);

    // 清理旧的可执行文件
    if (fs.existsSync(outputPath)) {
        console.log('🗑️  清理旧的可执行文件...');
        fs.unlinkSync(outputPath);
    }

    // 下载依赖
    console.log('📦 下载Go依赖...');
    execSync('go mod tidy', { stdio: 'inherit' });

    // 构建可执行文件
    console.log('🔨 编译Go服务器...');
    const buildCmd = process.platform === 'win32' 
        ? 'go build -o sikongai-server.exe main.go'
        : 'go build -o sikongai-server main.go';
    
    execSync(buildCmd, { stdio: 'inherit' });

    // 验证构建结果
    if (fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        console.log(`✅ Go服务器构建成功！`);
        console.log(`📏 文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`📍 输出路径: ${outputPath}`);
    } else {
        throw new Error('❌ 构建完成但未找到输出文件');
    }

} catch (error) {
    console.error('❌ Go服务器构建失败:');
    console.error(error.message || error);
    process.exit(1);
} finally {
    // 切换回原目录
    process.chdir(path.join(__dirname, '..'));
}

console.log('🎉 Go服务器构建完成！');
