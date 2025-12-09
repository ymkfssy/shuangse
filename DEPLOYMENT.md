# 双色球选号系统部署指南

## 概述

这个项目是一个基于 Cloudflare Workers 和 D1 数据库的双色球选号系统，支持自动爬取历史开奖数据、用户登录注册、生成未出现过的号码等功能。

## 部署步骤

### 1. 环境准备

确保你已经安装了 Node.js (v16+) 和 Wrangler CLI。

```bash
# 安装 Wrangler CLI
npm install -g wrangler

# 登录 Cloudflare 账号
npx wrangler login
```

### 2. 项目设置

```bash
# 安装项目依赖
npm install
```

### 3. 创建 D1 数据库

```bash
# 创建 D1 数据库
npx wrangler d1 create shuangse-lottery-db

# 记录返回的 database_id，然后更新 wrangler.toml 文件中的 database_id
```

### 4. 执行数据库迁移

```bash
# 执行完整数据库结构迁移
npx wrangler d1 execute shuangse-lottery-db --file=./migrations/complete_schema.sql
```

### 5. 创建 KV 命名空间（如果不存在）

```bash
# 创建生产环境 KV 命名空间
npx wrangler kv:namespace create "__shuangse-workers_sites_assets"

# 创建预览环境 KV 命名空间
npx wrangler kv:namespace create "__shuangse-workers_sites_assets" --preview

# 更新 wrangler.toml 中的 KV ID
```

### 6. 本地测试

```bash
# 启动本地开发服务器
npm run dev

# 测试访问 http://localhost:8787/login.html
```

### 7. 部署到 Cloudflare

```bash
# 部署到生产环境
npm run deploy
```

## 配置说明

### wrangler.toml 配置

确保以下配置正确：

```toml
name = "shuangse"
main = "src/index.js"
workers_dev = true
compatibility_date = "2024-01-29"

[site]
bucket = "public"

[[d1_databases]]
binding = "DB"
database_id = "你的实际数据库ID"

[triggers]
crons = ["0 10 * * 1,3,5"]  # 每周一、三、五上午10点执行爬取
```

## 定时任务

系统配置了定时任务，每周一、周三、周五的上午10点自动从官方网站爬取最新的双色球开奖数据。

Cron 表达式：`0 10 * * 1,3,5`

## 功能特性

1. **用户认证系统**
   - 用户注册和登录
   - 会话管理和安全性
   - 自动会话过期

2. **号码生成**
   - 智能生成从未出现过的双色球号码
   - 最多尝试1000次保证唯一性
   - 记录用户生成历史

3. **数据爬取**
   - 自动从 https://www.cwl.gov.cn/ygkj/wqkjgg/ 爬取数据
   - 定时任务自动更新
   - 手动更新功能

4. **用户界面**
   - 响应式设计
   - 实时统计显示
   - 历史开奖查看

## 故障排除

### 常见问题

1. **数据库连接失败**
   - 检查 wrangler.toml 中的 database_id 是否正确
   - 确保数据库迁移已正确执行

2. **定时任务不执行**
   - 检查 crons 表达式格式
   - 确保已部署到生产环境

3. **爬取数据失败**
   - 检查目标网站结构是否变化
   - 查看 Worker 日志获取详细错误信息

4. **会话验证失败**
   - 确保会话表已正确创建
   - 检查数据库索引是否创建

### 日志查看

```bash
# 查看实时日志
npx wrangler tail

# 查看特定日志
npx wrangler tail --format=json
```

## 安全注意事项

1. 定期更新依赖包
2. 监控异常访问模式
3. 定期清理过期会话
4. 限制爬取频率避免被封禁

## 维护和更新

1. **数据库备份**：定期导出 D1 数据库数据
2. **更新爬虫逻辑**：如果目标网站结构变化，需要更新解析代码
3. **性能监控**：监控 Worker 性能和资源使用情况

## 许可证

MIT License