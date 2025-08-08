const fs = require('fs');
const path = require('path');

// 读取package.json
const packagePath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// 解析当前版本号
const currentVersion = packageJson.version;
const versionParts = currentVersion.split('.').map(Number);

// 增加修订号（第三位数字）
versionParts[2] += 1;

// 生成新版本号
const newVersion = versionParts.join('.');

// 更新package.json
packageJson.version = newVersion;
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));

console.log(`版本号已从 ${currentVersion} 更新为 ${newVersion}`);

// 更新settings.html中的版本显示
const settingsPath = path.join(__dirname, '..', 'src', 'views', 'settings.html');
let settingsContent = fs.readFileSync(settingsPath, 'utf8');

// 使用正则表达式替换版本号
const versionRegex = /<p class="version">版本 \d+\.\d+\.\d+<\/p>/;
const newVersionLine = `<p class="version">版本 ${newVersion}</p>`;

if (versionRegex.test(settingsContent)) {
    settingsContent = settingsContent.replace(versionRegex, newVersionLine);
    fs.writeFileSync(settingsPath, settingsContent);
    console.log(`设置页面中的版本号已更新为 ${newVersion}`);
} else {
    console.log('未找到设置页面中的版本号，可能需要手动更新');
}