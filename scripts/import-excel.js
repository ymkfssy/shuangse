const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const sqlite3 = require('sqlite3').verbose();

// 配置
const EXCEL_PATH = path.join(__dirname, '../migrations/shuangse.xlsx');
const DB_PATH = path.join(__dirname, '../db/shuangse.db');

console.log('开始导入Excel数据到数据库...');

// 确保数据库目录存在
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// 创建数据库连接
const db = new sqlite3.Database(DB_PATH);

// 创建表结构（如果不存在）
db.exec(`
-- 历史双色球开奖记录表
CREATE TABLE IF NOT EXISTS lottery_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_number TEXT UNIQUE NOT NULL,
  red_1 INTEGER NOT NULL,
  red_2 INTEGER NOT NULL,
  red_3 INTEGER NOT NULL,
  red_4 INTEGER NOT NULL,
  red_5 INTEGER NOT NULL,
  red_6 INTEGER NOT NULL,
  red_1_order INTEGER NOT NULL,
  red_2_order INTEGER NOT NULL,
  red_3_order INTEGER NOT NULL,
  red_4_order INTEGER NOT NULL,
  red_5_order INTEGER NOT NULL,
  red_6_order INTEGER NOT NULL,
  blue INTEGER NOT NULL,
  draw_date DATE NOT NULL,
  prize_pool TEXT,
  first_prize_count INTEGER,
  first_prize_amount TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`, (err) => {
  if (err) {
    console.error('创建表结构失败:', err.message);
    return;
  }
  console.log('表结构创建成功');
  
  // 读取Excel文件
  const workbook = xlsx.readFile(EXCEL_PATH);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  
  // 转换为JSON数据
  const jsonData = xlsx.utils.sheet_to_json(worksheet, {
    header: 1, // 使用第一行作为标题
    range: 1   // 从第二行开始读取数据
  });
  
  console.log(`从Excel读取到 ${jsonData.length} 条数据`);
  
  // 准备插入语句
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO lottery_history (
      issue_number, red_1, red_2, red_3, red_4, red_5, red_6,
      red_1_order, red_2_order, red_3_order, red_4_order, red_5_order, red_6_order,
      blue, draw_date, prize_pool, first_prize_count, first_prize_amount
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  let insertedCount = 0;
  let skippedCount = 0;
  
  // 处理每一行数据
  jsonData.forEach((row, index) => {
    try {
      // 假设Excel列结构：期号, 日期, 红球1, 红球2, 红球3, 红球4, 红球5, 红球6, 蓝球, 奖池, 一等奖注数, 一等奖金额
      const [issue, date, red1, red2, red3, red4, red5, red6, blue, prizePool, firstPrizeCount, firstPrizeAmount] = row;
      
      if (!issue || !date || !red1 || !blue) {
        console.log(`跳过无效行 ${index + 2}:`, row);
        skippedCount++;
        return;
      }
      
      // 格式化数据
      const formattedIssue = String(issue).trim();
      const formattedDate = date instanceof Date ? date.toISOString().split('T')[0] : String(date).trim();
      
      // 红球按开奖顺序保存（这里假设Excel中的红球顺序就是开奖顺序）
      const redOrder = [red1, red2, red3, red4, red5, red6].map(Number);
      
      // 红球按大小排序保存
      const redSorted = [...redOrder].sort((a, b) => a - b);
      
      // 执行插入
      stmt.run(
        formattedIssue, redSorted[0], redSorted[1], redSorted[2], redSorted[3], redSorted[4], redSorted[5],
        redOrder[0], redOrder[1], redOrder[2], redOrder[3], redOrder[4], redOrder[5],
        Number(blue), formattedDate, String(prizePool || ''), Number(firstPrizeCount || 0), String(firstPrizeAmount || '')
      );
      
      insertedCount++;
      
      // 每100条数据显示进度
      if (insertedCount % 100 === 0) {
        console.log(`已处理 ${insertedCount} 条数据`);
      }
      
    } catch (error) {
      console.error(`处理行 ${index + 2} 时出错:`, error.message);
      console.error('行数据:', row);
      skippedCount++;
    }
  });
  
  // 完成插入
  stmt.finalize((err) => {
    if (err) {
      console.error('插入数据失败:', err.message);
    } else {
      console.log('\n数据导入完成！');
      console.log(`总记录数: ${jsonData.length}`);
      console.log(`成功插入: ${insertedCount}`);
      console.log(`跳过记录: ${skippedCount}`);
    }
    
    // 关闭数据库连接
    db.close();
  });
});

console.log('数据导入脚本已启动');
