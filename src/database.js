// 数据库初始化SQL
const INIT_SQL = `
  -- 用户表
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 会话表
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  -- 历史双色球号码表
  CREATE TABLE IF NOT EXISTS lottery_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_number TEXT UNIQUE NOT NULL,
    red_1 INTEGER NOT NULL,
    red_2 INTEGER NOT NULL,
    red_3 INTEGER NOT NULL,
    red_4 INTEGER NOT NULL,
    red_5 INTEGER NOT NULL,
    red_6 INTEGER NOT NULL,
    blue INTEGER NOT NULL,
    draw_date DATE NOT NULL,
    prize_pool TEXT,
    first_prize_count INTEGER,
    first_prize_amount TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 用户生成的号码表
  CREATE TABLE IF NOT EXISTS user_numbers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    red_1 INTEGER NOT NULL,
    red_2 INTEGER NOT NULL,
    red_3 INTEGER NOT NULL,
    red_4 INTEGER NOT NULL,
    red_5 INTEGER NOT NULL,
    red_6 INTEGER NOT NULL,
    blue INTEGER NOT NULL,
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  -- 索引创建
  CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions (session_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);
  CREATE INDEX IF NOT EXISTS idx_lottery_history_red_1 ON lottery_history (red_1);
  CREATE INDEX IF NOT EXISTS idx_lottery_history_red_2 ON lottery_history (red_2);
  CREATE INDEX IF NOT EXISTS idx_lottery_history_red_3 ON lottery_history (red_3);
  CREATE INDEX IF NOT EXISTS idx_lottery_history_red_4 ON lottery_history (red_4);
  CREATE INDEX IF NOT EXISTS idx_lottery_history_red_5 ON lottery_history (red_5);
  CREATE INDEX IF NOT EXISTS idx_lottery_history_red_6 ON lottery_history (red_6);
  CREATE INDEX IF NOT EXISTS idx_lottery_history_blue ON lottery_history (blue);
  CREATE INDEX IF NOT EXISTS idx_user_numbers_user_id ON user_numbers (user_id);
`;

// 初始化数据库
export async function initDatabase(env) {
  try {
    await env.DB.exec(INIT_SQL);
    return { success: true, message: 'Database initialized successfully' };
  } catch (error) {
    return { success: false, message: `Database initialization failed: ${error.message}` };
  }
}

// 导出数据库操作函数
export function getDB(env) {
  return env.DB;
}
