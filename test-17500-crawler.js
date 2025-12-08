// 测试脚本：验证6.17500.cn爬虫功能

// 模拟Cloudflare Workers环境
const mockEnv = {
  DB: {
    prepare: () => ({
      bind: () => ({
        all: () => Promise.resolve({ results: [] }),
        first: () => Promise.resolve({ count: 0 }),
        run: () => Promise.resolve({})
      })
    })
  }
};

// 模拟fetch函数
const originalFetch = global.fetch;
global.fetch = async (url, options) => {
  console.log(`模拟请求: ${url}`);
  console.log(`请求头: ${JSON.stringify(options.headers)}`);
  
  // 返回模拟的HTML响应
  return {
    ok: true,
    text: async () => {
      // 模拟6.17500.cn的HTML内容
      return `
        <html>
        <body>
          <div class="lottery-results">
            <div>2025-12-07  第 2025141 期  02 04 05 10 12 13 06</div>
            <div>2025-12-04  第 2025140 期  01 03 04 12 18 24 05</div>
            <div>2025-12-02  第 2025139 期  02 05 17 22 30 33 06</div>
            <div>2025-11-30  第 2025138 期  10 13 14 23 24 27 15</div>
            <div>2025-11-27  第 2025137 期  02 08 11 23 27 29 05</div>
          </div>
        </body>
        </html>
      `;
    }
  };
};

// 导入需要测试的函数
const fs = require('fs');
const path = require('path');

// 读取并执行lottery.js文件，提取需要的函数
const lotteryPath = path.join(__dirname, 'src', 'lottery.js');
const lotteryContent = fs.readFileSync(lotteryPath, 'utf8');

// 创建一个模拟的环境来执行函数
const vm = require('vm');
const context = vm.createContext({
  console: console,
  fetch: global.fetch,
  Promise: Promise,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  Array: Array,
  Number: Number,
  Math: Math,
  JSON: JSON,
  Date: Date,
  String: String,
  RegExp: RegExp,
  isNaN: isNaN,
  // 模拟export函数
  exports: {}
});

// 替换export语句以便在Node.js环境中运行
const modifiedContent = lotteryContent
  .replace(/export async function/g, 'async function')
  .replace(/export function/g, 'function');

// 执行代码
vm.runInContext(modifiedContent, context);

// 测试解析函数
const parse17500HTML = context.parse17500HTML;
if (parse17500HTML) {
  console.log('测试parse17500HTML函数...');
  
  const mockHtml = `
    <html>
    <body>
      <div class="lottery-results">
        <div>2025-12-07  第 2025141 期  02 04 05 10 12 13 06</div>
        <div>2025-12-04  第 2025140 期  01 03 04 12 18 24 05</div>
      </div>
    </body>
    </html>
  `;
  
  const results = parse17500HTML(mockHtml);
  console.log('解析结果:', JSON.stringify(results, null, 2));
} else {
  console.error('未找到parse17500HTML函数');
}

// 恢复原始fetch函数
global.fetch = originalFetch;

console.log('测试完成！');