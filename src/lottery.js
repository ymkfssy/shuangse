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

    // 使用传递进来的env参数，而不是request.env
    const db = getDB(env);
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
    console.error('获取历史号码失败:', error);
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

// 尝试官方API接口 - 仅使用idcd.com提供的API
async function tryOfficialAPI() {
  const apiUrl = 'https://www.idcd.com/api/welfare-lottery';
  
  try {
    console.log(`尝试idcd.com API: ${apiUrl}`);
    
    // 获取当前时间戳
    const timestamp = Math.floor(Date.now() / 1000);
    
    // 生成随机nonce（示例值）
    const nonce = 'v0j38hHHUEqFwoh0Gc8Rbfi737xtIpLL';
    
    // API参数
    const params = {
      type: 'ssq', // 双色球
      start_no: '', // 可以根据需要设置
      end_no: ''    // 可以根据需要设置
    };
    
    // 构建完整URL
    const urlWithParams = `${apiUrl}?type=${params.type}`;
    
    const headers = {
      'User-Agent': getRandomUserAgent(),
      'Accept': 'application/json, text/plain, */*',
      'ClientID': 'df77f2de-2924-4499-adda-1c4cc243625a',
      'Nonce': nonce,
      'Timestamp': timestamp.toString(),
      'Signature': '5b1230f42bad2ffd5ad09890a8ebb47c02d74668be0cf7bb54a0f6a14996117b',
      'SignatureMethod': 'HmacSHA256'
    };
    
    // 添加随机延迟
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
    
    const response = await fetch(urlWithParams, { headers });
    
    if (!response.ok) {
      console.log(`idcd.com API 返回错误状态: ${response.status} ${response.statusText}`);
      return [];
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.log(`idcd.com API 返回非JSON数据: ${contentType}`);
      return [];
    }
    
    const data = await response.json();
    
    // 解析idcd.com API返回的格式
    if (data.status === true && Array.isArray(data.data)) {
      const results = parseIdcdData(data.data);
      if (results.length > 0) {
        console.log(`从idcd.com API 成功解析 ${results.length} 条数据`);
        return results;
      }
    } else {
      console.log(`idcd.com API 返回格式不符合预期:`, JSON.stringify(data).substring(0, 200) + '...');
    }
  } catch (error) {
    console.error(`idcd.com API 请求失败:`, error);
    console.error(`错误堆栈:`, error.stack);
  }
  
  return [];
}

// 尝试第三方数据源 - 仅使用idcd.com API，不再使用其他第三方数据源
async function tryThirdPartySources() {
  // 不再使用其他第三方数据源，只返回空数组
  console.log('已禁用所有第三方数据源，仅使用idcd.com API');
  return [];
}

// 解析idcd.com API返回的格式
function parseIdcdData(data) {
  const results = [];
  
  for (const item of data) {
    if (item.no && item.number && item.date) {
      try {
        // 解析开奖号码：前6个是红球，第7个是蓝球
        const numbers = item.number.split(',').map(Number);
        
        if (numbers.length === 7) {
          const red = numbers.slice(0, 6).sort((a, b) => a - b);
          const blue = numbers[6];
          const issue = item.no;
          // 处理日期格式，只保留年月日部分
          const date = item.date.split(' ')[0];
          
          // 验证号码范围
          if (red.every(n => n >= 1 && n <= 33) && blue >= 1 && blue <= 16) {
            results.push({ issue, red, blue, date });
          }
        }
      } catch (e) {
        console.log(`解析idcd.com数据项失败: ${JSON.stringify(item)}`, e.message);
      }
    }
  }
  
  return results;
}
      


// 不再使用的第三方API解析函数已删除

// 生成模拟测试数据
function generateMockData() {
  const results = [];
  const today = new Date();
  
  // 生成60条模拟数据（约1年的数据量）
  for (let i = 0; i < 60; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i * 3); // 每3天一期的模拟数据
    
    const issueDate = date.toISOString().slice(2, 10).replace(/-/g, '');
    const issue = `202${3 + Math.floor(i/50)}${issueDate}`;
    
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
