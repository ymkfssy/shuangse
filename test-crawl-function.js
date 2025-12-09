// 直接测试crawlHistoryNumbers函数，绕过HTTP接口的身份验证限制
const { crawlHistoryNumbers } = require('./src/lottery.js');
const { initDatabase } = require('./src/database.js');

// 模拟环境变量
const mockEnv = {
  DB: null, // 将在初始化后设置
  ENVIRONMENT: 'production'
};

// 模拟请求对象
const mockRequest = {
  url: 'http://localhost:8787/api/crawl'
};

async function testCrawl() {
  console.log('开始测试爬取功能...');
  
  try {
    // 初始化数据库
    await initDatabase(mockEnv);
    
    // 调用爬取函数
    const mockCtx = {}; // 模拟上下文
    const result = await crawlHistoryNumbers(mockRequest, mockEnv, mockCtx);
    
    console.log('爬取结果:', result);
    
  } catch (error) {
    console.error('测试失败:', error);
  }
}

testCrawl();