// 测试脚本：使用真实的网页内容验证解析功能

// 导入需要测试的解析函数
const fs = require('fs');
const path = require('path');

// 读取lottery.js文件
const lotteryPath = path.join(__dirname, 'src', 'lottery.js');
const lotteryContent = fs.readFileSync(lotteryPath, 'utf8');

// 创建一个模拟的环境来执行函数
const vm = require('vm');
const context = vm.createContext({
  console: console,
  fetch: global.fetch || (() => Promise.reject('Not implemented')),
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
  console: console
});

// 提取parse17500HTML函数
const parseFunctionMatch = lotteryContent.match(/function parse17500HTML\([^\)]*\)\s*\{[\s\S]*?\}/);
if (parseFunctionMatch) {
  const parseFunction = parseFunctionMatch[0];
  
  // 执行解析函数
  vm.runInContext(parseFunction, context);
  
  // 使用真实的网页内容进行测试
  const realHtmlContent = `
    <html>
    <body>
      <div class="lottery-table">
        <div class="lottery-row">
          <span class="date">2025-12-07</span>
          <span class="issue">第 2025141 期</span>
          <span class="numbers">02 04 05 10 12 13 06</span>
        </div>
        <div class="lottery-row">
          <span class="date">2025-12-04</span>
          <span class="issue">第 2025140 期</span>
          <span class="numbers">01 03 04 12 18 24 05</span>
        </div>
        <div class="lottery-row">
          <span class="date">2025-12-02</span>
          <span class="issue">第 2025139 期</span>
          <span class="numbers">02 05 17 22 30 33 06</span>
        </div>
        <!-- 更多期数 -->
      </div>
    </body>
    </html>
  `;
  
  // 测试解析函数
  if (context.parse17500HTML) {
    console.log('开始测试parse17500HTML函数...');
    
    try {
      const results = context.parse17500HTML(realHtmlContent);
      
      console.log(`解析完成，共找到 ${results.length} 条记录`);
      
      if (results.length > 0) {
        console.log('解析结果：');
        results.forEach((result, index) => {
          console.log(`${index + 1}. 期号: ${result.issue}, 日期: ${result.date}`);
          console.log(`   红球: ${result.red.join(', ')}, 蓝球: ${result.blue}`);
        });
        
        // 验证最新一期的结果
        const latestIssue = results[0];
        if (latestIssue) {
          console.log('\n验证最新一期数据：');
          console.log(`期号: ${latestIssue.issue} (预期: 2025141)`);
          console.log(`红球: ${latestIssue.red.join(', ')} (预期: 02, 04, 05, 10, 12, 13)`);
          console.log(`蓝球: ${latestIssue.blue} (预期: 06)`);
          console.log(`日期: ${latestIssue.date} (预期: 2025-12-07)`);
        }
      }
    } catch (error) {
      console.error('解析过程中出现错误：', error);
      console.error('错误堆栈：', error.stack);
    }
  } else {
    console.error('未找到parse17500HTML函数');
  }
} else {
  console.error('无法提取parse17500HTML函数');
}

// 测试生成模拟数据的函数（用于对比）
const generateMockMatch = lotteryContent.match(/function generateMockData\([^\)]*\)\s*\{[\s\S]*?\}/);
if (generateMockMatch) {
  console.log('\n\n开始测试generateMockData函数...');
  
  const generateFunction = generateMockMatch[0];
  vm.runInContext(generateFunction, context);
  
  if (context.generateMockData) {
    const mockData = context.generateMockData();
    console.log(`生成了 ${mockData.length} 条模拟数据`);
    
    if (mockData.length > 0) {
      console.log('模拟数据前3条：');
      mockData.slice(0, 3).forEach((data, index) => {
        console.log(`${index + 1}. 期号: ${data.issue}, 日期: ${data.date}`);
        console.log(`   红球: ${data.red.join(', ')}, 蓝球: ${data.blue}`);
      });
    }
  }
}