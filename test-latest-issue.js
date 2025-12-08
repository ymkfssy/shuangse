// 测试脚本：验证最新期号解析

// 模拟包含最新期号的HTML内容
const html = `
  <div class="lottery-results">
    <table class="lottery-table">
      <tbody>
        <tr>
          <td class="date">2025-12-07</td>
          <td class="issue">第 2025141 期</td>
          <td class="numbers">
            <span class="red">02</span>
            <span class="red">04</span>
            <span class="red">05</span>
            <span class="red">10</span>
            <span class="red">12</span>
            <span class="red">13</span>
            <span class="blue">06</span>
          </td>
        </tr>
        <tr>
          <td class="date">2025-12-04</td>
          <td class="issue">第 2025140 期</td>
          <td class="numbers">01 03 04 12 18 24 05</td>
        </tr>
        <tr>
          <td class="date">2025-12-02</td>
          <td class="issue">第 2025139 期</td>
          <td class="numbers">02 05 17 22 30 33 06</td>
        </tr>
      </tbody>
    </table>
  </div>
`;

// 直接实现简化版的解析函数（用于测试）
function parse17500HTML(html) {
  const results = [];
  
  console.log('开始解析HTML内容');
  console.log('HTML内容长度:', html.length, '字符');
  
  try {
    // 1. 首先提取包含开奖记录的核心内容区域
    const contentMatch = html.match(/<table[^>]*class="[^>]*lottery[^>]*"[^>]*>([\s\S]*?)<\/table>/) || 
                        html.match(/<div[^>]*class="[^>]*lottery[^>]*"[^>]*>([\s\S]*?)<\/div>/) ||
                        html.match(/<table[^>]*>([\s\S]*?)<\/table>/);
    
    if (!contentMatch) {
      console.log('未找到包含开奖记录的表格或div');
      return results;
    }
    
    const content = contentMatch[1];
    console.log('核心内容长度:', content.length, '字符');
    
    // 2. 匹配日期和期号的组合
    const issueDatePattern = /(\d{4}-\d{2}-\d{2})[\s\t]*(?:<[^>]*>)?[\s\t]*第[\s\t]*(?:<[^>]*>)?[\s\t]*(\d{4}\d{3})[\s\t]*(?:<[^>]*>)?[\s\t]*期/g;
    
    let issueMatch;
    let matchCount = 0;
    
    while ((issueMatch = issueDatePattern.exec(content)) !== null) {
      matchCount++;
      
      try {
        const date = issueMatch[1];
        const issue = issueMatch[2];
        
        if (issue.length !== 7) {
          console.log(`跳过不合法期号: ${issue}`);
          continue;
        }
        
        // 3. 从这个匹配位置开始查找号码
        const numbersStartPos = issueDatePattern.lastIndex;
        const numbersSection = content.substring(numbersStartPos, numbersStartPos + 200);
        
        // 匹配号码：支持数字之间的空格、制表符、HTML标签等
        const numbersPattern = /([\d]{1,2})[\s\t]*(?:<[^>]*>)?[\s\t]*([\d]{1,2})[\s\t]*(?:<[^>]*>)?[\s\t]*([\d]{1,2})[\s\t]*(?:<[^>]*>)?[\s\t]*([\d]{1,2})[\s\t]*(?:<[^>]*>)?[\s\t]*([\d]{1,2})[\s\t]*(?:<[^>]*>)?[\s\t]*([\d]{1,2})[\s\t]*(?:<[^>]*>)?[\s\t]*([\d]{1,2})/;
        
        const numbersMatch = numbersSection.match(numbersPattern);
        
        if (!numbersMatch) {
          console.log(`未找到期号 ${issue} 的号码`);
          continue;
        }
        
        // 提取号码并转换为数字
        const numbers = numbersMatch.slice(1).map(Number).filter(n => !isNaN(n));
        
        if (numbers.length === 7) {
          const red = numbers.slice(0, 6).sort((a, b) => a - b);
          const blue = numbers[6];
          
          // 验证号码范围
          const isValidRed = red.every(n => n >= 1 && n <= 33);
          const isValidBlue = blue >= 1 && blue <= 16;
          
          if (isValidRed && isValidBlue) {
            results.push({ issue, red, blue, date });
            console.log(`成功解析: 期号 ${issue}, 日期 ${date}, 开奖号码: ${red.join(' ')} ${blue}`);
          } else {
            console.log(`号码范围验证失败: ${issue} - 红球: ${red}, 蓝球: ${blue}`);
          }
        } else {
          console.log(`号码数量不符合预期: ${issue} - 实际数量: ${numbers.length}`);
        }
        
        // 避免无限循环
        if (issueDatePattern.lastIndex >= content.length - 100) {
          break;
        }
        
      } catch (e) {
        console.error(`解析期号数据失败:`, e);
      }
    }
    
    console.log(`解析完成，共处理 ${matchCount} 个期号，成功解析 ${results.length} 条记录`);
    
    // 按期号降序排序
    results.sort((a, b) => b.issue - a.issue);
    
  } catch (e) {
    console.error('解析过程中发生严重错误:', e);
  }
  
  return results;
}

// 执行测试
console.log('=== 测试开始 ===');
const results = parse17500HTML(html);

console.log('\n=== 测试结果 ===');
console.log(`共解析到 ${results.length} 条记录`);

if (results.length > 0) {
  // 查找最新期号 2025141
  const latestIssue = results.find(item => item.issue === '2025141');
  
  if (latestIssue) {
    console.log('\n找到最新期号数据:');
    console.log(`期号: ${latestIssue.issue}`);
    console.log(`日期: ${latestIssue.date}`);
    console.log(`红球: ${latestIssue.red.join(', ')}`);
    console.log(`蓝球: ${latestIssue.blue}`);
    
    // 验证是否符合预期
    const expectedRed = [2, 4, 5, 10, 12, 13];
    const expectedBlue = 6;
    const expectedDate = '2025-12-07';
    
    const redMatch = JSON.stringify(latestIssue.red.sort((a, b) => a - b)) === JSON.stringify(expectedRed);
    const blueMatch = latestIssue.blue === expectedBlue;
    const dateMatch = latestIssue.date === expectedDate;
    
    console.log('\n验证结果:');
    console.log(`期号正确性: ${latestIssue.issue === '2025141' ? '✓' : '✗'}`);
    console.log(`红球正确性: ${redMatch ? '✓' : '✗'}`);
    console.log(`蓝球正确性: ${blueMatch ? '✓' : '✗'}`);
    console.log(`日期正确性: ${dateMatch ? '✓' : '✗'}`);
    
    if (latestIssue.issue === '2025141' && redMatch && blueMatch && dateMatch) {
      console.log('\n🎉 所有数据解析正确！');
    } else {
      console.log('\n❌ 数据解析存在错误！');
    }
  } else {
    console.log('\n❌ 未找到期号为 2025141 的数据');
    console.log('已解析的期号列表:', results.map(item => item.issue));
  }
}