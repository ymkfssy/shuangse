// 测试从中国福利彩票官网获取数据的功能
const { tryOfficialAPI } = require('./src/lottery.js');

async function testCrawl() {
  console.log('开始测试从中国福利彩票官网获取数据...');
  
  try {
    const results = await tryOfficialAPI();
    console.log('获取结果:', JSON.stringify(results, null, 2));
    
    if (results.length > 0) {
      console.log('✅ 成功获取到数据');
      console.log('期号:', results[0].issue);
      console.log('日期:', results[0].date);
      console.log('红球顺序:', results[0].redOrder);
      console.log('红球排序:', results[0].red);
      console.log('蓝球:', results[0].blue);
    } else {
      console.log('❌ 未能获取到数据');
    }
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

testCrawl();