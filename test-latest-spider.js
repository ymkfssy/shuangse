// 测试最新一期爬虫功能
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// 模拟HTML内容，包含最新一期的数据
const mockHTML = `
<!DOCTYPE html>
<html>
<body>
  <div class="lottery">
    <div>2025-01-10    第    2025142    期</div>
    <div class="numbers">
      <span class="red">02</span>
      <span class="red">04</span>
      <span class="red">05</span>
      <span class="red">10</span>
      <span class="red">12</span>
      <span class="red">13</span>
      <span class="blue">06</span>
    </div>
    <div>2025-01-07    第    2025141    期</div>
    <div class="numbers">
      <span class="red">01</span>
      <span class="red">03</span>
      <span class="red">07</span>
      <span class="red">15</span>
      <span class="red">20</span>
      <span class="red">22</span>
      <span class="blue">10</span>
    </div>
  </div>
</body>
</html>
`;

// 导入parse17500HTML函数
const { parse17500HTML } = require('./src/lottery');

console.log('=== 测试爬虫修改 ===');

// 测试HTML解析
const results = parse17500HTML(mockHTML);

console.log('\n解析结果:', results);

// 验证解析结果
if (results.length === 1) {
  const latest = results[0];
  console.log('\n✅ 成功只获取到最新一期数据');
  console.log(`期号: ${latest.issue}`);
  console.log(`日期: ${latest.date}`);
  console.log(`红球（排序后）: ${latest.red.join(' ')}`);
  console.log(`红球（开奖顺序）: ${latest.redOrder.join(' ')}`);
  console.log(`蓝球: ${latest.blue}`);
  
  // 验证是否是最新一期
  if (latest.issue === '2025142') {
    console.log('✅ 正确获取到最新一期（2025142）');
  } else {
    console.log('❌ 未获取到最新一期');
  }
  
  // 验证红球开奖顺序是否正确
  if (latest.redOrder && latest.redOrder.join(' ') === '2 4 5 10 12 13') {
    console.log('✅ 红球开奖顺序正确');
  } else {
    console.log('❌ 红球开奖顺序不正确');
  }
} else {
  console.log(`❌ 解析结果数量不正确，期望1个，实际${results.length}个`);
}

console.log('\n=== 测试完成 ===');
