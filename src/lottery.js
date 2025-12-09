import { getDB } from './database.js';
import { getUserFromSession } from './auth.js';
import * as XLSX from 'xlsx';

// 用户代理列表，用于模拟不同的浏览器请求
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Edg/125.0.2535.85',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Edg/124.0.2478.100'
];

// 解析Excel文件并导入历史数据
export async function importHistoryFromExcel(request, env) {
  try {
    // 解析表单数据
    const formData = await request.formData();
    const file = formData.get('file');
    
    if (!file) {
      return new Response(JSON.stringify({ success: false, error: '请选择要上传的Excel文件' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    // 获取第一个工作表
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    // 验证数据格式
    if (!Array.isArray(jsonData) || jsonData.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'Excel文件中没有数据或格式不正确' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 获取数据库连接
    const db = await getDB(env);
    let importedCount = 0;
    let skippedCount = 0;
    
    // 批量导入优化：先收集所有有效的数据，然后批量执行插入
    const validRows = [];
    const existingIssues = new Set();
    
    // 先获取所有已存在的期号，避免重复检查
    const existingIssuesResult = await db.prepare('SELECT issue_number FROM lottery_history').all();
    for (const row of existingIssuesResult.results) {
      existingIssues.add(row.issue_number);
    }
    
    // 预处理数据
    for (const row of jsonData) {
      // 检查必要字段
      if (!row.期号 || !row.日期 || !row.红球1 || !row.红球2 || !row.红球3 || !row.红球4 || !row.红球5 || !row.红球6 || !row.蓝球) {
        skippedCount++;
        continue;
      }
      
      // 处理期号：确保是7位数字，没有小数点
      let issueNumber = String(row.期号);
      // 移除可能的小数点和小数部分
      issueNumber = issueNumber.replace(/\..*/, '');
      // 确保是7位数字
      if (!/^\d{7}$/.test(issueNumber)) {
        skippedCount++;
        continue;
      }
      
      // 检查是否已存在
      if (existingIssues.has(issueNumber)) {
        skippedCount++;
        continue;
      }
      
      // 解析日期：支持多种日期格式
      let drawDate;
      try {
        let dateStr = row.日期;
        
        // 如果是数字（Excel日期格式），直接转换
        if (typeof dateStr === 'number') {
          drawDate = new Date(dateStr);
        } else if (typeof dateStr === 'string') {
          // 移除时间部分（如果有）
          const datePart = dateStr.split(' ')[0];
          
          // 尝试解析多种日期格式
          // 支持的格式：XXXX/XX/XX, XXXX/X/X, XXXX-XX-XX, XXXX-X-X
          const dateRegex = /^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/;
          const match = datePart.match(dateRegex);
          
          if (match) {
            const [, year, month, day] = match;
            // 确保月份和日期是两位数
            const formattedMonth = String(month).padStart(2, '0');
            const formattedDay = String(day).padStart(2, '0');
            
            // 创建标准格式的日期字符串
            drawDate = new Date(`${year}-${formattedMonth}-${formattedDay}`);
          } else {
            // 尝试默认解析
            drawDate = new Date(datePart);
          }
        } else {
          // 无法解析的日期类型
          skippedCount++;
          continue;
        }
        
        if (isNaN(drawDate.getTime())) {
          skippedCount++;
          continue;
        }
      } catch (error) {
        skippedCount++;
        continue;
      }
      
      // 格式化数字为两位数文本的辅助函数
      const formatBall = (num) => {
        // 确保是数字类型
        const number = typeof num === 'string' ? parseInt(num) : num;
        // 格式化为两位数字符串
        return String(number).padStart(2, '0');
      };
      
      // 提取红球数据并格式化为两位数文本
      const redBalls = [row.红球1, row.红球2, row.红球3, row.红球4, row.红球5, row.红球6];
      // 转换为数字后排序，再格式化为两位数文本
      const sortedReds = [...redBalls]
        .map(ball => typeof ball === 'string' ? parseInt(ball) : ball)
        .sort((a, b) => a - b)
        .map(formatBall);
      
      // 提取红球出球顺序并格式化为两位数文本（优先使用红球顺序字段，如果没有则使用红球1-6的顺序）
      const redBallsOrder = [];
      for (let i = 1; i <= 6; i++) {
        const orderKey = `红球顺序${i}`;
        let ball;
        if (row[orderKey] !== undefined) {
          ball = row[orderKey];
        } else {
          ball = redBalls[i-1];
        }
        redBallsOrder.push(formatBall(ball));
      }
      
      // 添加到有效数据列表
      validRows.push({
        issueNumber,
        drawDate: drawDate.toISOString().split('T')[0], // 只保留日期部分
        sortedReds,
        redBallsOrder,
        blue: formatBall(row.蓝球)
      });
    }
    
    // 优化插入：直接插入有效数据，D1不支持传统SQL事务，所以我们使用try-catch确保数据一致性
    if (validRows.length > 0) {
      for (const row of validRows) {
        try {
          // 插入数据
          await db.prepare(
            `INSERT INTO lottery_history (
              issue_number, draw_date, 
              red_1, red_2, red_3, red_4, red_5, red_6, 
              red_1_order, red_2_order, red_3_order, red_4_order, red_5_order, red_6_order,
              blue
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            row.issueNumber, row.drawDate,
            row.sortedReds[0], row.sortedReds[1], row.sortedReds[2], row.sortedReds[3], row.sortedReds[4], row.sortedReds[5],
            row.redBallsOrder[0], row.redBallsOrder[1], row.redBallsOrder[2], row.redBallsOrder[3], row.redBallsOrder[4], row.redBallsOrder[5],
            row.blue
          ).run();
          
          importedCount++;
        } catch (error) {
          console.error(`插入数据失败（期号: ${row.issueNumber}）:`, error);
          // 继续处理下一条数据
          continue;
        }
      }
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: `成功导入 ${importedCount} 条数据，跳过 ${skippedCount} 条数据（格式错误或已存在）`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('导入Excel失败:', error);
    return new Response(JSON.stringify({ success: false, error: `导入失败: ${error.message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 随机User-Agent列表，避免被反爬虫机制识别


// 格式化数字为两位数文本的辅助函数
function formatBall(num) {
  return String(num).padStart(2, '0');
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
  // 排序后格式化为两位数文本
  return redNumbers.sort((a, b) => a - b).map(formatBall);
}

// 生成1个蓝球号码（1-16）
function generateBlueNumber() {
  const num = Math.floor(Math.random() * 16) + 1;
  // 格式化为两位数文本
  return formatBall(num);
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
      `SELECT id, issue_number, draw_date, 
              red_1, red_2, red_3, red_4, red_5, red_6, 
              red_1_order, red_2_order, red_3_order, red_4_order, red_5_order, red_6_order,
              blue, jackpot_amount
       FROM lottery_history 
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

// 修复历史双色球开奖日期
export async function fixDrawDates(request, env) {
  try {
    // 验证是否为管理员
    const isAdmin = await import('./auth.js').then(m => m.isAdmin(request, env));
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: '权限不足' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    // 已知的最后正确开奖信息：期号2025141，日期2025-12-07（周日）
    const LAST_CORRECT_ISSUE = '2025141';
    const LAST_CORRECT_DATE = new Date('2025-12-07');
    
    // 开奖周期：周二、周四、周日
    const DRAW_DAYS = [2, 4, 0]; // 0=周日, 1=周一, ..., 6=周六

    const db = await import('./database.js').then(m => m.getDB(env));
    
    // 获取所有历史数据，按期号降序排列
    const historyResults = await db.prepare(
      `SELECT id, issue_number, draw_date 
       FROM lottery_history 
       ORDER BY issue_number DESC`
    ).all();
    
    const historyData = historyResults.results;
    console.log(`共获取到 ${historyData.length} 条历史记录`);
    
    // 找到最后正确的记录
    const lastCorrectIndex = historyData.findIndex(item => item.issue_number === LAST_CORRECT_ISSUE);
    if (lastCorrectIndex === -1) {
      console.error('未找到最后正确的期号:', LAST_CORRECT_ISSUE);
      return new Response(JSON.stringify({ error: `未找到期号为 ${LAST_CORRECT_ISSUE} 的记录` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // 计算正确的日期
    const correctedData = [];
    let currentDate = new Date(LAST_CORRECT_DATE);
    let currentIssue = parseInt(LAST_CORRECT_ISSUE);

    // 先处理最后正确记录之后的期号（较近期的）
    for (let i = lastCorrectIndex - 1; i >= 0; i--) {
      currentIssue++;
      // 找到下一个开奖日期（周二、周四、周日）
      do {
        currentDate.setDate(currentDate.getDate() + 1);
      } while (!DRAW_DAYS.includes(currentDate.getDay()));
      
      correctedData.push({
        id: historyData[i].id,
        issue_number: historyData[i].issue_number,
        current_draw_date: historyData[i].draw_date,
        correct_draw_date: currentDate.toISOString().split('T')[0]
      });
    }

    // 重置当前日期和期号，处理最后正确记录之前的期号（较远期的）
    currentDate = new Date(LAST_CORRECT_DATE);
    currentIssue = parseInt(LAST_CORRECT_ISSUE);

    for (let i = lastCorrectIndex + 1; i < historyData.length; i++) {
      currentIssue--;
      // 找到上一个开奖日期（周二、周四、周日）
      do {
        currentDate.setDate(currentDate.getDate() - 1);
      } while (!DRAW_DAYS.includes(currentDate.getDay()));
      
      correctedData.push({
        id: historyData[i].id,
        issue_number: historyData[i].issue_number,
        current_draw_date: historyData[i].draw_date,
        correct_draw_date: currentDate.toISOString().split('T')[0]
      });
    }

    // 添加最后正确的记录
    correctedData.push({
      id: historyData[lastCorrectIndex].id,
      issue_number: LAST_CORRECT_ISSUE,
      current_draw_date: historyData[lastCorrectIndex].draw_date,
      correct_draw_date: LAST_CORRECT_DATE.toISOString().split('T')[0]
    });

    // 更新数据库中的开奖日期
    let updatedCount = 0;
    for (const item of correctedData) {
      if (item.current_draw_date !== item.correct_draw_date) {
        await db.prepare(
          `UPDATE lottery_history SET draw_date = ? WHERE id = ?`
        ).bind(item.correct_draw_date, item.id).run();
        updatedCount++;
        console.log(`已更新期号 ${item.issue_number}: ${item.current_draw_date} -> ${item.correct_draw_date}`);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `开奖日期修复完成，共修改了 ${updatedCount} 条记录的日期`,
      total_records: correctedData.length,
      updated_records: updatedCount
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('修复开奖日期失败:', error);
    return new Response(JSON.stringify({ error: `修复开奖日期失败: ${error.message}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
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
      error: `爬取失败: ${error.message}`,
      stack: error.stack
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// 从中国福利彩票官网爬取数据
async function tryOfficialAPI() {
  // 中国福利彩票官网双色球开奖信息页面
  const apiUrl = 'https://www.cwl.gov.cn/ygkj/wqkjgg/yizhong/ssq/';
  
  // 改进的请求头，更接近真实浏览器
  const options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Host': 'www.cwl.gov.cn',
      'Origin': 'https://www.cwl.gov.cn',
      'Referer': 'https://www.cwl.gov.cn/',
      'Cache-Control': 'max-age=0',
      'DNT': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
      'Sec-Ch-Ua': '"Not/A)Brand";v="99", "Google Chrome";v="125", "Chromium";v="125"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"'
    },
    redirect: 'follow', // 自动跟随重定向
    credentials: 'include' // 包含凭证信息
  };

  console.log('正在尝试从中国福利彩票官网获取数据...');
  console.log(`请求URL: ${apiUrl}`);

  try {
    // 添加随机延迟
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
    
    const response = await fetch(apiUrl, options);
    
    console.log(`响应状态码: ${response.status} ${response.statusText}`);
    console.log(`响应URL: ${response.url}`);
    
    if (!response.ok) {
      // 即使状态码不是200，也尝试解析内容
      const html = await response.text();
      console.log(`响应内容: ${html.substring(0, 500)}...`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    console.log('获取到HTML内容长度:', html.length);
    
    // 尝试解析HTML
    const results = parseCWLHTML(html);
    if (results.length > 0) {
      console.log(`从中国福利彩票官网成功解析 ${results.length} 条数据`);
      return results;
    } else {
      console.log(`从中国福利彩票官网解析数据为空`);
    }
  } catch (error) {
    console.error(`从中国福利彩票官网获取数据失败: ${error.message}`);
    console.error('错误详情:', error);
  }
  
  return [];
}

// 尝试第三方数据源 - 添加几个可靠的备选数据源
async function tryThirdPartySources() {
  console.log('尝试从第三方数据源获取双色球历史开奖数据');
  
  try {
    // 尝试500彩票网
    console.log('尝试获取500彩票网数据');
    const lottery500Data = await try500LotteryAPI();
    if (lottery500Data.length > 0) {
      console.log(`从500彩票网获取到 ${lottery500Data.length} 条数据`);
      return lottery500Data;
    }
    
    // 尝试中彩网
    console.log('尝试获取中彩网数据');
    const zcwData = await tryZcwAPI();
    if (zcwData.length > 0) {
      console.log(`从中彩网获取到 ${zcwData.length} 条数据`);
      return zcwData;
    }
    
    // 尝试中国竞彩网
    console.log('尝试获取中国竞彩网数据');
    const sportteryData = await trySportteryAPI();
    if (sportteryData.length > 0) {
      console.log(`从中国竞彩网获取到 ${sportteryData.length} 条数据`);
      return sportteryData;
    }
    
    // 尝试乐彩网
    console.log('尝试获取乐彩网数据');
    const lecaiData = await tryLecaiAPI();
    if (lecaiData.length > 0) {
      console.log(`从乐彩网获取到 ${lecaiData.length} 条数据`);
      return lecaiData;
    }
    
    console.log('所有第三方数据源都获取失败');
    return [];
  } catch (error) {
    console.error('第三方数据源获取数据异常:', error);
    return [];
  }
}

// 尝试从中国竞彩网API获取数据
async function trySportteryAPI() {
  const apiUrl = 'https://www.sporttery.cn/ssq/';
  
  try {
    console.log(`尝试从中国竞彩网获取数据: ${apiUrl}`);
    
    const headers = {
      'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2',
      'Host': 'www.sporttery.cn',
      'Referer': 'https://www.sporttery.cn/',
      'Upgrade-Insecure-Requests': '1'
    };
    
    // 添加随机延迟
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
    
    const response = await fetch(apiUrl, { headers });
    
    if (!response.ok) {
      console.log(`中国竞彩网返回错误状态: ${response.status} ${response.statusText}`);
      return [];
    }
    
    const html = await response.text();
    
    // 解析中国竞彩网的HTML内容
    const results = parseSportteryHTML(html);
    if (results.length > 0) {
      console.log(`从中国竞彩网成功解析 ${results.length} 条数据`);
      return results;
    } else {
      console.log(`从中国竞彩网解析数据为空`);
    }
  } catch (error) {
    console.error(`中国竞彩网请求失败:`, error);
  }
  
  return [];
}

// 解析中国竞彩网的HTML内容
function parseSportteryHTML(html) {
  console.log('开始解析中国竞彩网的HTML内容');
  const results = [];
  
  try {
    // 查找包含开奖记录的表格
    const tableMatch = html.match(/<table[^>]*class="kj_table"[^>]*>([\s\S]*?)<\/table>/);
    
    if (!tableMatch) {
      console.log('未找到包含开奖记录的表格');
      return results;
    }
    
    const tableContent = tableMatch[1];
    
    // 提取表格行
    const rows = tableContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/g);
    
    if (!rows) {
      console.log('未找到表格行');
      return results;
    }
    
    // 跳过表头行，从第二行开始处理数据
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      // 提取期号
      const issueMatch = row.match(/<td[^>]*class="td_qh"[^>]*>([\d]+)<\/td>/);
      if (!issueMatch) continue;
      const issue = issueMatch[1];
      
      // 提取日期
      const dateMatch = row.match(/<td[^>]*class="td_date"[^>]*>([\d]{4}-[\d]{2}-[\d]{2})<\/td>/);
      if (!dateMatch) continue;
      const date = dateMatch[1];
      
      // 提取红球
      const redMatch = row.match(/<td[^>]*class="td_ball_red"[^>]*>([\s\S]*?)<\/td>/);
      if (!redMatch) continue;
      const redBalls = redMatch[1].match(/<span[^>]*>(\d{2})<\/span>/g);
      if (!redBalls || redBalls.length !== 6) continue;
      // 保持文本格式，直接提取两位数文本
      const red = redBalls.map(ball => ball.match(/<span[^>]*>(\d{2})<\/span>/)[1]).sort((a, b) => parseInt(a) - parseInt(b));
      
      // 提取蓝球
      const blueMatch = row.match(/<td[^>]*class="td_ball_blue"[^>]*>([\s\S]*?)<\/td>/);
      if (!blueMatch) continue;
      const blueBall = blueMatch[1].match(/<span[^>]*>(\d{2})<\/span>/);
      if (!blueBall) continue;
      const blue = blueBall[1]; // 保持文本格式，确保两位数
      
      // 添加到结果
      results.push({
        issue,
        red,
        blue,
        date
      });
    }
  } catch (error) {
    console.error(`解析中国竞彩网数据失败:`, error);
  }
  
  return results;
}

// 尝试从500彩票网API获取数据
async function try500LotteryAPI() {
  const apiUrl = 'https://datachart.500.com/ssq/history/newinc/history.php?limit=100&sort=0';
  
  try {
    console.log(`尝试从500彩票网获取数据: ${apiUrl}`);
    
    const headers = {
      'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2',
      'Host': 'datachart.500.com',
      'Referer': 'https://datachart.500.com/ssq/',
      'Upgrade-Insecure-Requests': '1'
    };
    
    // 添加随机延迟
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
    
    const response = await fetch(apiUrl, { headers });
    
    if (!response.ok) {
      console.log(`500彩票网返回错误状态: ${response.status} ${response.statusText}`);
      return [];
    }
    
    const html = await response.text();
    
    // 解析500彩票网的HTML内容
    const results = parse500LotteryHTML(html);
    if (results.length > 0) {
      console.log(`从500彩票网成功解析 ${results.length} 条数据`);
      return results;
    } else {
      console.log(`从500彩票网解析数据为空`);
    }
  } catch (error) {
    console.error(`500彩票网请求失败:`, error);
  }
  
  return [];
}

// 解析500彩票网的HTML内容
function parse500LotteryHTML(html) {
  console.log('开始解析500彩票网的HTML内容');
  const results = [];
  
  try {
    // 查找包含开奖记录的表格
    console.log('尝试从表格中提取数据');
    
    // 500彩票网的HTML结构中，数据行使用class="t_tr1"
    const rows = html.match(/<tr[^>]*class="t_tr1"[^>]*>([\s\S]*?)<\/tr>/g);
    
    if (!rows) {
      console.log('未找到数据行');
      return results;
    }
    
    console.log(`找到 ${rows.length} 行数据`);
    
    // 处理每一行数据
    for (const row of rows) {
      // 提取期号
      const issueMatch = row.match(/<td[^>]*>(\d{5,7})<\/td>/);
      if (!issueMatch) {
        console.log('未找到期号');
        continue;
      }
      const issue = issueMatch[1];
      
      // 提取红球
      const redMatch = row.match(/<td[^>]*class="t_cfont2"[^>]*>(\d{2})<\/td>/g);
      if (!redMatch || redMatch.length < 6) {
        console.log('未找到红球或红球数量不足');
        continue;
      }
      // 保持文本格式，直接提取两位数文本
      const red = redMatch.slice(0, 6).map(ball => ball.match(/<td[^>]*class="t_cfont2"[^>]*>(\d{2})<\/td>/)[1]).sort((a, b) => parseInt(a) - parseInt(b));
      
      // 提取蓝球
      const blueMatch = row.match(/<td[^>]*class="t_cfont4"[^>]*>(\d{2})<\/td>/);
      if (!blueMatch) {
        console.log('未找到蓝球');
        continue;
      }
      const blue = blueMatch[1]; // 保持文本格式，确保两位数
      
      // 提取日期
      const dateMatch = row.match(/<td[^>]*>(\d{4}-\d{2}-\d{2})<\/td>/g);
      if (!dateMatch || dateMatch.length === 0) {
        console.log('未找到日期');
        continue;
      }
      const date = dateMatch[dateMatch.length - 1].match(/<td[^>]*>(\d{4}-\d{2}-\d{2})<\/td>/)[1];
      
      // 添加到结果
      results.push({
        issue,
        red,
        blue,
        date
      });
    }
    
    console.log(`成功解析 ${results.length} 条数据`);
  } catch (error) {
    console.error(`解析500彩票网数据失败:`, error);
    // 打印部分HTML内容用于调试
    console.log(`HTML内容片段: ${html.substring(0, 500)}...`);
  }
  
  return results;
}

// 尝试从中彩网API获取数据
async function tryZcwAPI() {
  const apiUrl = 'https://www.zhcw.com/data/ssq_kjhm.html';
  
  try {
    console.log(`尝试从中彩网获取数据: ${apiUrl}`);
    
    const headers = {
      'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2',
      'Host': 'www.zhcw.com',
      'Referer': 'https://www.zhcw.com/ssq/',
      'Upgrade-Insecure-Requests': '1'
    };
    
    // 添加随机延迟
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
    
    const response = await fetch(apiUrl, { headers });
    
    if (!response.ok) {
      console.log(`中彩网返回错误状态: ${response.status} ${response.statusText}`);
      return [];
    }
    
    const html = await response.text();
    
    // 解析中彩网的HTML内容
    const results = parseZcwHTML(html);
    if (results.length > 0) {
      console.log(`从中彩网成功解析 ${results.length} 条数据`);
      return results;
    } else {
      console.log(`从中彩网解析数据为空`);
    }
  } catch (error) {
    console.error(`中彩网请求失败:`, error);
  }
  
  return [];
}

// 解析中彩网的HTML内容
function parseZcwHTML(html) {
  console.log('开始解析中彩网的HTML内容');
  const results = [];
  
  try {
    // 查找包含开奖记录的表格
    const tableMatch = html.match(/<table[^>]*id="kjhmb"[^>]*>([\s\S]*?)<\/table>/);
    
    if (!tableMatch) {
      console.log('未找到包含开奖记录的表格');
      return results;
    }
    
    const tableContent = tableMatch[1];
    
    // 提取表格行
    const rows = tableContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/g);
    
    if (!rows) {
      console.log('未找到表格行');
      return results;
    }
    
    // 跳过表头行，从第二行开始处理数据
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      // 提取期号
      const issueMatch = row.match(/<td[^>]*class="qh"[^>]*>(\d{7})<\/td>/);
      if (!issueMatch) continue;
      const issue = issueMatch[1];
      
      // 提取日期
      const dateMatch = row.match(/<td[^>]*class="kjrq"[^>]*>(\d{4}-\d{2}-\d{2})<\/td>/);
      if (!dateMatch) continue;
      const date = dateMatch[1];
      
      // 提取红球
      const redMatch = row.match(/<td[^>]*class="red"[^>]*>(\d{2})<\/td>/g);
      if (!redMatch || redMatch.length !== 6) continue;
      // 保持文本格式，直接提取两位数文本
      const red = redMatch.map(ball => ball.match(/<td[^>]*class="red"[^>]*>(\d{2})<\/td>/)[1]).sort((a, b) => parseInt(a) - parseInt(b));
      
      // 提取蓝球
      const blueMatch = row.match(/<td[^>]*class="blue"[^>]*>(\d{2})<\/td>/);
      if (!blueMatch) continue;
      const blue = blueMatch[1]; // 保持文本格式，确保两位数
      
      // 添加到结果
      results.push({
        issue,
        red,
        blue,
        date
      });
    }
  } catch (error) {
    console.error(`解析中彩网数据失败:`, error);
  }
  
  return results;
}

// 通用彩票HTML解析函数（作为备选）
function parseGenericLotteryHTML(html) {
  console.log('开始使用通用解析函数解析HTML');
  const results = [];
  
  try {
    // 查找所有可能的开奖记录表格
    const tableMatches = html.match(/<table[^>]*>([\s\S]*?)<\/table>/g);
    
    if (!tableMatches) {
      console.log('未找到表格');
      return results;
    }
    
    // 遍历所有表格，寻找包含开奖记录的表格
    for (const tableMatch of tableMatches) {
      // 提取表格行
      const rows = tableMatch.match(/<tr[^>]*>([\s\S]*?)<\/tr>/g);
      
      if (!rows || rows.length < 5) continue;
      
      // 尝试提取数据
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        
        // 尝试提取期号（7位数字）
        const issueMatch = row.match(/(\d{7})/);
        if (!issueMatch) continue;
        const issue = issueMatch[1];
        
        // 尝试提取日期（YYYY-MM-DD格式）
        const dateMatch = row.match(/(\d{4}-\d{2}-\d{2})/);
        if (!dateMatch) continue;
        const date = dateMatch[1];
        
        // 尝试提取数字球（红球和蓝球）
        const ballsMatch = row.match(/(?:<span[^>]*>)?(\d{2})(?:<\/span>)?/g);
        if (!ballsMatch || ballsMatch.length < 7) continue;
        
        // 提取红球和蓝球
        const balls = ballsMatch.map(ball => parseInt(ball.match(/(\d{2})/)[1]));
        const red = balls.slice(0, 6).sort((a, b) => a - b);
        const blue = balls[6];
        
        // 添加到结果
        results.push({
          issue,
          red,
          blue,
          date
        });
      }
      
      // 如果找到了数据，就停止遍历其他表格
      if (results.length > 0) break;
    }
  } catch (error) {
    console.error(`解析数据失败:`, error);
  }
  
  return results;
}

// 尝试从乐彩网API获取数据
async function tryLecaiAPI() {
  const apiUrl = 'https://www.17500.cn/awardlist/ssq/1.html';
  
  try {
    console.log(`尝试从乐彩网获取数据: ${apiUrl}`);
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Referer': 'https://www.17500.cn/ssq/',
      'Accept-Language': 'zh-CN,zh;q=0.8,en-US;q=0.5,en;q=0.3'
    };
    
    // 添加随机延迟
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
    
    const response = await fetch(apiUrl, { headers });
    
    if (!response.ok) {
      console.log(`乐彩网返回错误状态: ${response.status} ${response.statusText}`);
      return [];
    }
    
    const html = await response.text();
    
    // 解析乐彩网的HTML内容
    const results = parseLecaiHTML(html);
    if (results.length > 0) {
      console.log(`从乐彩网成功解析 ${results.length} 条数据`);
      return results;
    } else {
      console.log(`从乐彩网解析数据为空`);
    }
  } catch (error) {
    console.error(`乐彩网请求失败:`, error);
  }
  
  return [];
}

// 解析乐彩网的HTML内容
function parseLecaiHTML(html) {
  console.log('开始解析乐彩网的HTML内容');
  const results = [];
  
  try {
    // 查找包含开奖记录的表格
    const tableMatch = html.match(/<table[^>]*id="table1"[^>]*>([\s\S]*?)<\/table>/);
    
    if (!tableMatch) {
      console.log('未找到包含开奖记录的表格');
      return results;
    }
    
    const tableContent = tableMatch[1];
    
    // 查找所有的开奖记录行
    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    let rowMatch;
    
    let count = 0;
    while ((rowMatch = rowPattern.exec(tableContent)) !== null && count < 1) {
      const row = rowMatch[1];
      
      // 跳过表头行
      if (row.includes('class="td_title"') || row.includes('class="td_head"')) {
        continue;
      }
      
      try {
        // 提取期号
        const issueMatch = row.match(/<td[^>]*>(?:<[^>]*>)*第(\d{4}\d{3})期(?:<[^>]*>)*<\/td>/);
        if (!issueMatch) continue;
        
        const issue = issueMatch[1];
        
        // 提取日期
        const dateMatch = row.match(/<td[^>]*>(\d{4}-\d{2}-\d{2})<\/td>/);
        if (!dateMatch) continue;
        
        const date = dateMatch[1];
        
        // 提取红球号码（出球顺序）
        const redBallPattern = /<td[^>]*class="[^>]*red[^>]*"[^>]*>([\d]{1,2})<\/td>/g;
        let redBalls = [];
        let redBallMatch;
        
        while ((redBallMatch = redBallPattern.exec(row)) !== null) {
          // 格式化为两位数文本
          const ball = String(parseInt(redBallMatch[1])).padStart(2, '0');
          redBalls.push(ball);
          if (redBalls.length === 6) break;
        }
        
        if (redBalls.length !== 6) continue;
        
        // 提取蓝球
        const blueBallMatch = row.match(/<td[^>]*class="[^>]*blue[^>]*"[^>]*>([\d]{1,2})<\/td>/);
        if (!blueBallMatch) continue;
        
        // 格式化为两位数文本
        const blue = String(parseInt(blueBallMatch[1])).padStart(2, '0');
        
        // 排序后的红球
        const sortedReds = [...redBalls].sort((a, b) => parseInt(a) - parseInt(b));
        
        results.push({
          issue,
          red: sortedReds,
          redOrder: redBalls, // 红球出球顺序
          blue,
          date
        });
        
        count++;
        console.log(`从乐彩网解析到最新数据: ${issue} ${date} ${redBalls.join(' ')} ${blue}`);
        
      } catch (e) {
        console.error(`解析乐彩网数据行失败:`, e);
      }
    }
    
  } catch (e) {
    console.error(`解析乐彩网HTML失败:`, e);
  }
  
  return results;
}

// 解析中国福利彩票官网HTML
function parseCWLHTML(html) {
  const results = [];
  
  try {
    console.log('开始解析中国福利彩票官网HTML...');
    
    // 查找开奖信息表格，使用更灵活的正则表达式
    const tableRegex = /<table[^>]*class="[^"]*kj_tablelist02[^"]*"[^>]*>([\s\S]*?)<\/table>/;
    const tableMatch = html.match(tableRegex);
    
    if (!tableMatch || !tableMatch[1]) {
      console.log('未找到开奖信息表格，尝试其他可能的表格结构');
      
      // 尝试查找所有可能的表格
      const allTablesRegex = /<table[^>]*>([\s\S]*?)<\/table>/g;
      const allTables = [...html.matchAll(allTablesRegex)];
      console.log(`找到 ${allTables.length} 个表格`);
      
      // 如果找到多个表格，尝试分析每个表格
      for (let j = 0; j < allTables.length; j++) {
        const tableContent = allTables[j][1];
        
        // 检查表格是否包含开奖相关信息
        if (tableContent.includes('td_kj_qh') || tableContent.includes('td_kj_date') || tableContent.includes('td_kj_ball')) {
          console.log(`表格 ${j} 可能包含开奖信息`);
          
          // 提取表格行数据
          const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
          const rows = [...tableContent.matchAll(rowRegex)];
          console.log(`表格 ${j} 包含 ${rows.length} 行`);
          
          // 遍历行数据（跳过表头）
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i][1];
            
            // 提取期号（使用更灵活的正则）
            const issueRegex = /<td[^>]*class="[^"]*td_kj_qh[^"]*"[^>]*>([\d]+)<\/td>/;
            const issueMatch = row.match(issueRegex);
            
            if (!issueMatch) continue;
            
            const issue = issueMatch[1];
            
            // 提取日期
            const dateRegex = /<td[^>]*class="[^"]*td_kj_date[^"]*"[^>]*>([\d]{4}-[\d]{2}-[\d]{2})<\/td>/;
            const dateMatch = row.match(dateRegex);
            
            if (!dateMatch) continue;
            
            const date = dateMatch[1];
            
            // 提取红球
            const redRegex = /<td[^>]*class="[^"]*td_kj_ball[^"]*red[^"]*"[^>]*>([\d]{2})<\/td>/g;
            const redMatches = [...row.matchAll(redRegex)];
            
            if (redMatches.length !== 6) continue;
            
            const redOrder = redMatches.map(match => match[1]);
            const red = [...redOrder].sort((a, b) => a - b);
            
            // 提取蓝球
            const blueRegex = /<td[^>]*class="[^"]*td_kj_ball[^"]*blue[^"]*"[^>]*>([\d]{2})<\/td>/;
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
            
            console.log(`成功解析: 期号 ${issue}, 日期 ${date}, 红球 ${red}, 蓝球 ${blue}`);
          }
          
          // 如果已经找到数据，不再继续查找其他表格
          if (results.length > 0) {
            break;
          }
        }
      }
      
      return results;
    }
    
    const tableContent = tableMatch[1];
    console.log('找到开奖信息表格');
    
    // 提取表格行数据
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    const rows = [...tableContent.matchAll(rowRegex)];
    console.log(`表格包含 ${rows.length} 行`);
    
    // 遍历行数据（跳过表头）
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i][1];
      
      // 提取期号
      const issueRegex = /<td[^>]*class="[^"]*td_kj_qh[^"]*"[^>]*>([\d]+)<\/td>/;
      const issueMatch = row.match(issueRegex);
      
      if (!issueMatch) continue;
      
      const issue = issueMatch[1];
      
      // 提取日期
      const dateRegex = /<td[^>]*class="[^"]*td_kj_date[^"]*"[^>]*>([\d]{4}-[\d]{2}-[\d]{2})<\/td>/;
      const dateMatch = row.match(dateRegex);
      
      if (!dateMatch) continue;
      
      const date = dateMatch[1];
      
      // 提取红球
      const redRegex = /<td[^>]*class="[^"]*td_kj_ball[^"]*red[^"]*"[^>]*>([\d]{2})<\/td>/g;
      const redMatches = [...row.matchAll(redRegex)];
      
      if (redMatches.length !== 6) continue;
      
      const redOrder = redMatches.map(match => match[1]);
      // 使用数值比较进行排序，确保正确的数字排序
      const red = [...redOrder].sort((a, b) => parseInt(a) - parseInt(b));
      
      // 提取蓝球
      const blueRegex = /<td[^>]*class="[^"]*td_kj_ball[^"]*blue[^"]*"[^>]*>([\d]{2})<\/td>/;
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
      
      console.log(`成功解析: 期号 ${issue}, 日期 ${date}, 红球 ${red}, 蓝球 ${blue}`);
    }
    
    console.log(`成功解析到 ${results.length} 条开奖记录`);
  } catch (error) {
    console.error('解析中国福利彩票官网HTML失败:', error);
    console.error('错误堆栈:', error.stack);
  }
  
  return results;
}

// 解析6.17500.cn网站的HTML内容（已弃用）
function parse17500HTML(html) {
  return [];
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
      console.log(`跳过不合法期号: ${issue}`);
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
