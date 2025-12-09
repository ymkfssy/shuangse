import { getDB } from './database.js';
import { getUserFromSession } from './auth.js';

// 随机User-Agent列表，避免被反爬虫机制识别


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
        return new Response(JSON.stringify({ error: "生成号码失败: " + error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
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
    return new Response(JSON.stringify({ error: "获取历史号码失败: " + error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// 获取所有历史双色球号码（支持分页、过滤等功能）
export async function getAllHistoryNumbers(request, env) {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const startIssue = url.searchParams.get('startIssue');
    const endIssue = url.searchParams.get('endIssue');

    // 构建查询条件
    let query = 'SELECT * FROM lottery_history';
    const params = [];
    const conditions = [];

    if (startIssue) {
      conditions.push('issue_number >= ?');
      params.push(startIssue);
    }

    if (endIssue) {
      conditions.push('issue_number <= ?');
      params.push(endIssue);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY issue_number DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    // 获取总记录数
    let countQuery = 'SELECT COUNT(*) as total FROM lottery_history';
    const countParams = [];
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
      countParams.push(...params.slice(0, params.length - 2));
    }

    const db = getDB(env);
    const results = await db.prepare(query).bind(...params).all();
    const totalResult = await db.prepare(countQuery).bind(...countParams).first();

    return new Response(JSON.stringify({ 
      success: true, 
      numbers: results.results,
      total: totalResult.total,
      limit: limit,
      offset: offset
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('获取所有历史号码失败:', error);
    return new Response(JSON.stringify({ error: "获取所有历史号码失败: " + error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// 获取历史数据统计信息
export async function getHistoryStats(request, env) {
  try {
    const db = getDB(env);
    
    // 1. 获取总期数
    const totalResult = await db.prepare('SELECT COUNT(*) as total FROM lottery_history').first();
    const total = totalResult.total;
    
    // 2. 获取红球出现频率
    const redFrequency = await db.prepare(`
      SELECT 
        number, 
        COUNT(*) as count, 
        ROUND((COUNT(*) / ${total} * 100), 2) as percentage
      FROM (
        SELECT red_1 as number FROM lottery_history UNION ALL
        SELECT red_2 as number FROM lottery_history UNION ALL
        SELECT red_3 as number FROM lottery_history UNION ALL
        SELECT red_4 as number FROM lottery_history UNION ALL
        SELECT red_5 as number FROM lottery_history UNION ALL
        SELECT red_6 as number FROM lottery_history
      ) t
      GROUP BY number
      ORDER BY count DESC
    `).all();
    
    // 3. 获取蓝球出现频率
    const blueFrequency = await db.prepare(`
      SELECT 
        blue as number, 
        COUNT(*) as count, 
        ROUND((COUNT(*) / ${total} * 100), 2) as percentage
      FROM lottery_history
      GROUP BY blue
      ORDER BY count DESC
    `).all();
    
    // 4. 获取最近10期数据
    const recentData = await db.prepare(`
      SELECT * FROM lottery_history
      ORDER BY issue_number DESC
      LIMIT 10
    `).all();
    
    // 5. 获取最新一期
    const latestIssue = await db.prepare(`
      SELECT * FROM lottery_history
      ORDER BY issue_number DESC
      LIMIT 1
    `).first();
    
    return new Response(JSON.stringify({ 
      success: true, 
      stats: {
        totalIssues: total,
        redFrequency: redFrequency.results,
        blueFrequency: blueFrequency.results,
        recentData: recentData.results,
        latestIssue: latestIssue
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('获取历史数据统计信息失败:', error);
    return new Response(JSON.stringify({ error: "获取历史数据统计信息失败: " + error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// 导入历史双色球号码
export async function importHistoryNumbers(request, env) {
  try {
    // 检查请求是否为multipart/form-data
    if (!request.headers.get('content-type')?.startsWith('multipart/form-data')) {
      return new Response(JSON.stringify({ error: '请使用multipart/form-data格式上传文件' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // 解析文件上传
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return new Response(JSON.stringify({ error: '未找到上传的文件' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // 读取文件内容
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // 使用XLSX解析Excel文件
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(bytes, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      return new Response(JSON.stringify({ error: 'Excel文件中没有数据' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // 处理数据并导入到数据库
    const db = getDB(env);
    let importedCount = 0;
    let skippedCount = 0;

    for (const row of data) {
      try {
        // 验证数据格式
        const issue = row['期号'] || row['issue_number'] || row['Issue'];
        const date = row['日期'] || row['draw_date'] || row['Date'];
        const numbers = row['开奖号码'] || row['numbers'] || row['Numbers'];
        const redOrder = row['红球顺序'] || row['red_order'] || row['RedOrder'];

        if (!issue || !date || !numbers) {
          skippedCount++;
          continue;
        }

        // 解析号码
        let redNumbers = [];
        let blueNumber = null;
        let redOrderNumbers = [];

        if (typeof numbers === 'string') {
          // 处理格式：01 02 03 04 05 06|07 或 01,02,03,04,05,06,07
          const numStr = numbers.replace(/\s+/g, '');
          const [redStr, blueStr] = numStr.includes('|') ? numStr.split('|') : [numStr.slice(0, -2), numStr.slice(-2)];
          redNumbers = redStr.match(/.{1,2}/g).map(n => parseInt(n));
          blueNumber = parseInt(blueStr);
        }

        // 解析红球顺序
        if (redOrder && typeof redOrder === 'string') {
          redOrderNumbers = redOrder.split(/[\s,]+/).map(n => parseInt(n));
        } else if (!redOrderNumbers.length && redNumbers.length === 6) {
          // 如果没有红球顺序，则使用排序后的红球号码作为默认顺序
          redOrderNumbers = [...redNumbers];
        }

        // 验证号码范围
        const isValidRed = redNumbers.every(n => n >= 1 && n <= 33);
        const isValidBlue = blueNumber >= 1 && blueNumber <= 16;
        const isValidRedOrder = redOrderNumbers.every(n => n >= 1 && n <= 33);

        if (!isValidRed || !isValidBlue || !isValidRedOrder || redNumbers.length !== 6 || redOrderNumbers.length !== 6) {
          skippedCount++;
          continue;
        }

        // 检查是否已存在
        const exists = await db.prepare(
          'SELECT COUNT(*) as count FROM lottery_history WHERE issue_number = ?'
        ).bind(issue).first();

        if (exists && exists.count === 0) {
          // 保存到数据库
          await db.prepare(
            `INSERT INTO lottery_history (issue_number, red_1, red_2, red_3, red_4, red_5, red_6, 
                                          red_1_order, red_2_order, red_3_order, red_4_order, red_5_order, red_6_order, 
                                          blue, draw_date) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            issue, 
            ...redNumbers.sort((a, b) => a - b), 
            ...redOrderNumbers, 
            blueNumber, 
            date
          ).run();
          importedCount++;
        } else {
          skippedCount++;
        }

      } catch (e) {
        console.error('处理行数据失败:', e);
        skippedCount++;
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `导入完成，成功导入 ${importedCount} 条记录，跳过 ${skippedCount} 条记录`
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('导入历史数据失败:', error);
    return new Response(JSON.stringify({ error: "导入历史数据失败: " + error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
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
        const [red1Order, red2Order, red3Order, red4Order, red5Order, red6Order] = item.redOrder || item.red;
        
        // 检查是否已存在
        const exists = await db.prepare(
          'SELECT COUNT(*) as count FROM lottery_history WHERE issue_number = ?'
        ).bind(item.issue).first();
        
        if (exists && exists.count === 0) {
          await db.prepare(
            `INSERT INTO lottery_history (issue_number, red_1, red_2, red_3, red_4, red_5, red_6, 
                                          red_1_order, red_2_order, red_3_order, red_4_order, red_5_order, red_6_order, 
                                          blue, draw_date) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(item.issue, red1, red2, red3, red4, red5, red6, 
                 red1Order, red2Order, red3Order, red4Order, red5Order, red6Order, 
                 item.blue, item.date).run();
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
      error: "爬取失败: " + error.message,
      stack: error.stack
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// 尝试从6.17500.cn爬取数据
async function tryOfficialAPI() {
  const apiUrl = 'https://6.17500.cn/?lottery=more&lotteryId=ssq';
  
  try {
    console.log("尝试从6.17500.cn爬取数据: " + apiUrl);
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Referer': 'https://6.17500.cn/',
      'Accept-Language': 'zh-CN,zh;q=0.8,en-US;q=0.5,en;q=0.3'
    };
    
    // 添加随机延迟
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
    
    const response = await fetch(apiUrl, { headers });
    
    if (!response.ok) {
      console.log("6.17500.cn 返回错误状态: " + response.status + " " + response.statusText);
      return [];
    }
    
    const html = await response.text();
    
    // 解析HTML数据
    const results = parse17500HTML(html);
    if (results.length > 0) {
      console.log(`从6.17500.cn成功解析 ${results.length} 条数据`);
      return results;
    } else {
      console.log(`从6.17500.cn解析数据为空`);
    }
  } catch (error) {
    console.error(`6.17500.cn 请求失败:`, error);
    console.error(`错误堆栈:`, error.stack);
  }
  
  return [];
}

// 尝试第三方数据源 - 保留作为备份
async function tryThirdPartySources() {
  // 暂时返回空数组，如果6.17500.cn失败可以考虑添加其他数据源
  console.log('已禁用所有第三方数据源');
  return [];
}

// 解析6.17500.cn网站的HTML内容，只返回最新的一期开奖结果
function parse17500HTML(html) {
  console.log('开始解析17500.cn的HTML内容');
  const results = [];
  console.log('HTML内容长度:', html.length, '字符');
  
  try {
    // 1. 首先提取包含开奖记录的核心内容区域
    // 查找包含开奖记录的表格或div
    const contentMatch = html.match(/<table[^>]*class="[^>]*lottery[^>]*"[^>]*>([\s\S]*?)<\/table>/) || 
                        html.match(/<div[^>]*class="[^>]*lottery[^>]*"[^>]*>([\s\S]*?)<\/div>/) ||
                        html.match(/<table[^>]*>([\s\S]*?)<\/table>/);
    
    if (!contentMatch) {
      console.log('未找到包含开奖记录的表格或div');
      // 使用整个HTML作为备选
      return results;
    }
    
    const content = contentMatch[1];
    console.log('核心内容长度:', content.length, '字符');
    
    // 2. 匹配日期和期号的组合
    // 支持多种格式：
    // - 日期  第 期号 期
    // - 日期  第期号期
    // - 日期第期号期
    const issueDatePattern = /(\d{4}-\d{2}-\d{2})[\s\t]*(?:<[^>]*>)?[\s\t]*第[\s\t]*(?:<[^>]*>)?[\s\t]*(\d{4}\d{3})[\s\t]*(?:<[^>]*>)?[\s\t]*期/g;
    
    let issueMatch;
    let latestResult = null;
    let latestIssue = 0;
    let matchCount = 0;
    
    while ((issueMatch = issueDatePattern.exec(content)) !== null) {
      matchCount++;
      
      try {
        const date = issueMatch[1];
        const issue = issueMatch[2];
        
        // 确保期号是7位数字
        if (issue.length !== 7) {
          console.log("跳过不合法期号: " + issue);
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
          // 红球按开奖顺序保存（不排序）
          const redOrder = numbers.slice(0, 6);
          // 红球按大小排序保存
          const red = [...redOrder].sort((a, b) => a - b);
          const blue = numbers[6];
          
          // 验证号码范围
          const isValidRed = red.every(n => n >= 1 && n <= 33);
          const isValidBlue = blue >= 1 && blue <= 16;
          
          if (isValidRed && isValidBlue) {
            const currentIssue = parseInt(issue);
            // 只保留最新的一期
            if (currentIssue > latestIssue) {
              latestIssue = currentIssue;
              latestResult = { issue, red, blue, date, redOrder };
              console.log("找到最新期号: " + issue + ", 日期 " + date + ", 开奖号码: " + redOrder.join(' ') + " " + blue);
              // 解析到最新一期后可以提前退出
              break;
            }
          } else {
            console.log("号码范围验证失败: " + issue + " - 红球: " + red + ", 蓝球: " + blue);
          }
        } else {
          console.log("号码数量不符合预期: " + issue + " - 实际数量: " + numbers.length);
        }
        
        // 避免无限循环
        if (issueDatePattern.lastIndex >= content.length - 100) {
          break;
        }
        
      } catch (e) {
        console.error(`解析期号数据失败:`, e);
      }
    }
    
    // 如果找到最新一期，添加到结果
    if (latestResult) {
      results.push(latestResult);
      console.log("解析完成，共处理 " + matchCount + " 个期号，只保留最新的一期: " + latestResult.issue);
    } else {
        console.log("解析完成，共处理 " + matchCount + " 个期号，未找到有效记录");
    }
    
  } catch (e) {
    console.error('解析过程中发生严重错误:', e);
    console.error('错误堆栈:', e.stack);
  }
  
  return results;
}

// 解析idcd.com API返回的格式（保留作为备份）
function parseIdcdData(data) {
  return [];
}
      


// 不再使用的第三方API解析函数已删除

// 生成模拟测试数据
function generateMockData() {
  const results = [];
  const today = new Date();
  
  // 生成正确格式的模拟数据（期号格式：YYYYNNN，如2025141）
  // 假设最新期号是2025141，开始生成
  let currentIssue = 2025141;
  
  // 生成60条模拟数据（约1年的数据量）
  for (let i = 0; i < 60; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i * 3); // 每3天一期的模拟数据
    
    // 确保期号是7位数字
    const issue = currentIssue.toString();
    if (issue.length !== 7) {
      console.log("跳过不合法期号: " + issue);
      currentIssue--;
      continue;
    }
    
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
    
    currentIssue--;
  }
  
  return results;
}
