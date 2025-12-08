import { getDB } from './database.js';
import { getUserFromSession } from './auth.js';

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
  
  const result = await db.prepare(
    `SELECT COUNT(*) as count FROM lottery_history 
     WHERE red_1 = ? AND red_2 = ? AND red_3 = ? AND red_4 = ? AND red_5 = ? AND red_6 = ? AND blue = ?`
  ).bind(red1, red2, red3, red4, red5, red6, blueNumber).first();
  
  return result.count > 0;
}

// 生成未出现过的双色球号码
export async function generateNewNumber(request, env) {
  try {
    // 验证用户身份
    const user = await getUserFromSession(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: '用户未登录或会话已过期' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    let attempts = 0;
    const maxAttempts = 1000;
    let redNumbers, blueNumber;
    let exists = true;

    // 生成未出现过的号码
    while (exists && attempts < maxAttempts) {
      redNumbers = generateRedNumbers();
      blueNumber = generateBlueNumber();
      exists = await isNumberExists(request.env, redNumbers, blueNumber);
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return new Response(JSON.stringify({ error: '生成号码失败，可能所有组合都已出现过，请稍后重试' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // 保存到用户生成的号码表
    const [red1, red2, red3, red4, red5, red6] = redNumbers;
    const db = getDB(request.env);
    await db.prepare(
      `INSERT INTO user_numbers (user_id, red_1, red_2, red_3, red_4, red_5, red_6, blue) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(user.user_id, red1, red2, red3, red4, red5, red6, blueNumber).run();

    return new Response(JSON.stringify({ 
      success: true, 
      numbers: { 
        red: redNumbers, 
        blue: blueNumber 
      },
      user: {
        id: user.user_id,
        username: user.username
      },
      attempts: attempts
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: `生成号码失败: ${error.message}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
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
    const currentEnv = env || request?.env;
    
    // 从中国福彩官网获取数据
    const response = await fetch('https://www.cwl.gov.cn/ygkj/wqkjgg/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    
    // 解析HTML，提取开奖信息
    const results = [];
    
    // 改进的正则表达式，更准确地匹配福彩网站的数据结构
    // 匹配表格中的开奖数据行
    const tableRowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/g;
    const rows = html.match(tableRowRegex) || [];
    
    for (const row of rows) {
      // 提取期号
      const issueMatch = row.match(/>(\d{7})</);
      // 提取日期
      const dateMatch = row.match(/>(\d{4}-\d{2}-\d{2})/);
      // 提取红球和蓝球号码
      const numbersMatch = row.match(/(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})/);
      
      if (issueMatch && dateMatch && numbersMatch) {
        const issue = issueMatch[1];
        const date = dateMatch[1];
        const numbers = numbersMatch.slice(1).map(Number);
        
        if (numbers.length === 7) {
          const red = numbers.slice(0, 6).sort((a, b) => a - b);
          const blue = numbers[6];
          
          // 验证号码的有效性
          if (red.every(n => n >= 1 && n <= 33) && blue >= 1 && blue <= 16) {
            results.push({
              issue,
              red,
              blue,
              date
            });
          }
        }
      }
    }
    
    // 如果没有匹配到数据，尝试备用解析方式
    if (results.length === 0) {
      // 尝试匹配JSON格式的数据
      const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.+?});/);
      if (jsonMatch) {
        try {
          const jsonData = JSON.parse(jsonMatch[1]);
          // 这里需要根据实际的JSON结构来解析
          console.log('找到JSON数据，但需要根据实际结构调整解析逻辑');
        } catch (e) {
          console.log('JSON解析失败:', e.message);
        }
      }
    }
    
    if (results.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: '未找到开奖数据，网站结构可能已变更',
        html_length: html.length
      }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // 保存到数据库
    const db = getDB(currentEnv);
    let insertedCount = 0;
    
    for (const item of results) {
      const [red1, red2, red3, red4, red5, red6] = item.red;
      
      // 检查是否已存在
      const exists = await db.prepare(
        'SELECT COUNT(*) as count FROM lottery_history WHERE issue_number = ?'
      ).bind(item.issue).first();
      
      if (exists.count === 0) {
        await db.prepare(
          `INSERT INTO lottery_history (issue_number, red_1, red_2, red_3, red_4, red_5, red_6, blue, draw_date) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(item.issue, red1, red2, red3, red4, red5, red6, item.blue, item.date).run();
        insertedCount++;
      }
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
