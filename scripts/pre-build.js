const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 开始预构建流程...');

// 1. 构建Go服务器
console.log('\n=== 第1步: 构建Go服务器 ===');
try {
    require('./build-go-server');
} catch (error) {
    console.error('❌ Go服务器构建失败，终止构建流程');
    process.exit(1);
}

// 2. 更新版本号
console.log('\n=== 第2步: 更新版本号 ===');
try {
    require('./version-bump');
} catch (error) {
    console.error('❌ 版本号更新失败，但继续构建流程');
    console.error(error.message);
}

// 3. 清理临时文件
console.log('\n=== 第3步: 清理临时文件 ===');
try {
    const distDir = path.join(__dirname, '..', 'dist');
    if (fs.existsSync(distDir)) {
        console.log('🗑️  清理旧的构建输出...');
        fs.rmSync(distDir, { recursive: true, force: true });
        console.log('✅ 清理完成');
    }
} catch (error) {
    console.warn('⚠️  清理临时文件失败，但继续构建流程');
    console.warn(error.message);
}

console.log('\n🎉 预构建流程完成！');
console.log('📦 准备开始Electron构建...\n');
