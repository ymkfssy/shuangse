// 测试中国福利彩票官网HTML解析功能
const https = require('https');

// 模拟parseCWLHTML函数的实现
function parseCWLHTML(html) {
  console.log('正在解析HTML...');
  console.log('HTML长度:', html.length);
  
  // 查找开奖信息表格
  const tableRegex = /<table[^>]*class="kj_tablelist02"[^>]*>((.|\n)*?)<\/table>/;
  const tableMatch = html.match(tableRegex);
  
  if (!tableMatch || !tableMatch[1]) {
    console.error('❌ 未找到开奖信息表格');
    console.log('HTML内容:', html.substring(0, 1000)); // 输出部分HTML内容以便调试
    return [];
  }
  
  const tableContent = tableMatch[1];
  console.log('找到表格内容，长度:', tableContent.length);
  
  // 提取表格行数据
  const rowRegex = /<tr[^>]*>((.|\n)*?)<\/tr>/g;
  const rows = [...tableContent.matchAll(rowRegex)];
  
  console.log('找到表格行:', rows.length);
  
  const results = [];
  
  // 遍历行数据（跳过表头）
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i][1];
    
    // 提取期号
    const issueRegex = /<td[^>]*class="td_kj_qh"[^>]*>([\d]+)<\/td>/;
    const issueMatch = row.match(issueRegex);
    
    if (!issueMatch) continue;
    
    const issue = issueMatch[1];
    console.log(`处理期号: ${issue}`);
    
    // 提取日期
    const dateRegex = /<td[^>]*class="td_kj_date"[^>]*>([\d]{4}-[\d]{2}-[\d]{2})<\/td>/;
    const dateMatch = row.match(dateRegex);
    
    if (!dateMatch) continue;
    
    const date = dateMatch[1];
    
    // 提取红球
    const redRegex = /<td[^>]*class="td_kj_ball red"[^>]*>([\d]{2})<\/td>/g;
    const redMatches = [...row.matchAll(redRegex)];
    
    if (redMatches.length !== 6) continue;
    
    const redOrder = redMatches.map(match => match[1]);
    const red = [...redOrder].sort((a, b) => a - b);
    
    // 提取蓝球
    const blueRegex = /<td[^>]*class="td_kj_ball blue"[^>]*>([\d]{2})<\/td>/;
    const blueMatch = row.match(blueRegex);
    
    if (!blueMatch) continue;
    
    const blue = blueMatch[1];
    
    results.push({
      issue,
      date,
      redOrder,
      red,
      blue
    });
    
    console.log(`✅ 成功解析: 期号 ${issue}, 日期 ${date}, 红球 ${red}, 蓝球 ${blue}`);
  }
  
  console.log(`\n总共解析到 ${results.length} 条开奖记录`);
  return results;
}

// 测试HTML解析
const htmlSample = `
<table class="kj_tablelist02" cellpadding="0" cellspacing="1" width="100%">
  <tr>
    <td class="td_kj_title">期号</td>
    <td class="td_kj_title">开奖日期</td>
    <td class="td_kj_title">开奖号码</td>
  </tr>
  <tr>
    <td class="td_kj_qh">2024012</td>
    <td class="td_kj_date">2024-01-25</td>
    <td>
      <table class="kj_ball_tab">
        <tr>
          <td class="td_kj_ball red">01</td>
          <td class="td_kj_ball red">02</td>
          <td class="td_kj_ball red">03</td>
          <td class="td_kj_ball red">04</td>
          <td class="td_kj_ball red">05</td>
          <td class="td_kj_ball red">06</td>
          <td class="td_kj_ball blue">07</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td class="td_kj_qh">2024011</td>
    <td class="td_kj_date">2024-01-23</td>
    <td>
      <table class="kj_ball_tab">
        <tr>
          <td class="td_kj_ball red">08</td>
          <td class="td_kj_ball red">09</td>
          <td class="td_kj_ball red">10</td>
          <td class="td_kj_ball red">11</td>
          <td class="td_kj_ball red">12</td>
          <td class="td_kj_ball red">13</td>
          <td class="td_kj_ball blue">14</td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`;

console.log('测试解析示例HTML...');
const results = parseCWLHTML(htmlSample);
console.log('解析结果:', results);

// 尝试从实际网站获取数据
console.log('\n尝试从实际网站获取数据...');
// 直接使用HTTPS协议
const options = {
  hostname: 'www.cwl.gov.cn',
  path: '/ygkj/wqkjgg/',
  method: 'GET',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1'
  },
  // 允许重定向
  followRedirects: true
};

const req = https.request(options, (res) => {
  console.log('状态码:', res.statusCode);
  console.log('响应头:', res.headers);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\n成功获取网站内容，长度:', data.length);
    console.log('HTML内容前500字符:', data.substring(0, 500));
    
    // 尝试解析
    const results = parseCWLHTML(data);
    
    if (results.length > 0) {
      console.log('\n✅ 成功从网站获取并解析数据！');
      console.log('最新的开奖记录:', results[0]);
    } else {
      console.log('\n❌ 未能从网站获取有效数据');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ 请求失败:', error);
});

req.end();

// 另一个测试：尝试直接访问双色球开奖历史页面
setTimeout(() => {
  console.log('\n\n尝试访问双色球开奖历史页面...');
  const ssqOptions = {
    hostname: 'www.cwl.gov.cn',
    path: '/ygkj/wqkjgg/yizhong/ssq/',
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    }
  };
  
  const ssqReq = https.request(ssqOptions, (res) => {
    console.log('状态码:', res.statusCode);
    
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('成功获取双色球页面，长度:', data.length);
      console.log('HTML内容前500字符:', data.substring(0, 500));
      
      // 尝试解析
      const results = parseCWLHTML(data);
      
      if (results.length > 0) {
        console.log('✅ 成功从双色球页面获取并解析数据！');
        console.log('最新的开奖记录:', results[0]);
      } else {
        console.log('❌ 未能从双色球页面获取有效数据');
      }
    });
  });
  
  ssqReq.on('error', (error) => {
    console.error('❌ 请求失败:', error);
  });
  
  ssqReq.end();
}, 2000);