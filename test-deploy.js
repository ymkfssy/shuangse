// 简单的部署测试脚本
console.log('测试部署配置...');

const fs = require('fs');
const path = require('path');

// 检查关键文件
const requiredFiles = [
  'src/index.js',
  'src/auth.js', 
  'src/lottery.js',
  'src/database.js',
  'wrangler.toml'
];

console.log('\n检查文件完整性:');
requiredFiles.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, file));
  console.log(`${exists ? '✓' : '✗'} ${file}`);
});

// 检查配置
console.log('\n检查wrangler.toml配置:');
const config = fs.readFileSync(path.join(__dirname, 'wrangler.toml'), 'utf8');
console.log('✓ 包含main配置:', config.includes('main = "src/index.js"'));
console.log('✓ 包含数据库配置:', config.includes('[[d1_databases]]'));
console.log('✓ 不包含KV配置:', !config.includes('[[kv_namespaces]]'));

console.log('\n✓ 部署配置检查完成');
console.log('\n请运行以下命令进行部署:');
console.log('1. npm run test  # 测试项目');
console.log('2. npm run deploy # 部署到Cloudflare');