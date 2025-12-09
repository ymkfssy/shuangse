# 双色球选号系统

一个基于Cloudflare Workers和D1数据库开发的双色球选号系统，支持自动爬取历史开奖数据、随机生成未出现过的号码，并提供用户认证功能。

## 功能特性

- ✅ 用户登录/注册系统
- ✅ 自动爬取历史双色球开奖数据
- ✅ 随机生成从未出现过的双色球号码
- ✅ 历史开奖数据展示
- ✅ 个人生成号码记录
- ✅ 响应式设计，支持移动端访问

## 技术栈

- **前端**: HTML5, CSS3, JavaScript
- **后端**: Cloudflare Workers
- **数据库**: Cloudflare D1
- **存储**: Cloudflare KV
- **部署**: Wrangler CLI

## 项目结构

```
shuangse-lottery/
├── public/                 # 静态资源文件
│   ├── login.html         # 登录页面
│   └── app.html           # 主应用页面
├── src/                   # 源代码
│   ├── index.js           # 主入口文件
│   ├── auth.js            # 认证功能
│   ├── lottery.js         # 双色球核心功能
│   └── database.js        # 数据库操作
├── migrations/            # 数据库迁移文件
│   └── complete_schema.sql # 完整数据库结构
├── wrangler.toml          # Cloudflare Workers配置
├── wrangler-simple.toml   # 简化版配置文件
├── package.json           # 项目依赖
├── package-lock.json      # 依赖锁定文件
├── DEPLOYMENT.md          # 部署指南
└── README.md              # 项目说明
```

## 快速开始

### 1. 环境准备

- 安装Node.js (v16+)
- 安装Wrangler CLI: `npm install -g wrangler`
- 登录Cloudflare: `npx wrangler login`

### 2. 数据库配置

1. 创建D1数据库:
   ```bash
   wrangler d1 create shuangse-lottery-db
   ```

2. 更新`wrangler.toml`文件中的`database_id`为实际的数据库ID

### 3. KV配置

1. 创建KV命名空间:
   ```bash
   wrangler kv:namespace create SESSION_KV
   wrangler kv:namespace create SESSION_KV --preview
   ```

2. 更新`wrangler.toml`文件中的`id`和`preview_id`

### 4. 本地开发

```bash
npm install
npm run dev
```

访问 `http://localhost:8787/login.html` 开始使用

### 5. 部署到Cloudflare

```bash
npm run deploy
```

## 使用说明

1. **注册/登录**: 首先需要注册一个账号或登录已有账号
2. **生成号码**: 点击"生成新号码"按钮获取一组从未出现过的双色球号码
3. **查看历史**: 页面下方显示最近的历史开奖数据
4. **更新数据**: 点击"更新历史数据"按钮爬取最新的开奖信息
5. **退出登录**: 点击右上角"退出登录"按钮

## 核心功能说明

### 号码生成算法

系统使用以下步骤生成未出现过的双色球号码:
1. 随机生成6个不重复的红球号码(1-33)
2. 随机生成1个蓝球号码(1-16)
3. 检查该组合是否在历史开奖数据中存在
4. 如果存在则重新生成，最多尝试1000次

### 历史数据爬取

系统会自动从官方网站爬取历史开奖数据，包括:
- 期号
- 开奖日期
- 红球号码
- 蓝球号码
- 奖池金额
- 一等奖中奖注数和金额

## 注意事项

1. 本系统仅用于娱乐，不保证中奖
2. 请理性购彩，量力而行
3. 实际部署时需要替换`wrangler.toml`中的配置为真实值
4. 生产环境建议启用HTTPS

## License

MIT License

## 贡献

欢迎提交Issue和Pull Request来改进这个项目！
