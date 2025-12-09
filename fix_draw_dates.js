// 修正历史双色球开奖日期的脚本
import { getDB } from './src/database.js';

// 已知的最后正确开奖信息：期号2025141，日期2025-12-07（周日）
const LAST_CORRECT_ISSUE = '2025141';
const LAST_CORRECT_DATE = new Date('2025-12-07');

// 开奖周期：周二、周四、周日
const DRAW_DAYS = [2, 4, 0]; // 0=周日, 1=周一, ..., 6=周六

// 获取所有历史数据
async function getAllHistoryData(env) {
  try {
    const db = getDB(env);
    const results = await db.prepare(
      `SELECT id, issue_number, draw_date 
       FROM lottery_history 
       ORDER BY issue_number DESC`
    ).all();
    return results.results;
  } catch (error) {
    console.error('获取历史数据失败:', error);
    return [];
  }
}

// 根据已知的最后正确日期和期号，计算所有期号的正确日期
function calculateCorrectDates(historyData) {
  // 找到最后正确的记录
  const lastCorrectIndex = historyData.findIndex(item => item.issue_number === LAST_CORRECT_ISSUE);
  if (lastCorrectIndex === -1) {
    console.error('未找到最后正确的期号:', LAST_CORRECT_ISSUE);
    return [];
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

  return correctedData;
}

// 更新数据库中的开奖日期
async function updateDrawDates(correctedData, env) {
  try {
    const db = getDB(env);
    let updatedCount = 0;

    for (const item of correctedData) {
      if (item.current_draw_date !== item.correct_draw_date) {
        await db.prepare(
          `UPDATE lottery_history SET draw_date = ? WHERE id = ?`
        ).bind(item.correct_draw_date, item.id).run();
        updatedCount++;
        console.log(`已更新期号 ${item.issue_number}: ${item.current_draw_date} -> ${item.correct_draw_date}`);
      } else {
        console.log(`期号 ${item.issue_number} 的日期已经正确: ${item.current_draw_date}`);
      }
    }

    return updatedCount;
  } catch (error) {
    console.error('更新开奖日期失败:', error);
    return 0;
  }
}

// 创建一个测试环境（模拟Cloudflare Workers环境）
function createTestEnv() {
  return {
    DB: {
      exec: async () => {},
      prepare: () => ({
        bind: () => ({
          all: () => ({ results: [] }),
          run: () => ({})
        })
      })
    }
  };
}

// 主函数
async function main(env = createTestEnv()) {
  console.log('开始修正双色球历史开奖日期...');
  
  // 获取所有历史数据
  const historyData = await getAllHistoryData(env);
  console.log(`共获取到 ${historyData.length} 条历史记录`);
  
  // 计算正确的日期
  const correctedData = calculateCorrectDates(historyData);
  console.log(`需要检查 ${correctedData.length} 条记录的日期`);
  
  // 更新数据库
  const updatedCount = await updateDrawDates(correctedData, env);
  console.log(`更新完成，共修改了 ${updatedCount} 条记录的日期`);
  
  console.log('双色球历史开奖日期修正完成！');
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  // 注意：这个脚本需要在支持Cloudflare Workers环境或使用Wrangler CLI运行
  console.warn('此脚本需要在Cloudflare Workers环境或使用Wrangler CLI运行。');
  console.warn('请使用命令: wrangler script fix_draw_dates.js');
}

export { main, calculateCorrectDates };