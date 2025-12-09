# 双色球选号系统部署指南

## 概述

本指南详细介绍了双色球选号系统的部署流程，包括环境准备、依赖安装、数据库配置、本地测试和生产部署等步骤。该系统基于 Cloudflare Workers 和 D1 数据库开发，支持自动爬取历史开奖数据、用户认证、号码生成和分析等功能。

## 目录

- [环境要求](#环境要求)
- [安装步骤](#安装步骤)
- [数据库配置](#数据库配置)
- [KV 命名空间配置](#kv-命名空间配置)
- [本地开发与测试](#本地开发与测试)
- [生产环境部署](#生产环境部署)
- [配置说明](#配置说明)
- [定时任务](#定时任务)
- [常见问题解决方案](#常见问题解决方案)

## 环境要求

- **Node.js**: v16 或更高版本
- **npm**: v8 或更高版本
- **Cloudflare 账号**: 需要注册并登录 Cloudflare
- **Wrangler CLI**: Cloudflare Workers 的命令行工具

## 安装步骤

### 1. 安装 Wrangler CLI

```bash
# 全局安装 Wrangler CLI
npm install -g wrangler

# 或者使用 npx 直接运行
npx wrangler --version
```

### 2. 登录 Cloudflare

```bash
# 登录 Cloudflare 账号
npx wrangler login
```

执行命令后，会打开浏览器并引导你完成登录过程。

### 3. 克隆项目

```bash
# 克隆项目仓库
git clone <repository-url>
cd shuangse-lottery

# 安装项目依赖
npm install
```

## 数据库配置

### 1. 创建 D1 数据库

```bash
# 创建 D1 数据库
npx wrangler d1 create shuangse-lottery-db
```

执行命令后，会返回数据库的 ID 和连接信息，记录下 `database_id`，用于后续配置。

### 2. 更新配置文件

编辑 `wrangler.toml` 文件，将 `database_id` 替换为实际的数据库 ID：

```toml
[[d1_databases]]
binding = "DB"
database_id = "你的实际数据库ID"
```

### 3. 执行数据库迁移

```bash
# 执行数据库结构迁移
npx wrangler d1 execute shuangse-lottery-db --file=./migrations/complete_schema.sql
```

该命令会创建系统所需的所有数据库表和结构。

## KV 命名空间配置

### 1. 创建 KV 命名空间

```bash
# 创建生产环境 KV 命名空间
npx wrangler kv:namespace create SESSION_KV

# 创建预览环境 KV 命名空间
npx wrangler kv:namespace create SESSION_KV --preview
```

执行命令后，会返回 KV 命名空间的 ID，记录下 `id` 和 `preview_id`。

### 2. 更新配置文件

编辑 `wrangler.toml` 文件，添加 KV 命名空间配置：

```toml
[[kv_namespaces]]
binding = "SESSION_KV"
id = "你的生产环境KV命名空间ID"
preview_id = "你的预览环境KV命名空间ID"
```

## 本地开发与测试

### 1. 启动本地开发服务器

```bash
# 启动本地开发服务器
npm run dev
```

### 2. 测试访问

服务器启动后，访问以下地址：
- 登录页面：http://localhost:8787/login.html
- 主应用页面：http://localhost:8787/app.html
- 号码分析页面：http://localhost:8787/analysis.html

### 3. 功能测试

- 注册新用户
- 登录系统
- 生成新号码
- 获取最新开奖数据
- 查看号码分析

## 生产环境部署

### 1. 部署到 Cloudflare

```bash
# 部署到生产环境
npm run deploy
```

### 2. 验证部署

部署完成后，访问 Cloudflare Workers 控制台，找到部署的 Worker，查看分配的域名。通过该域名访问系统，验证所有功能是否正常。

## 配置说明

### wrangler.toml 配置

完整的配置文件示例：

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

[[kv_namespaces]]
binding = "SESSION_KV"
id = "你的生产环境KV命名空间ID"
preview_id = "你的预览环境KV命名空间ID"

[triggers]
crons = ["0 10 * * 1,3,5"]  # 每周一、三、五上午10点执行爬取
```

### 配置参数说明

- `name`: Worker 的名称
- `main`: 主入口文件路径
- `workers_dev`: 是否启用 workers.dev 域名
- `compatibility_date`: 兼容性日期
- `[site]`: 静态网站配置
  - `bucket`: 静态资源目录
- `[[d1_databases]]`: D1 数据库配置
  - `binding`: 数据库绑定名称
  - `database_id`: 数据库 ID
- `[[kv_namespaces]]`: KV 命名空间配置
  - `binding`: KV 绑定名称
  - `id`: 生产环境 KV 命名空间 ID
  - `preview_id`: 预览环境 KV 命名空间 ID
- `[triggers]`: 定时任务配置
  - `crons`: Cron 表达式数组，定义定时任务执行时间

## 定时任务

系统配置了定时任务，每周一、周三、周五的上午10点自动从官方网站爬取最新的双色球开奖数据。

Cron 表达式：`0 10 * * 1,3,5`

- `0`: 分钟 (0-59)
- `10`: 小时 (0-23)
- `*`: 日 (1-31)
- `*`: 月 (1-12)
- `1,3,5`: 周 (0-6，其中 0 代表周日，1 代表周一，以此类推)

## 常见问题解决方案

### 1. 数据库连接失败

**问题描述**：本地开发或部署时，出现数据库连接失败的错误。

**解决方案**：
- 检查 `wrangler.toml` 文件中的 `database_id` 是否正确
- 确认已经执行了数据库迁移命令
- 检查 Cloudflare D1 数据库是否已经创建成功

### 2. KV 命名空间错误

**问题描述**：出现 KV 命名空间相关的错误。

**解决方案**：
- 检查 `wrangler.toml` 文件中的 KV 命名空间配置是否正确
- 确认已经创建了 KV 命名空间，并且 `id` 和 `preview_id` 正确

### 3. 本地开发服务器无法启动

**问题描述**：执行 `npm run dev` 命令后，服务器无法启动。

**解决方案**：
- 检查 Node.js 版本是否符合要求
- 重新安装项目依赖：`npm install`
- 检查 `wrangler.toml` 文件是否有语法错误

### 4. 部署失败

**问题描述**：执行 `npm run deploy` 命令后，部署失败。

**解决方案**：
- 检查网络连接是否正常
- 确认 Cloudflare 账号是否有足够的权限
- 查看部署日志，根据错误信息进行排查

### 5. 定时任务不执行

**问题描述**：配置的定时任务没有按预期执行。

**解决方案**：
- 检查 `wrangler.toml` 文件中的 Cron 表达式是否正确
- 确认 Worker 已经成功部署到生产环境
- 查看 Cloudflare Workers 控制台的日志，检查定时任务执行情况

## 维护与更新

### 更新项目代码

```bash
# 拉取最新代码
git pull origin main

# 重新部署
npm run deploy
```

### 更新依赖

```bash
# 更新项目依赖
npm update

# 重新部署
npm run deploy
```

### 数据库备份与恢复

```bash
# 备份数据库
npx wrangler d1 execute shuangse-lottery-db --command="SELECT * FROM lottery_history" > backup.sql

# 恢复数据库
npx wrangler d1 execute shuangse-lottery-db --file=./backup.sql
```

## 联系方式

如有其他问题或建议，请通过以下方式联系：

- 项目仓库：<repository-url>
- 维护者：<maintainer-email>

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