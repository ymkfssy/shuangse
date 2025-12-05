import { getDB } from './database.js';

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
export async function generateNewNumber(request) {
  try {
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
      return new Response(JSON.stringify({ error: '生成号码失败，请稍后重试' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // 解析用户ID（这里简化处理，实际应该从会话中获取）
    // const userId = await getUserIdFromSession(request);
    const userId = 1; // 测试用

    // 保存到用户生成的号码表
    const [red1, red2, red3, red4, red5, red6] = redNumbers;
    const db = getDB(request.env);
    await db.prepare(
      `INSERT INTO user_numbers (user_id, red_1, red_2, red_3, red_4, red_5, red_6, blue) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(userId, red1, red2, red3, red4, red5, red6, blueNumber).run();

    return new Response(JSON.stringify({ 
      success: true, 
      numbers: { 
        red: redNumbers, 
        blue: blueNumber 
      } 
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: `生成号码失败: ${error.message}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// 获取历史双色球号码
export async function getHistoryNumbers(request) {
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
    const currentEnv = env || request.env;
    
    // 从中国福彩官网获取数据
    const response = await fetch('https://www.cwl.gov.cn/ygkj/wqkjgg/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const html = await response.text();
    
    // 解析HTML，提取开奖信息
    const results = [];
    
    // 使用正则表达式匹配开奖数据行
    const rowRegex = /<tr>\s*<td>(\d{7})<\/td>\s*<td>(\d{4}-\d{2}-\d{2})\([^)]+\)<\/td>\s*<td>([\d\s]+)<\/td>/g;
    let match;
    
    while ((match = rowRegex.exec(html)) !== null) {
      const issue = match[1];
      const date = match[2];
      const numbers = match[3].trim().split(/\s+/).map(Number);
      
      if (numbers.length === 7) {
        const red = numbers.slice(0, 6).sort((a, b) => a - b);
        const blue = numbers[6];
        
        results.push({
          issue,
          red,
          blue,
          date
        });
      }
    }
    
    if (results.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: '未找到开奖数据' 
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
      message: `成功爬取 ${results.length} 条历史数据，其中 ${insertedCount} 条是新数据` 
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: `爬取失败: ${error.message}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
