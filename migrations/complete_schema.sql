-- =====================================================
-- 双色球选号系统 - 完整数据库架构
-- =====================================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 用户会话表
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id)
);

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

-- 用户生成的号码记录表
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

-- =====================================================
-- 索引创建
-- =====================================================

-- 用户相关索引
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);

-- 会话相关索引
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions (session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

-- 历史开奖号码索引（用于快速查询和去重）
CREATE INDEX IF NOT EXISTS idx_lottery_history_red_1 ON lottery_history (red_1);
CREATE INDEX IF NOT EXISTS idx_lottery_history_red_2 ON lottery_history (red_2);
CREATE INDEX IF NOT EXISTS idx_lottery_history_red_3 ON lottery_history (red_3);
CREATE INDEX IF NOT EXISTS idx_lottery_history_red_4 ON lottery_history (red_4);
CREATE INDEX IF NOT EXISTS idx_lottery_history_red_5 ON lottery_history (red_5);
CREATE INDEX IF NOT EXISTS idx_lottery_history_red_6 ON lottery_history (red_6);
CREATE INDEX IF NOT EXISTS idx_lottery_history_blue ON lottery_history (blue);
CREATE INDEX IF NOT EXISTS idx_lottery_history_issue_number ON lottery_history (issue_number);
CREATE INDEX IF NOT EXISTS idx_lottery_history_draw_date ON lottery_history (draw_date);

-- 用户生成号码索引
CREATE INDEX IF NOT EXISTS idx_user_numbers_user_id ON user_numbers (user_id);
CREATE INDEX IF NOT EXISTS idx_user_numbers_generated_at ON user_numbers (generated_at);

-- =====================================================
-- 组合索引（用于更复杂的查询）
-- =====================================================

-- 用户生成号码的组合索引（用于查询某用户的所有生成记录）
CREATE INDEX IF NOT EXISTS idx_user_numbers_user_generated ON user_numbers (user_id, generated_at DESC);

-- 历史开奖的组合索引（用于按日期排序查询）
CREATE INDEX IF NOT EXISTS idx_lottery_history_date_issue ON lottery_history (draw_date DESC, issue_number);

-- =====================================================
-- 数据完整性约束（SQLite已通过外键实现）
-- =====================================================

-- 插入示例数据（可选，用于测试）
-- INSERT OR IGNORE INTO users (username, password) VALUES ('admin', '$2a$10$placeholder_hash');

-- =====================================================
-- 表统计信息（可选，用于性能优化）
-- =====================================================

-- ANALYZE;  -- 在插入初始数据后可以运行此命令优化查询计划