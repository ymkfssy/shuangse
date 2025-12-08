// 数据库设置脚本
// 用于初始化D1数据库
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
  console.log('开始设置双色球数据库...');
  
  try {
    // 读取迁移文件
    const migrationPath = path.join(__dirname, '../migrations/001_initial.sql');
    const sessionsMigrationPath = path.join(__dirname, '../migrations/002_add_sessions.sql');
    
    const initialSQL = fs.readFileSync(migrationPath, 'utf8');
    const sessionsSQL = fs.readFileSync(sessionsMigrationPath, 'utf8');
    
    console.log('✓ 迁移文件读取成功');
    
    // 这里需要实际的D1数据库连接来执行SQL
    // 在实际部署时，这些SQL会通过 wrangler d1 execute 命令执行
    
    console.log('\n要完成数据库设置，请运行以下命令:');
    console.log('1. 创建数据库:');
    console.log('   npx wrangler d1 create shuangse-lottery-db');
    console.log('\n2. 更新 wrangler.toml 中的 database_id');
    console.log('\n3. 执行初始迁移:');
    console.log('   npx wrangler d1 execute shuangse-lottery-db --file=./migrations/001_initial.sql');
    console.log('\n4. 执行会话表迁移:');
    console.log('   npx wrangler d1 execute shuangse-lottery-db --file=./migrations/002_add_sessions.sql');
    
    console.log('\n✓ 数据库设置脚本准备完成');
    
  } catch (error) {
    console.error('✗ 数据库设置失败:', error.message);
  }
}

// 导出函数
module.exports = { setupDatabase };

// 如果直接运行此脚本
if (require.main === module) {
  setupDatabase();
}