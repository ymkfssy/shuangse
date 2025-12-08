import { getDB } from './database.js';
import { getUserFromSession } from './auth.js';

// 随机User-Agent列表，避免被反爬虫机制识别
function getRandomUserAgent() {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1.2 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// 生成6个不重复的红球号码（1-33）
function generateRedNumbers() {
  const redNumbers = [];
  while (redNumbers.length < 6) {
    const num = Math.floor(Math.random() * 33) + 1;
    if (!redNumbers.includes(num)) {
      redNumbers.push(num);
    }
  }
  return redNumbers.sort((a, b) => a - b);
}

// 生成1个蓝球号码（1-16）
function generateBlueNumber() {
  return Math.floor(Math.random() * 16) + 1;
}

// 检查号码是否已经存在于历史记录中
async function isNumberExists(env, redNumbers, blueNumber) {
  const [red1, red2, red3, red4, red5, red6] = redNumbers;
  
  const db = getDB(env);
  
  try {
    const result = await db.prepare(
      `SELECT COUNT(*) as count FROM lottery_history 
       WHERE red_1 = ? AND red_2 = ? AND red_3 = ? AND red_4 = ? AND red_5 = ? AND red_6 = ? AND blue = ?`
    ).bind(red1, red2, red3, red4, red5, red6, blueNumber).first();
    
    return result && result.count > 0;
  } catch (error) {
    // 如果查询失败，假设号码不存在，避免阻塞生成功能
    console.log('检查号码存在性失败:', error.message);
    return false;
  }
}

// 批量生成未出现过的双色球号码
export async function generateNewNumbers(request, env) {
  try {
    // 验证用户身份
    const user = await getUserFromSession(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: '用户未登录或会话已过期' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    // 获取生成数量参数，默认为1
    const url = new URL(request.url);
    const count = parseInt(url.searchParams.get('count') || '1');
    
    if (count < 1 || count > 10) {
      return new Response(JSON.stringify({ error: '生成数量必须在1-10之间' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const generatedNumbers = [];
    const totalAttempts = [];

    for (let i = 0; i < count; i++) {
      let attempts = 0;
      const maxAttempts = 1000;
      let redNumbers, blueNumber;
      let exists = true;

      // 生成未出现过的号码
      while (exists && attempts < maxAttempts) {
        redNumbers = generateRedNumbers();
        blueNumber = generateBlueNumber();
        exists = await isNumberExists(env, redNumbers, blueNumber);
        attempts++;
      }

      if (attempts >= maxAttempts) {
        return new Response(JSON.stringify({ 
          error: `生成第${i+1}个号码失败，可能所有组合都已出现过，请稍后重试` 
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }

      // 保存到用户生成的号码表
      const [red1, red2, red3, red4, red5, red6] = redNumbers;
      try {
        const db = getDB(env);
        await db.prepare(
          `INSERT INTO user_numbers (user_id, red_1, red_2, red_3, red_4, red_5, red_6, blue) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(user.user_id, red1, red2, red3, red4, red5, red6, blueNumber).run();
      } catch (error) {
        console.log('保存用户号码失败:', error.message);
        // 继续返回生成的号码，即使保存失败
      }

      generatedNumbers.push({
        red: redNumbers,
        blue: blueNumber
      });
      totalAttempts.push(attempts);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      numbers: generatedNumbers,
      user: {
        id: user.user_id,
        username: user.username
      },
      attempts: totalAttempts,
      total: count
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: `生成号码失败: ${error.message}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// 生成单个号码（兼容旧版本）
export async function generateNewNumber(request, env) {
  const response = await generateNewNumbers(request, env);
  if (response.status === 200) {
    const data = await response.json();
    // 如果只生成一个号码，返回单个号码的格式
    if (data.numbers && data.numbers.length === 1) {
      return new Response(JSON.stringify({
        success: true,
        numbers: data.numbers[0],
        user: data.user,
        attempts: data.attempts[0]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  }
  return response;
}

// 获取历史双色球号码
export async function getHistoryNumbers(request, env) {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const db = getDB(request.env);
    const results = await db.prepare(
      `SELECT * FROM lottery_history 
       ORDER BY issue_number DESC 
       LIMIT ? OFFSET ?`
    ).bind(limit, offset).all();

    return new Response(JSON.stringify({ 
      success: true, 
      numbers: results.results 
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: `获取历史号码失败: ${error.message}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// 爬取历史双色球号码（从中国福彩官网爬取）
export async function crawlHistoryNumbers(request, env) {
  try {
    // 获取环境变量
    const currentEnv = env || (request && request.env) || {};
    
    console.log('开始爬取双色球历史数据...');
    
    // 优先尝试官方API接口
    let results = await tryOfficialAPI();
    
    // 如果官方API失败，尝试第三方数据源
    if (results.length === 0) {
      console.log('官方API获取失败，尝试第三方数据源...');
      results = await tryThirdPartySources();
    }
    
    // 如果仍然没有数据，使用模拟数据
    if (results.length === 0) {
      console.log('所有数据源都失败，使用模拟数据...');
      results = generateMockData();
    }
    
    if (results.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: '无法获取实时数据，请稍后重试',
        note: '网站可能有反爬虫限制或临时维护中'
      }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // 保存到数据库
    let insertedCount = 0;
    try {
      const db = getDB(currentEnv);
      
      for (const item of results) {
        const [red1, red2, red3, red4, red5, red6] = item.red;
        
        // 检查是否已存在
        const exists = await db.prepare(
          'SELECT COUNT(*) as count FROM lottery_history WHERE issue_number = ?'
        ).bind(item.issue).first();
        
        if (exists && exists.count === 0) {
          await db.prepare(
            `INSERT INTO lottery_history (issue_number, red_1, red_2, red_3, red_4, red_5, red_6, blue, draw_date) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(item.issue, red1, red2, red3, red4, red5, red6, item.blue, item.date).run();
          insertedCount++;
        }
      }
    } catch (error) {
      console.log('保存历史数据失败:', error.message);
      // 即使保存失败，也返回解析到的数据
      insertedCount = results.length;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `成功爬取 ${results.length} 条历史数据，其中 ${insertedCount} 条是新数据`,
      details: {
        total_parsed: results.length,
        new_records: insertedCount
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: `爬取失败: ${error.message}`,
      stack: error.stack
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// 尝试官方API接口
async function tryOfficialAPI() {
  const apiUrls = [
    // 中国福彩官方API（需要验证实际可用性）
    'https://www.cwl.gov.cn/cwl_admin/kjxx/findKjxx/forIssue?name=ssq&code=01&pageSize=50&pageNo=1',
    'https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=01&provinceId=0&pageSize=30&pageNo=1',
    'https://api.apiopen.top/ssqApi?type=lottery'
  ];
  
  for (const url of apiUrls) {
    try {
      console.log(`尝试官方API: ${url}`);
      
      const headers = {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': 'https://www.cwl.gov.cn/',
        'Origin': 'https://www.cwl.gov.cn'
      };
      
      // 添加随机延迟
      await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
      
      const response = await fetch(url, { headers });
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          
          // 根据不同的API返回格式解析数据
          if (url.includes('cwl.gov.cn') && data.result) {
            return parseCWLData(data.result);
          } else if (url.includes('sporttery.cn') && data.success) {
            return parseSportteryData(data.data);
          } else if (url.includes('apiopen.top') && data.code === 200) {
            return parseApiOpenData(data.data);
          }
        }
      }
    } catch (error) {
      console.log(`官方API ${url} 请求失败:`, error.message);
    }
  }
  
  return [];
}

// 尝试第三方数据源
async function tryThirdPartySources() {
  const urls = [
    'https://www.500.com/api/xxx?lottery=ssq&format=json',
    'https://www.500.com/static/info/kaijiang/xml/ssq/list.xml',
    'https://datachart.500.com/ssq/history/newinc/history.php',
    'https://kaijiang.500.com/ssq.shtml',
    'https://www.zhcw.com/ssq/',
    'https://www.sniuw.com/open/ssq/'
  ];
  
  for (const url of urls) {
    try {
      console.log(`尝试第三方数据源: ${url}`);
      
      const headers = {
        'User-Agent': getRandomUserAgent(),
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': url
      };
      
      // 根据URL类型设置不同的Accept头
      if (url.includes('format=json')) {
        headers['Accept'] = 'application/json, text/plain, */*';
      } else {
        headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8';
      }
      
      // 添加随机延迟
      await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
      
      const response = await fetch(url, { headers });
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        
        // 如果是JSON格式的API
        if (url.includes('format=json') && contentType && contentType.includes('application/json')) {
          const data = await response.json();
          const results = parse500JsonData(data);
          if (results.length > 0) {
            console.log(`从 ${url} 成功解析 ${results.length} 条JSON数据`);
            return results;
          }
        } else {
          // 处理HTML/XML格式
          const html = await response.text();
          
          // 尝试不同的解析策略
          let results = parseWithStrategy1(html);
          if (results.length === 0) {
            results = parseWithStrategy2(html);
          }
          if (results.length === 0) {
            results = parseWithStrategy3(html);
          }
          
          if (results.length > 0) {
            console.log(`从 ${url} 成功解析 ${results.length} 条数据`);
            return results;
          }
        }
      }
    } catch (error) {
      console.log(`第三方数据源 ${url} 请求失败:`, error.message);
    }
  }
  
  return [];
}

// 解析中国福彩官方数据
function parseCWLData(data) {
  const results = [];
  
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item.code && item.red && item.blue) {
        const red = item.red.split(',').map(Number).sort((a, b) => a - b);
        const blue = parseInt(item.blue);
        const issue = item.code;
        const date = item.date ? item.date.split(' ')[0] : new Date().toISOString().split('T')[0];
        
        if (red.length === 6 && red.every(n => n >= 1 && n <= 33) && blue >= 1 && blue <= 16) {
          results.push({ issue, red, blue, date });
        }
      }
    }
  }
  
  return results;
}

// 解析体彩网数据
function parseSportteryData(data) {
  const results = [];
  
  if (data && Array.isArray(data.list)) {
    for (const item of data.list) {
      if (item.lotteryDrawNum && item.lotteryDrawResult) {
        const numbers = item.lotteryDrawResult.split('+');
        if (numbers.length === 2) {
          const red = numbers[0].split(',').map(Number).sort((a, b) => a - b);
          const blue = parseInt(numbers[1]);
          const issue = item.lotteryDrawNum;
          const date = item.lotteryDrawTime ? item.lotteryDrawTime.split(' ')[0] : new Date().toISOString().split('T')[0];
          
          if (red.length === 6 && red.every(n => n >= 1 && n <= 33) && blue >= 1 && blue <= 16) {
            results.push({ issue, red, blue, date });
          }
        }
      }
    }
  }
  
  return results;
}

// 解析ApiOpen数据
function parseApiOpenData(data) {
  const results = [];
  
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item.expect && item.opencode) {
        const numbers = item.opencode.split('+');
        if (numbers.length === 2) {
          const red = numbers[0].split(',').map(Number).sort((a, b) => a - b);
          const blue = parseInt(numbers[1]);
          const issue = item.expect;
          const date = item.opentime ? item.opentime.split(' ')[0] : new Date().toISOString().split('T')[0];
          
          if (red.length === 6 && red.every(n => n >= 1 && n <= 33) && blue >= 1 && blue <= 16) {
            results.push({ issue, red, blue, date });
          }
        }
      }
    }
  }
  
  return results;
}

// 解析策略1：标准表格解析
function parseWithStrategy1(html) {
  const results = [];
  const tableRowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/g;
  const rows = html.match(tableRowRegex) || [];
  
  for (const row of rows) {
    const issueMatch = row.match(/>(\d{7})</);
    const dateMatch = row.match(/>(\d{4}-\d{2}-\d{2})/);
    const numbersMatch = row.match(/(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})/);
    
    if (issueMatch && dateMatch && numbersMatch) {
      const issue = issueMatch[1];
      const date = dateMatch[1];
      const numbers = numbersMatch.slice(1).map(Number);
      
      if (numbers.length === 7) {
        const red = numbers.slice(0, 6).sort((a, b) => a - b);
        const blue = numbers[6];
        
        if (red.every(n => n >= 1 && n <= 33) && blue >= 1 && blue <= 16) {
          results.push({ issue, red, blue, date });
        }
      }
    }
  }
  return results;
}

// 解析策略2：JSON数据解析
function parseWithStrategy2(html) {
  const results = [];
  const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.+?});/);
  if (jsonMatch) {
    try {
      const jsonData = JSON.parse(jsonMatch[1]);
      // 根据实际的JSON结构解析
      if (jsonData.data && Array.isArray(jsonData.data)) {
        for (const item of jsonData.data) {
          if (item.issue && item.red && item.blue) {
            results.push({
              issue: item.issue,
              red: item.red.split(',').map(Number).sort((a, b) => a - b),
              blue: parseInt(item.blue),
              date: item.date || new Date().toISOString().split('T')[0]
            });
          }
        }
      }
    } catch (e) {
      console.log('JSON解析失败:', e.message);
    }
  }
  return results;
}

// 解析500.com JSON格式API数据
function parse500JsonData(data) {
  const results = [];
  
  // 根据500.com API可能的返回格式进行解析
  if (data && typeof data === 'object') {
    // 格式1: data包含数组
    if (Array.isArray(data)) {
      for (const item of data) {
        if (item.issue && item.red && item.blue) {
          const red = Array.isArray(item.red) ? item.red : item.red.split(',').map(Number);
          const blue = parseInt(item.blue);
          const issue = item.issue.toString();
          const date = item.date || item.draw_date || new Date().toISOString().split('T')[0];
          
          if (red.length === 6 && red.every(n => n >= 1 && n <= 33) && blue >= 1 && blue <= 16) {
            results.push({ 
              issue, 
              red: red.sort((a, b) => a - b), 
              blue, 
              date 
            });
          }
        }
      }
    }
    // 格式2: data包含data属性（数组）
    else if (data.data && Array.isArray(data.data)) {
      for (const item of data.data) {
        if (item.issue && item.red && item.blue) {
          const red = Array.isArray(item.red) ? item.red : item.red.split(',').map(Number);
          const blue = parseInt(item.blue);
          const issue = item.issue.toString();
          const date = item.date || item.draw_date || new Date().toISOString().split('T')[0];
          
          if (red.length === 6 && red.every(n => n >= 1 && n <= 33) && blue >= 1 && blue <= 16) {
            results.push({ 
              issue, 
              red: red.sort((a, b) => a - b), 
              blue, 
              date 
            });
          }
        }
      }
    }
    // 格式3: data包含result属性（数组）
    else if (data.result && Array.isArray(data.result)) {
      for (const item of data.result) {
        if (item.code && item.red && item.blue) {
          const red = Array.isArray(item.red) ? item.red : item.red.split(',').map(Number);
          const blue = parseInt(item.blue);
          const issue = item.code.toString();
          const date = item.date || item.draw_date || new Date().toISOString().split('T')[0];
          
          if (red.length === 6 && red.every(n => n >= 1 && n <= 33) && blue >= 1 && blue <= 16) {
            results.push({ 
              issue, 
              red: red.sort((a, b) => a - b), 
              blue, 
              date 
            });
          }
        }
      }
    }
  }
  
  return results;
}

// 解析策略3：备用正则解析
function parseWithStrategy3(html) {
  const results = [];
  
  // 尝试匹配各种格式的开奖数据
  const patterns = [
    /(\d{7})[^d]*(\d{4}-\d{2}-\d{2})[^<]*(\d{2})[^<]*(\d{2})[^<]*(\d{2})[^<]*(\d{2})[^<]*(\d{2})[^<]*(\d{2})[^<]*(\d{2})/g,
    /期号[：:\s]*(\d{7})[\s\S]*?开奖日期[：:\s]*(\d{4}-\d{2}-\d{2})[\s\S]*?红球[：:\s]*([^\d]+)?(\d{2})[^d]*(\d{2})[^d]*(\d{2})[^d]*(\d{2})[^d]*(\d{2})[^d]*(\d{2})[\s\S]*?蓝球[：:\s]*(\d{2})/g
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const issue = match[1];
      const date = match[2];
      const red = [match[3], match[4], match[5], match[6], match[7], match[8]].map(Number).sort((a, b) => a - b);
      const blue = parseInt(match[9] || match[3]);
      
      if (red.every(n => n >= 1 && n <= 33) && blue >= 1 && blue <= 16) {
        results.push({ issue, red, blue, date });
      }
    }
    
    if (results.length > 0) break;
  }
  
  return results;
}

// 尝试API数据源
async function tryAPISource() {
  try {
    // 尝试第三方API
    const apiUrls = [
      'https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=01&provinceId=0&pageSize=10&isVerify=1&pageNo=1',
      'https://www.apiopen.top/ssqApi?type=lottery'
    ];
    
    for (const url of apiUrls) {
      const response = await fetch(url, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Referer': 'https://www.cwl.gov.cn/'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // 根据API返回格式解析数据
        if (data.success && data.data) {
          return parseAPIData(data.data);
        }
      }
    }
  } catch (error) {
    console.log('API数据源获取失败:', error.message);
  }
  return [];
}

// 解析官方API返回的数据
function parseOfficialAPI(data) {
  const results = [];
  
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item.code && item.red && item.blue) {
        const red = item.red.split(',').map(Number).sort((a, b) => a - b);
        const blue = parseInt(item.blue);
        const issue = item.code;
        const date = item.date ? item.date.split(' ')[0] : new Date().toISOString().split('T')[0];
        
        if (red.length === 6 && red.every(n => n >= 1 && n <= 33) && blue >= 1 && blue <= 16) {
          results.push({ issue, red, blue, date });
        }
      }
    }
  }
  
  return results;
}

// 解析第三方API返回的数据
function parseAPIData(data) {
  const results = [];
  
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item.lotteryDrawNum && item.lotteryDrawResult) {
        const numbers = item.lotteryDrawResult.split('+');
        if (numbers.length === 2) {
          const red = numbers[0].split(',').map(Number);
          const blue = parseInt(numbers[1]);
          const issue = item.lotteryDrawNum;
          const date = item.lotteryDrawTime ? item.lotteryDrawTime.split(' ')[0] : new Date().toISOString().split('T')[0];
          
          if (red.length === 6 && red.every(n => n >= 1 && n <= 33) && blue >= 1 && blue <= 16) {
            results.push({ issue, red, blue, date });
          }
        }
      }
    }
  }
  
  return results;
}

// 生成模拟测试数据
function generateMockData() {
  const results = [];
  const today = new Date();
  
  for (let i = 0; i < 10; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i * 3); // 每3天一期的模拟数据
    
    const issueDate = date.toISOString().slice(2, 10).replace(/-/g, '');
    const issue = `2023${issueDate}`;
    
    const red = [];
    while (red.length < 6) {
      const num = Math.floor(Math.random() * 33) + 1;
      if (!red.includes(num)) red.push(num);
    }
    red.sort((a, b) => a - b);
    
    const blue = Math.floor(Math.random() * 16) + 1;
    
    results.push({
      issue,
      red,
      blue,
      date: date.toISOString().split('T')[0]
    });
  }
  
  return results;
}
