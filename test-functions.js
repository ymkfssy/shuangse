// 简单的测试脚本，用于验证核心功能
const fs = require('fs');
const path = require('path');

console.log('测试双色球系统核心功能...');

// 验证文件结构
const requiredFiles = [
  'src/index.js',
  'src/auth.js',
  'src/lottery.js',
  'src/database.js',
  'wrangler.toml',
  'package.json',
  'public/login.html',
  'public/app.html'
];

console.log('\n1. 验证文件结构:');
let allFilesExist = true;
requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  const exists = fs.existsSync(filePath);
  console.log(`${exists ? '✓' : '✗'} ${file}`);
  if (!exists) allFilesExist = false;
});

if (allFilesExist) {
  console.log('所有必要文件均存在');
} else {
  console.log('缺少必要文件');
}

// 验证wrangler配置
console.log('\n2. 验证wrangler.toml配置:');
const wranglerConfig = fs.readFileSync(path.join(__dirname, 'wrangler.toml'), 'utf8');

const hasName = wranglerConfig.includes('name = "shuangse-lottery"');
const hasMain = wranglerConfig.includes('main = "src/index.js"');
const hasSite = wranglerConfig.includes('[site]');
const hasD1 = wranglerConfig.includes('[[d1_databases]]');
const hasKV = wranglerConfig.includes('[[kv_namespaces]]');

console.log(`${hasName ? '✓' : '✗'} 项目名称配置`);
console.log(`${hasMain ? '✓' : '✗'} 主入口文件配置`);
console.log(`${hasSite ? '✓' : '✗'} 静态资源配置`);
console.log(`${hasD1 ? '✓' : '✗'} D1数据库配置`);
console.log(`${hasKV ? '✓' : '✗'} KV存储配置`);

// 验证代码修复
console.log('\n3. 验证代码修复:');
const lotteryCode = fs.readFileSync(path.join(__dirname, 'src/lottery.js'), 'utf8');
const hasCrawlParams = lotteryCode.includes('export async function crawlHistoryNumbers(request, env)');
const hasOptionalEnv = lotteryCode.includes('const currentEnv = env || request?.env');

console.log(`${hasCrawlParams ? '✓' : '✗'} crawlHistoryNumbers函数参数修复`);
console.log(`${hasOptionalEnv ? '✓' : '✗'} 环境变量安全访问修复`);

console.log('\n测试完成！');
console.log('\n下一步建议:');
console.log('1. 替换wrangler.toml中的占位符为实际的数据库和KV ID');
console.log('2. 运行 `npx wrangler login` 登录Cloudflare账号');
console.log('3. 运行 `npx wrangler d1 create shuangse-lottery-db` 创建D1数据库');
console.log('4. 运行 `npx wrangler kv:namespace create SESSION_KV` 创建KV命名空间');
console.log('5. 运行 `npm run deploy` 部署到Cloudflare');
