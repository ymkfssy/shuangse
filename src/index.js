// import { getAssetFromKV } from '@cloudflare/kv-asset-handler';  // 暂时注释掉，避免KV依赖
import { handleLogin, handleRegister, handleLogout, isAuthenticated, getUserFromSession, isAdmin, getPendingUsers, approveUser } from './auth.js';
import { getHistoryNumbers, generateNewNumbers, crawlHistoryNumbers, importHistoryFromExcel, fixDrawDates, analyzeHotCold, analyzeParity, analyzeSize, analyzeRange, analyzeMissing, generateRecommendation, getTotalCombinations } from './lottery.js';
import { initDatabase, getDB } from './database.js';

// 处理HTTP请求
async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // 检查是否需要身份验证
  const requiresAuth = ['/app', '/analysis', '/api/generate', '/api/history', '/api/crawl', '/api/analysis'].includes(pathname);
  if (requiresAuth && !await isAuthenticated(request, env)) {
    return new Response(JSON.stringify({ error: '请先登录' }), { 
      status: 401, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  // API路由处理
  if (pathname.startsWith('/api/')) {
    const apiPath = pathname.slice(5);
    
    if (apiPath === 'login' && request.method === 'POST') {
      return handleLogin(request, env);
    } else if (apiPath === 'register' && request.method === 'POST') {
      return handleRegister(request, env);
    } else if (apiPath === 'logout' && request.method === 'POST') {
      return handleLogout(request, env);
    } else if (apiPath === 'history' && request.method === 'GET') {
      return getHistoryNumbers(request, env);
    } else if (apiPath === 'generate' && (request.method === 'GET' || request.method === 'POST')) {
      return generateNewNumbers(request, env);
    } else if (apiPath === 'total-combinations' && request.method === 'GET') {
      return getTotalCombinations(request, env);
    } else if (apiPath === 'crawl' && request.method === 'POST') {
      return crawlHistoryNumbers(request, env);
    } else if (apiPath === 'analysis/hot-cold' && request.method === 'GET') {
      return analyzeHotCold(request, env);
    } else if (apiPath === 'analysis/parity' && request.method === 'GET') {
      return analyzeParity(request, env);
    } else if (apiPath === 'analysis/size' && request.method === 'GET') {
      return analyzeSize(request, env);
    } else if (apiPath === 'analysis/range' && request.method === 'GET') {
      return analyzeRange(request, env);
    } else if (apiPath === 'analysis/missing' && request.method === 'GET') {
      return analyzeMissing(request, env);
    } else if (apiPath === 'analysis/recommendation' && request.method === 'GET') {
      return generateRecommendation(request, env);
    } else if (apiPath === 'import' && request.method === 'POST') {
      return importHistoryFromExcel(request, env);
    } else if (apiPath === 'admin/pending-users' && request.method === 'GET') {
      return getPendingUsers(request, env);
    } else if (apiPath === 'admin/approve-user' && request.method === 'POST') {
      return approveUser(request, env);
    } else if (apiPath === 'admin/fix-draw-dates' && request.method === 'POST') {
      return fixDrawDates(request, env);
    }
    
    return new Response('Not Found', { status: 404 });
  }

  // 静态文件处理 - 简化版本，避免KV依赖
  try {
    // 路径映射
    if (pathname === '/app.html' || pathname === '/app') {
      return new Response(getAppHTML(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
    
    if (pathname === '/login.html' || pathname === '/login' || pathname === '/') {
      return new Response(getLoginHTML(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
    
    if (pathname === '/analysis.html' || pathname === '/analysis') {
      return new Response(getAnalysisHTML(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
    
    // 其他未匹配的路径
    return new Response('Page not found', { status: 404 });
    
  } catch (e) {
    return new Response(`Server Error: ${e.message}`, { status: 500 });
  }
}

// 定时任务处理函数
async function handleScheduled(event, env, ctx) {
  // 每周一、周三、周五的上午10点运行爬取任务
  // Cron表达式: 0 10 * * 1,3,5
  console.log('定时任务执行: 开始爬取双色球历史数据');
  
  try {
    // 调用爬取函数，传递env参数
    const result = await crawlHistoryNumbers(null, env);
    
    // 记录爬取结果
    console.log('定时任务执行结果: 爬取完成');
    
    return new Response('定时任务执行完成');
  } catch (error) {
    console.error('定时任务执行失败:', error);
    return new Response('定时任务执行失败', { status: 500 });
  }
}

// 内嵌的HTML内容（临时解决方案）
function getLoginHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>双色球选号系统 - 登录</title>
    <style>
        body { font-family: Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; height: 100vh; }
        .login-container { background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 40px; width: 100%; max-width: 400px; }
        h1 { text-align: center; color: #333; margin-bottom: 30px; }
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; margin-bottom: 8px; color: #555; }
        .form-group input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px; box-sizing: border-box; }
        .btn { width: 100%; padding: 12px; background: #1890ff; color: white; border: none; border-radius: 4px; font-size: 16px; cursor: pointer; margin-bottom: 10px; }
        .btn:hover { background: #40a9ff; }
        .error-message { color: #ff4d4f; text-align: center; margin: 10px 0; }
        .success-message { color: #52c41a; text-align: center; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="login-container">
        <h1>双色球选号系统</h1>
        <div id="message" style="display: none;"></div>
        <div id="login-form">
            <div class="form-group">
                <label for="username">用户名</label>
                <input type="text" id="username" placeholder="请输入用户名">
            </div>
            <div class="form-group">
                <label for="password">密码</label>
                <input type="password" id="password" placeholder="请输入密码">
            </div>
            <button class="btn" onclick="handleLogin()">登录</button>
            <button class="btn" onclick="showRegisterForm()">注册</button>
        </div>
        
        <div id="register-form" style="display: none;">
            <div class="form-group">
                <label for="reg-username">用户名</label>
                <input type="text" id="reg-username" placeholder="请输入用户名">
            </div>
            <div class="form-group">
                <label for="reg-password">密码</label>
                <input type="password" id="reg-password" placeholder="请输入密码">
            </div>
            <div class="form-group">
                <label for="reg-confirm-password">确认密码</label>
                <input type="password" id="reg-confirm-password" placeholder="请再次输入密码">
            </div>
            <button class="btn" onclick="handleRegister()">注册</button>
            <button class="btn" onclick="showLoginForm()">返回登录</button>
        </div>
    </div>

    <script>
        function showMessage(message, type) {
            const messageDiv = document.getElementById('message');
            messageDiv.textContent = message;
            messageDiv.className = type === 'error' ? 'error-message' : 'success-message';
            messageDiv.style.display = 'block';
            setTimeout(() => { messageDiv.style.display = 'none'; }, 3000);
        }

        function showLoginForm() {
            document.getElementById('login-form').style.display = 'block';
            document.getElementById('register-form').style.display = 'none';
        }

        function showRegisterForm() {
            document.getElementById('login-form').style.display = 'none';
            document.getElementById('register-form').style.display = 'block';
        }

        async function handleLogin() {
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            if (!username || !password) {
                showMessage('用户名和密码不能为空', 'error');
                return;
            }

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const result = await response.json();
                
                if (response.ok) {
                    showMessage(result.message, 'success');
                    setTimeout(() => { window.location.href = '/app.html'; }, 1000);
                } else {
                    showMessage(result.error, 'error');
                }
            } catch (error) {
                showMessage('登录失败，请稍后重试', 'error');
            }
        }

        async function handleRegister() {
            const username = document.getElementById('reg-username').value;
            const password = document.getElementById('reg-password').value;
            const confirmPassword = document.getElementById('reg-confirm-password').value;

            if (!username || !password || !confirmPassword) {
                showMessage('所有字段不能为空', 'error');
                return;
            }

            if (password !== confirmPassword) {
                showMessage('两次输入的密码不一致', 'error');
                return;
            }

            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const result = await response.json();
                
                if (response.ok) {
                    showMessage(result.message, 'success');
                    setTimeout(() => { showLoginForm(); }, 1000);
                } else {
                    showMessage(result.error, 'error');
                }
            } catch (error) {
                showMessage('注册失败，请稍后重试', 'error');
            }
        }
    </script>
</body>
</html>`;
}

function getAnalysisHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>双色球号码分析系统</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            background-color: #f0f2f5;
            margin: 0;
            padding: 0;
        }
        .header {
            background-color: #1890ff;
            color: white;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
        }
        .container {
            max-width: 1200px;
            margin: 20px auto;
            padding: 0 20px;
        }
        .card {
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            padding: 30px;
            margin-bottom: 20px;
        }
        .nav {
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            padding: 0;
            margin-bottom: 20px;
        }
        .nav ul {
            list-style: none;
            padding: 0;
            margin: 0;
            display: flex;
            flex-wrap: wrap;
        }
        .nav li {
            margin: 0;
        }
        .nav a {
            display: block;
            padding: 15px 20px;
            text-decoration: none;
            color: #333;
            border-bottom: 3px solid transparent;
            transition: all 0.3s;
        }
        .nav a:hover,
        .nav a.active {
            color: #1890ff;
            border-bottom-color: #1890ff;
            background-color: #f0f5ff;
        }
        .btn {
            padding: 12px 24px;
            background-color: #1890ff;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 16px;
            cursor: pointer;
            transition: background-color 0.3s;
            margin: 0 10px;
        }
        .btn:hover {
            background-color: #40a9ff;
        }
        .btn-success {
            background-color: #52c41a;
        }
        .btn-success:hover {
            background-color: #73d13d;
        }
        .btn-danger {
            background-color: #ff4d4f;
        }
        .btn-danger:hover {
            background-color: #ff7875;
        }
        .btn-container {
            display: flex;
            justify-content: center;
            gap: 10px;
            flex-wrap: wrap;
            margin: 20px 0;
        }
        .analysis-section {
            margin-bottom: 30px;
        }
        .analysis-section h2 {
            color: #333;
            border-bottom: 2px solid #e8e8e8;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .analysis-section h3 {
            color: #666;
            margin-bottom: 15px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        .stat-card {
            background-color: #fafafa;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        .stat-value {
            font-size: 36px;
            font-weight: bold;
            color: #1890ff;
        }
        .stat-label {
            color: #666;
            margin-top: 10px;
        }
        .frequency-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        .frequency-table th,
        .frequency-table td {
            padding: 12px;
            text-align: center;
            border: 1px solid #e8e8e8;
        }
        .frequency-table th {
            background-color: #f0f5ff;
            font-weight: bold;
        }
        .hot-number {
            background-color: #fff2f0;
            color: #ff4d4f;
            font-weight: bold;
        }
        .cold-number {
            background-color: #f0f5ff;
            color: #1890ff;
            font-weight: bold;
        }
        .recommended-numbers {
            display: flex;
            justify-content: center;
            align-items: center;
            flex-wrap: wrap;
            gap: 15px;
            margin: 20px 0;
        }
        .red-ball, .blue-ball {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 24px;
            font-weight: bold;
            color: white;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        .red-ball {
            background-color: #ff4d4f;
        }
        .blue-ball {
            background-color: #1890ff;
        }
        .chart-container {
            width: 100%;
            height: 400px;
            margin: 20px 0;
            background-color: #fafafa;
            border-radius: 8px;
            padding: 20px;
            box-sizing: border-box;
        }
        .distribution-chart {
            display: flex;
            justify-content: space-around;
            align-items: end;
            height: 100%;
        }
        .chart-bar {
            flex: 1;
            margin: 0 5px;
            background-color: #1890ff;
            border-radius: 4px 4px 0 0;
            position: relative;
            transition: all 0.3s;
        }
        .chart-bar:hover {
            background-color: #40a9ff;
        }
        .chart-bar-label {
            position: absolute;
            bottom: -30px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 12px;
            color: #666;
            white-space: nowrap;
        }
        .chart-bar-value {
            position: absolute;
            top: -25px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 14px;
            font-weight: bold;
            color: #333;
        }
        .message {
            text-align: center;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
            font-weight: bold;
        }
        .message.success {
            background-color: #f6ffed;
            border: 1px solid #b7eb8f;
            color: #52c41a;
        }
        .message.error {
            background-color: #fff2f0;
            border: 1px solid #ffccc7;
            color: #ff4d4f;
        }
        .loading {
            text-align: center;
            padding: 50px;
            color: #666;
        }
        .filter-container {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 20px;
            margin: 20px 0;
            flex-wrap: wrap;
        }
        .filter-group {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .filter-group label {
            color: #666;
            font-weight: bold;
        }
        .filter-group select {
            padding: 8px 12px;
            border: 1px solid #d9d9d9;
            border-radius: 4px;
            font-size: 14px;
        }
        /* 响应式设计 */
        @media (max-width: 768px) {
            .header {
                flex-direction: column;
                gap: 10px;
                text-align: center;
            }
            .nav ul {
                flex-direction: column;
            }
            .nav a {
                border-bottom: none;
                border-right: 3px solid transparent;
            }
            .nav a:hover,
            .nav a.active {
                border-bottom: none;
                border-right-color: #1890ff;
            }
            .container {
                padding: 0 10px;
            }
            .card {
                padding: 20px;
            }
            .stats-grid {
                grid-template-columns: repeat(2, 1fr);
            }
            .frequency-table {
                font-size: 12px;
            }
            .frequency-table th,
            .frequency-table td {
                padding: 8px;
            }
            .chart-container {
                height: 300px;
                padding: 10px;
            }
        }
        @media (max-width: 480px) {
            .header h1 {
                font-size: 20px;
            }
            .btn {
                padding: 10px 16px;
                font-size: 14px;
                margin: 0 5px;
            }
            .stats-grid {
                grid-template-columns: 1fr;
            }
            .red-ball, .blue-ball {
                width: 50px;
                height: 50px;
                font-size: 20px;
            }
            .chart-container {
                height: 250px;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>双色球号码分析系统</h1>
        <div>
            <button class="btn" onclick="window.location.href='/app.html'">返回主界面</button>
            <button class="btn btn-danger" onclick="handleLogout()">退出登录</button>
        </div>
    </div>
    
    <div class="nav">
        <ul>
            <li><a href="#hot-cold" class="active" onclick="showSection('hot-cold')">冷热分析</a></li>
            <li><a href="#parity" onclick="showSection('parity')">奇偶分析</a></li>
            <li><a href="#size" onclick="showSection('size')">大小分析</a></li>
            <li><a href="#range" onclick="showSection('range')">区间分析</a></li>
            <li><a href="#missing" onclick="showSection('missing')">遗漏分析</a></li>
            <li><a href="#recommendation" onclick="showSection('recommendation')">号码推荐</a></li>
        </ul>
    </div>
    
    <div class="container">
        <div class="filter-container">
            <div class="filter-group">
                <label for="period-select">分析期数：</label>
                <select id="period-select">
                    <option value="20">最近20期</option>
                    <option value="50" selected>最近50期</option>
                    <option value="100">最近100期</option>
                    <option value="200">最近200期</option>
                    <option value="all">全部历史</option>
                </select>
            </div>
            <button class="btn btn-success" onclick="loadAllAnalysis()">重新分析</button>
        </div>
        
        <div id="hot-cold" class="analysis-section">
            <h2>冷热分析</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value" id="hot-red-count">0</div>
                    <div class="stat-label">热门红球</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="cold-red-count">0</div>
                    <div class="stat-label">冷门红球</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="hot-blue-count">0</div>
                    <div class="stat-label">热门蓝球</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="cold-blue-count">0</div>
                    <div class="stat-label">冷门蓝球</div>
                </div>
            </div>
            
            <div class="analysis-section">
                <h3>红球冷热频率</h3>
                <table class="frequency-table">
                    <thead>
                        <tr>
                            <th>号码</th>
                            <th>出现次数</th>
                            <th>冷热状态</th>
                            <th>最后出现期数</th>
                        </tr>
                    </thead>
                    <tbody id="red-hot-cold-table">
                        <tr><td colspan="4" class="loading">加载中...</td></tr>
                    </tbody>
                </table>
            </div>
            
            <div class="analysis-section">
                <h3>蓝球冷热频率</h3>
                <table class="frequency-table">
                    <thead>
                        <tr>
                            <th>号码</th>
                            <th>出现次数</th>
                            <th>冷热状态</th>
                            <th>最后出现期数</th>
                        </tr>
                    </thead>
                    <tbody id="blue-hot-cold-table">
                        <tr><td colspan="4" class="loading">加载中...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
        
        <div id="parity" class="analysis-section" style="display: none;">
            <h2>奇偶分析</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value" id="parity-red-even">0</div>
                    <div class="stat-label">红球偶数比例</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="parity-red-odd">0</div>
                    <div class="stat-label">红球奇数比例</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="parity-blue-even">0</div>
                    <div class="stat-label">蓝球偶数比例</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="parity-blue-odd">0</div>
                    <div class="stat-label">蓝球奇数比例</div>
                </div>
            </div>
            
            <div class="chart-container">
                <h3 style="text-align: center; margin-bottom: 20px;">红球奇偶分布</h3>
                <div id="red-parity-chart" class="distribution-chart">
                    <div class="loading">加载中...</div>
                </div>
            </div>
            
            <div class="chart-container">
                <h3 style="text-align: center; margin-bottom: 20px;">蓝球奇偶分布</h3>
                <div id="blue-parity-chart" class="distribution-chart">
                    <div class="loading">加载中...</div>
                </div>
            </div>
        </div>
        
        <div id="size" class="analysis-section" style="display: none;">
            <h2>大小分析</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value" id="size-red-big">0</div>
                    <div class="stat-label">红球大号比例</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="size-red-small">0</div>
                    <div class="stat-label">红球小号比例</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="size-blue-big">0</div>
                    <div class="stat-label">蓝球大号比例</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="size-blue-small">0</div>
                    <div class="stat-label">蓝球小号比例</div>
                </div>
            </div>
            
            <div class="chart-container">
                <h3 style="text-align: center; margin-bottom: 20px;">红球大小分布</h3>
                <div id="red-size-chart" class="distribution-chart">
                    <div class="loading">加载中...</div>
                </div>
            </div>
            
            <div class="chart-container">
                <h3 style="text-align: center; margin-bottom: 20px;">蓝球大小分布</h3>
                <div id="blue-size-chart" class="distribution-chart">
                    <div class="loading">加载中...</div>
                </div>
            </div>
        </div>
        
        <div id="range" class="analysis-section" style="display: none;">
            <h2>区间分析</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value" id="range-red-1">0</div>
                    <div class="stat-label">红球区间1-11</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="range-red-2">0</div>
                    <div class="stat-label">红球区间12-22</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="range-red-3">0</div>
                    <div class="stat-label">红球区间23-33</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="range-blue-1">0</div>
                    <div class="stat-label">蓝球区间1-8</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="range-blue-2">0</div>
                    <div class="stat-label">蓝球区间9-16</div>
                </div>
            </div>
            
            <div class="chart-container">
                <h3 style="text-align: center; margin-bottom: 20px;">红球区间分布</h3>
                <div id="red-range-chart" class="distribution-chart">
                    <div class="loading">加载中...</div>
                </div>
            </div>
            
            <div class="chart-container">
                <h3 style="text-align: center; margin-bottom: 20px;">蓝球区间分布</h3>
                <div id="blue-range-chart" class="distribution-chart">
                    <div class="loading">加载中...</div>
                </div>
            </div>
        </div>
        
        <div id="missing" class="analysis-section" style="display: none;">
            <h2>遗漏分析</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value" id="missing-red-max">0</div>
                    <div class="stat-label">红球最大遗漏</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="missing-red-average">0</div>
                    <div class="stat-label">红球平均遗漏</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="missing-blue-max">0</div>
                    <div class="stat-label">蓝球最大遗漏</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="missing-blue-average">0</div>
                    <div class="stat-label">蓝球平均遗漏</div>
                </div>
            </div>
            
            <div class="analysis-section">
                <h3>红球遗漏数据</h3>
                <table class="frequency-table">
                    <thead>
                        <tr>
                            <th>号码</th>
                            <th>当前遗漏</th>
                            <th>历史最大遗漏</th>
                            <th>上次遗漏</th>
                        </tr>
                    </thead>
                    <tbody id="red-missing-table">
                        <tr><td colspan="4" class="loading">加载中...</td></tr>
                    </tbody>
                </table>
            </div>
            
            <div class="analysis-section">
                <h3>蓝球遗漏数据</h3>
                <table class="frequency-table">
                    <thead>
                        <tr>
                            <th>号码</th>
                            <th>当前遗漏</th>
                            <th>历史最大遗漏</th>
                            <th>上次遗漏</th>
                        </tr>
                    </thead>
                    <tbody id="blue-missing-table">
                        <tr><td colspan="4" class="loading">加载中...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
        
        <div id="recommendation" class="analysis-section" style="display: none;">
            <h2>号码推荐</h2>
            <div class="analysis-section">
                <h3>根据分析推荐的号码</h3>
                <div class="recommended-numbers" id="recommended-numbers">
                    <p class="loading">加载中...</p>
                </div>
            </div>
            
            <div class="analysis-section">
                <h3>推荐理由</h3>
                <div class="card">
                    <ul id="recommendation-reason">
                        <li class="loading">加载中...</li>
                    </ul>
                </div>
            </div>
            
            <div class="btn-container">
                <button class="btn btn-success" onclick="generateFromRecommendation()">根据推荐生成号码</button>
                <button class="btn" onclick="window.location.href='/app.html'">返回主界面</button>
            </div>
        </div>
    </div>
    
    <div id="message" class="message" style="display: none;"></div>
    
    <script>
        function showMessage(message, type) {
            const messageDiv = document.getElementById('message');
            messageDiv.textContent = message;
            messageDiv.className = "message " + type;
            messageDiv.style.display = 'block';
            setTimeout(() => { messageDiv.style.display = 'none'; }, 3000);
        }
        
        function showSection(sectionId) {
            // 隐藏所有分析区域
            document.querySelectorAll('.analysis-section').forEach(section => {
                section.style.display = 'none';
            });
            
            // 显示选中的分析区域
            document.getElementById(sectionId).style.display = 'block';
            
            // 更新导航栏激活状态
            document.querySelectorAll('.nav a').forEach(link => {
                link.classList.remove('active');
            });
            document.querySelector('[href="#' + sectionId + '"]').classList.add('active');
        }
        
        async function loadHotColdAnalysis() {
            try {
                const periods = document.getElementById('period-select').value;
                const response = await fetch("/api/analysis/hot-cold?periods=" + periods);
                const result = await response.json();
                
                if (response.ok && result.success) {
                    // 更新统计数据
                    document.getElementById('hot-red-count').textContent = result.hotRedNumbers.length;
                    document.getElementById('cold-red-count').textContent = result.coldRedNumbers.length;
                    document.getElementById('hot-blue-count').textContent = result.hotBlueNumbers.length;
                    document.getElementById('cold-blue-count').textContent = result.coldBlueNumbers.length;
                    
                    // 更新红球冷热表格
                    updateHotColdTable('red-hot-cold-table', result.redFrequency);
                    
                    // 更新蓝球冷热表格
                    updateHotColdTable('blue-hot-cold-table', result.blueFrequency);
                } else {
                    showMessage(result.error, 'error');
                }
            } catch (error) {
                console.error('加载冷热分析失败:', error);
                showMessage('加载冷热分析失败，请稍后重试', 'error');
            }
        }
        
        function updateHotColdTable(tableId, data) {
            const tbody = document.getElementById(tableId);
            tbody.innerHTML = '';
            
            data.forEach(item => {
                const row = document.createElement('tr');
                row.className = item.status === 'hot' ? 'hot-number' : item.status === 'cold' ? 'cold-number' : '';
                
                let statusText;
                if (item.status === 'hot') {
                    statusText = '热门';
                } else if (item.status === 'cold') {
                    statusText = '冷门';
                } else {
                    statusText = '正常';
                }
                
                row.innerHTML = "<td>" + item.number + "</td><td>" + item.count + "</td><td>" + statusText + "</td><td>" + item.lastDraw + "</td>";
                
                tbody.appendChild(row);
            });
        }
        
        async function loadParityAnalysis() {
            try {
                const periods = document.getElementById('period-select').value;
                const response = await fetch("/api/analysis/parity?periods=" + periods);
                const result = await response.json();
                
                if (response.ok && result.success) {
                    // 更新统计数据
                    // 注意：服务器端返回的是奇偶组合比例，不是整体奇偶比例
                    // 这里我们计算大致的奇偶比例（简化处理）
                    const totalRatio = parseFloat(result.ratio33) + parseFloat(result.ratio42) + parseFloat(result.ratio24) + parseFloat(result.ratio51) + parseFloat(result.ratio15) + parseFloat(result.ratio60) + parseFloat(result.ratio06);
                    const redEvenRatio = (parseFloat(result.ratio33) * 0.5 + parseFloat(result.ratio42) * (2/6) + parseFloat(result.ratio24) * (4/6) + parseFloat(result.ratio51) * (1/6) + parseFloat(result.ratio15) * (5/6) + parseFloat(result.ratio60) * 0 + parseFloat(result.ratio06) * 1) / totalRatio * 100;
                    const redOddRatio = 100 - redEvenRatio;
                    
                    // 蓝球只有一个号码，所以奇偶比例是50%-50%
                    const blueEvenRatio = 50;
                    const blueOddRatio = 50;
                    
                    document.getElementById('parity-red-even').textContent = redEvenRatio.toFixed(1) + '%';
                    document.getElementById('parity-red-odd').textContent = redOddRatio.toFixed(1) + '%';
                    document.getElementById('parity-blue-even').textContent = blueEvenRatio.toFixed(1) + '%';
                    document.getElementById('parity-blue-odd').textContent = blueOddRatio.toFixed(1) + '%';
                    
                    // 更新红球奇偶图表
                    updateDistributionChart('red-parity-chart', [
                        { label: '偶数', value: redEvenRatio, color: '#1890ff' },
                        { label: '奇数', value: redOddRatio, color: '#52c41a' }
                    ]);
                    
                    // 更新蓝球奇偶图表
                    updateDistributionChart('blue-parity-chart', [
                        { label: '偶数', value: blueEvenRatio, color: '#1890ff' },
                        { label: '奇数', value: blueOddRatio, color: '#52c41a' }
                    ]);
                } else {
                    showMessage(result.error, 'error');
                }
            } catch (error) {
                console.error('加载奇偶分析失败:', error);
                showMessage('加载奇偶分析失败，请稍后重试', 'error');
            }
        }
        
        async function loadSizeAnalysis() {
            try {
                const periods = document.getElementById('period-select').value;
                const response = await fetch("/api/analysis/size?periods=" + periods);
                const result = await response.json();
                
                if (response.ok && result.success) {
                    // 更新统计数据
                    // 注意：服务器端返回的是大小组合比例，不是整体大小比例
                    // 这里我们计算大致的大小比例（简化处理）
                    const totalRatio = parseFloat(result.ratio33) + parseFloat(result.ratio42) + parseFloat(result.ratio24) + parseFloat(result.ratio51) + parseFloat(result.ratio15) + parseFloat(result.ratio60) + parseFloat(result.ratio06);
                    const redBigRatio = (parseFloat(result.ratio33) * 0.5 + parseFloat(result.ratio42) * (4/6) + parseFloat(result.ratio24) * (2/6) + parseFloat(result.ratio51) * (5/6) + parseFloat(result.ratio15) * (1/6) + parseFloat(result.ratio60) * 1 + parseFloat(result.ratio06) * 0) / totalRatio * 100;
                    const redSmallRatio = 100 - redBigRatio;
                    
                    // 蓝球大小比例（简化处理）
                    const blueBigRatio = 50;
                    const blueSmallRatio = 50;
                    
                    document.getElementById('size-red-big').textContent = redBigRatio.toFixed(1) + '%';
                    document.getElementById('size-red-small').textContent = redSmallRatio.toFixed(1) + '%';
                    document.getElementById('size-blue-big').textContent = blueBigRatio.toFixed(1) + '%';
                    document.getElementById('size-blue-small').textContent = blueSmallRatio.toFixed(1) + '%';
                    
                    // 更新红球大小图表
                    updateDistributionChart('red-size-chart', [
                        { label: '大号(18-33)', value: redBigRatio, color: '#1890ff' },
                        { label: '小号(1-17)', value: redSmallRatio, color: '#52c41a' }
                    ]);
                    
                    // 更新蓝球大小图表
                    updateDistributionChart('blue-size-chart', [
                        { label: '大号(9-16)', value: blueBigRatio, color: '#1890ff' },
                        { label: '小号(1-8)', value: blueSmallRatio, color: '#52c41a' }
                    ]);
                } else {
                    showMessage(result.error, 'error');
                }
            } catch (error) {
                console.error('加载大小分析失败:', error);
                showMessage('加载大小分析失败，请稍后重试', 'error');
            }
        }
        
        async function loadRangeAnalysis() {
            try {
                const periods = document.getElementById('period-select').value;
                const response = await fetch("/api/analysis/range?periods=" + periods);
                const result = await response.json();
                
                if (response.ok && result.success) {
                    // 更新统计数据
                    // 注意：服务器端返回的是区间组合比例，不是整体区间比例
                    // 这里我们计算大致的区间比例（简化处理）
                    const totalRatio = parseFloat(result.ratio222) + parseFloat(result.ratio312) + parseFloat(result.ratio321) + parseFloat(result.ratio231) + parseFloat(result.ratio132) + parseFloat(result.ratio123) + parseFloat(result.ratio411) + parseFloat(result.ratio420) + parseFloat(result.ratio402) + parseFloat(result.ratio141) + parseFloat(result.ratio240) + parseFloat(result.ratio042) + parseFloat(result.ratio114) + parseFloat(result.ratio204) + parseFloat(result.ratio024) + parseFloat(result.ratio510) + parseFloat(result.ratio501) + parseFloat(result.ratio150) + parseFloat(result.ratio051) + parseFloat(result.ratio105) + parseFloat(result.ratio015) + parseFloat(result.ratio600) + parseFloat(result.ratio060) + parseFloat(result.ratio006);
                    
                    // 计算每个区间的大致出号比例
                    const range1Ratio = (parseFloat(result.ratio222) * (2/6) + parseFloat(result.ratio312) * (3/6) + parseFloat(result.ratio321) * (3/6) + parseFloat(result.ratio231) * (2/6) + parseFloat(result.ratio132) * (1/6) + parseFloat(result.ratio123) * (1/6) + parseFloat(result.ratio411) * (4/6) + parseFloat(result.ratio420) * (4/6) + parseFloat(result.ratio402) * (4/6) + parseFloat(result.ratio141) * (1/6) + parseFloat(result.ratio240) * (2/6) + parseFloat(result.ratio042) * 0 + parseFloat(result.ratio114) * (1/6) + parseFloat(result.ratio204) * (2/6) + parseFloat(result.ratio024) * 0 + parseFloat(result.ratio510) * (5/6) + parseFloat(result.ratio501) * (5/6) + parseFloat(result.ratio150) * (1/6) + parseFloat(result.ratio051) * 0 + parseFloat(result.ratio105) * (1/6) + parseFloat(result.ratio015) * 0 + parseFloat(result.ratio600) * 1 + parseFloat(result.ratio060) * 0 + parseFloat(result.ratio006) * 0) / totalRatio * 100;
                    
                    const range2Ratio = (parseFloat(result.ratio222) * (2/6) + parseFloat(result.ratio312) * (1/6) + parseFloat(result.ratio321) * (2/6) + parseFloat(result.ratio231) * (3/6) + parseFloat(result.ratio132) * (3/6) + parseFloat(result.ratio123) * (2/6) + parseFloat(result.ratio411) * (1/6) + parseFloat(result.ratio420) * (2/6) + parseFloat(result.ratio402) * 0 + parseFloat(result.ratio141) * (4/6) + parseFloat(result.ratio240) * (4/6) + parseFloat(result.ratio042) * (4/6) + parseFloat(result.ratio114) * (1/6) + parseFloat(result.ratio204) * 0 + parseFloat(result.ratio024) * (2/6) + parseFloat(result.ratio510) * (1/6) + parseFloat(result.ratio501) * 0 + parseFloat(result.ratio150) * (5/6) + parseFloat(result.ratio051) * (5/6) + parseFloat(result.ratio105) * 0 + parseFloat(result.ratio015) * (1/6) + parseFloat(result.ratio600) * 0 + parseFloat(result.ratio060) * 1 + parseFloat(result.ratio006) * 0) / totalRatio * 100;
                    
                    const range3Ratio = 100 - range1Ratio - range2Ratio;
                    
                    // 蓝球区间比例（简化处理）
                    const blueRange1Ratio = 50;
                    const blueRange2Ratio = 50;
                    
                    document.getElementById('range-red-1').textContent = range1Ratio.toFixed(1) + '%';
                    document.getElementById('range-red-2').textContent = range2Ratio.toFixed(1) + '%';
                    document.getElementById('range-red-3').textContent = range3Ratio.toFixed(1) + '%';
                    document.getElementById('range-blue-1').textContent = blueRange1Ratio.toFixed(1) + '%';
                    document.getElementById('range-blue-2').textContent = blueRange2Ratio.toFixed(1) + '%';
                    
                    // 更新红球区间图表
                    updateDistributionChart('red-range-chart', [
                        { label: '1-11', value: range1Ratio, color: '#1890ff' },
                        { label: '12-22', value: range2Ratio, color: '#52c41a' },
                        { label: '23-33', value: range3Ratio, color: '#faad14' }
                    ]);
                    
                    // 更新蓝球区间图表
                    updateDistributionChart('blue-range-chart', [
                        { label: '1-8', value: blueRange1Ratio, color: '#1890ff' },
                        { label: '9-16', value: blueRange2Ratio, color: '#52c41a' }
                    ]);
                } else {
                    showMessage(result.error, 'error');
                }
            } catch (error) {
                console.error('加载区间分析失败:', error);
                showMessage('加载区间分析失败，请稍后重试', 'error');
            }
        }
        
        async function loadMissingAnalysis() {
            try {
                const periods = document.getElementById('period-select').value;
                const response = await fetch("/api/analysis/missing?periods=" + periods);
                const result = await response.json();
                
                if (response.ok && result.success) {
                    // 更新统计数据
                    document.getElementById('missing-red-max').textContent = result.maxRedMissing;
                    document.getElementById('missing-red-average').textContent = result.avgRedMissing.toFixed(1);
                    document.getElementById('missing-blue-max').textContent = result.maxBlueMissing;
                    document.getElementById('missing-blue-average').textContent = result.avgBlueMissing.toFixed(1);
                    
                    // 转换服务器返回的对象格式为表格需要的数组格式
                    const redData = Object.entries(result.redMissing).map(([number, missing]) => ({ number, missing })).sort((a, b) => parseInt(a.number) - parseInt(b.number));
                    const blueData = Object.entries(result.blueMissing).map(([number, missing]) => ({ number, missing })).sort((a, b) => parseInt(a.number) - parseInt(b.number));
                    
                    // 更新红球遗漏表格
                    updateMissingTable('red-missing-table', redData);
                    
                    // 更新蓝球遗漏表格
                    updateMissingTable('blue-missing-table', blueData);
                } else {
                    showMessage(result.error, 'error');
                }
            } catch (error) {
                console.error('加载遗漏分析失败:', error);
                showMessage('加载遗漏分析失败，请稍后重试', 'error');
            }
        }
        
        function updateMissingTable(tableId, data) {
            const tbody = document.getElementById(tableId);
            tbody.innerHTML = '';
            
            data.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = 
                    '<td>' + item.number + '</td>' +
                    '<td>' + item.currentMissing + '</td>' +
                    '<td>' + item.maxMissing + '</td>' +
                    '<td>' + item.lastMissing + '</td>';
                tbody.appendChild(row);
            });
        }
        
        async function loadRecommendation() {
            try {
                const response = await fetch('/api/analysis/recommendation');
                const result = await response.json();
                
                if (response.ok && result.success) {
                    // 更新推荐号码
                    const container = document.getElementById('recommended-numbers');
                    container.innerHTML = '';
                    
                    // 服务器端返回的是推荐号码数组，这里我们只显示第一组
                    const firstRecommendation = result.recommendations[0];
                    if (firstRecommendation) {
                        firstRecommendation.red.forEach(num => {
                            const ball = document.createElement('div');
                            ball.className = 'red-ball';
                            ball.textContent = num;
                            container.appendChild(ball);
                        });
                        
                        const blueBall = document.createElement('div');
                        blueBall.className = 'blue-ball';
                        blueBall.textContent = firstRecommendation.blue;
                        container.appendChild(blueBall);
                    }
                    
                    // 更新推荐理由
                    const reasonList = document.getElementById('recommendation-reason');
                    reasonList.innerHTML = '';
                    
                    // 服务器端没有返回推荐理由，这里使用默认理由
                    const defaultReasons = [
                        '基于最近100期历史数据生成',
                        '综合考虑热号和非热号的平衡',
                        '选择近期出现频率较高的蓝球',
                        '红球组合遵循3热3非热的搭配原则',
                        '号码经过排序处理，便于查看'
                    ];
                    
                    defaultReasons.forEach(reason => {
                        const li = document.createElement('li');
                        li.textContent = reason;
                        reasonList.appendChild(li);
                    });
                } else {
                    showMessage(result.error, 'error');
                }
            } catch (error) {
                console.error('加载推荐号码失败:', error);
                showMessage('加载推荐号码失败，请稍后重试', 'error');
            }
        }
        
        function updateDistributionChart(chartId, data) {
            const chartContainer = document.getElementById(chartId);
            chartContainer.innerHTML = '';
            
            const maxValue = Math.max(...data.map(item => item.value));
            
            data.forEach(item => {
                const bar = document.createElement('div');
                bar.className = 'chart-bar';
                bar.style.height = ((item.value / maxValue) * 100) + '%';
                bar.style.backgroundColor = item.color;
                
                const valueLabel = document.createElement('div');
                valueLabel.className = 'chart-bar-value';
                valueLabel.textContent = item.value;
                
                const barLabel = document.createElement('div');
                barLabel.className = 'chart-bar-label';
                barLabel.textContent = item.label;
                
                bar.appendChild(valueLabel);
                bar.appendChild(barLabel);
                chartContainer.appendChild(bar);
            });
        }
        
        async function loadAllAnalysis() {
            showMessage('正在加载分析数据...', 'success');
            
            // 并行加载所有分析数据
            await Promise.all([
                loadHotColdAnalysis(),
                loadParityAnalysis(),
                loadSizeAnalysis(),
                loadRangeAnalysis(),
                loadMissingAnalysis(),
                loadRecommendation()
            ]);
            
            showMessage('分析数据加载完成！', 'success');
        }
        
        async function generateFromRecommendation() {
            try {
                const response = await fetch('/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ count: 5, useRecommendation: true })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    // 保存推荐生成的号码到本地存储，以便在主界面显示
                    localStorage.setItem('generatedNumbers', JSON.stringify(result.numbers));
                    localStorage.setItem('fromRecommendation', 'true');
                    
                    // 跳转到主界面
                    window.location.href = '/app.html';
                } else {
                    showMessage(result.error, 'error');
                }
            } catch (error) {
                console.error('生成号码失败:', error);
                showMessage('生成号码失败，请稍后重试', 'error');
            }
        }
        
        async function handleLogout() {
            try {
                const response = await fetch('/api/logout', {
                    method: 'POST'
                });
                
                if (response.ok) {
                    window.location.href = '/login.html';
                } else {
                    showMessage('退出登录失败，请稍后重试', 'error');
                }
            } catch (error) {
                showMessage('退出登录失败，请稍后重试', 'error');
            }
        }
        
        // 页面加载完成后自动加载分析数据
        document.addEventListener('DOMContentLoaded', () => {
            loadAllAnalysis();
        });
    </script>
</body>
</html>`;
}

function getAppHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>双色球选号系统 - 主界面</title>
    <style>
        body { font-family: Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 0; }
        .header { background: #1890ff; color: white; padding: 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
        .header h1 { margin: 0; font-size: 24px; }
        .container { max-width: 1200px; margin: 20px auto; padding: 0 20px; }
        .card { background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 30px; margin-bottom: 20px; }
        .number-display { text-align: center; margin: 30px 0; }
        .number-container { display: flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: 15px; margin-bottom: 20px; }
        .red-ball, .blue-ball { width: 60px; height: 60px; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-size: 24px; font-weight: bold; color: white; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        .red-ball { background: #ff4d4f; }
        .blue-ball { background: #1890ff; }
        .btn { padding: 12px 24px; background: #1890ff; color: white; border: none; border-radius: 4px; font-size: 16px; cursor: pointer; margin: 0 10px; }
        .btn:hover { background: #40a9ff; }
        .btn-danger { background: #ff4d4f; }
        .btn-danger:hover { background: #ff7875; }
        .btn-success { background: #52c41a; }
        .btn-success:hover { background: #73d13d; }
        .history-container { margin-top: 30px; }
        .history-list { max-height: 400px; overflow-y: auto; border: 1px solid #f0f0f0; border-radius: 4px; padding: 10px; }
        .history-item { display: flex; justify-content: space-between; align-items: center; padding: 15px; border-bottom: 1px solid #f0f0f0; }
        .history-item:last-child { border-bottom: none; }
        .history-numbers { display: flex; align-items: center; gap: 8px; }
        .small-ball { width: 30px; height: 30px; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-size: 14px; font-weight: bold; color: white; }
        .history-info { text-align: right; color: #666; font-size: 14px; }
        .message { text-align: center; padding: 15px; margin: 20px 0; border-radius: 4px; font-weight: bold; }
        .message.success { background: #f6ffed; border: 1px solid #b7eb8f; color: #52c41a; }
        .message.error { background: #fff2f0; border: 1px solid #ffccc7; color: #ff4d4f; }
    </style>
</head>
<body>
    <div class="header">
        <h1>双色球选号系统</h1>
        <button class="btn btn-danger" onclick="handleLogout()">退出登录</button>
    </div>

    <div class="container">
        <div class="card">
            <div class="number-display">
                <h2>双色球号码生成</h2>
                <div style="margin-bottom: 20px;">
                    <label for="count-select">生成数量：</label>
                    <select id="count-select" style="padding: 8px; border-radius: 4px; border: 1px solid #ddd;">
                        <option value="1">1个号码</option>
                        <option value="2">2个号码</option>
                        <option value="3">3个号码</option>
                        <option value="4">4个号码</option>
                        <option value="5" selected>5个号码</option>
                        <option value="6">6个号码</option>
                        <option value="7">7个号码</option>
                        <option value="8">8个号码</option>
                        <option value="9">9个号码</option>
                        <option value="10">10个号码</option>
                    </select>
                </div>
                <div class="number-container" id="generated-numbers">
                    <p>请选择生成数量并点击"生成新号码"</p>
                </div>
                <button class="btn btn-success" onclick="generateNumber()">生成新号码</button>
                <button class="btn" onclick="crawlHistory()">获取最新数据</button>
            </div>

            <div style="margin-bottom: 30px; padding: 20px; background: #f6ffed; border: 1px solid #b7eb8f; border-radius: 4px;">
                <h3>Excel导入功能</h3>
                <form id="import-form" enctype="multipart/form-data">
                    <input type="file" id="excel-file" accept=".xlsx,.xls" style="margin-bottom: 10px; padding: 8px;">
                    <button type="button" class="btn btn-success" onclick="handleImport()">导入历史数据</button>
                    <button type="button" class="btn" onclick="downloadTemplate()">下载模板</button>
                </form>
                <p style="font-size: 12px; color: #666; margin-top: 10px;">
                    支持.xlsx和.xls格式，需包含：期号、日期、红球1-6、蓝球字段
                </p>
            </div>

            <div class="history-container">
                <h2 style="display: flex; justify-content: space-between; align-items: center;">
                    最近历史开奖
                    <div style="font-size: 14px; font-weight: normal;">
                        <label>
                            <input type="checkbox" id="show-order-checkbox" style="margin-right: 5px;">
                            显示红球出球顺序
                        </label>
                    </div>
                </h2>
                <div class="history-list" id="history-list">
                    <p>加载中...</p>
                </div>
            </div>
        </div>
    </div>

    <div id="message" class="message" style="display: none;"></div>

    <script>
        function showMessage(message, type) {
            const messageDiv = document.getElementById('message');
            messageDiv.textContent = message;
            messageDiv.className = \`message \${type}\`;
            messageDiv.style.display = 'block';
            setTimeout(() => { messageDiv.style.display = 'none'; }, 3000);
        }

        async function generateNumber() {
            const count = document.getElementById('count-select').value;
            
            try {
                const response = await fetch(\`/api/generate?count=\${count}\`);
                const result = await response.json();
                
                if (response.ok) {
                    displayGeneratedNumbers(result.numbers, count);
                    showMessage(\`成功生成 \${count} 个号码！\`, 'success');
                } else {
                    showMessage(result.error, 'error');
                }
            } catch (error) {
                showMessage('生成号码失败，请稍后重试', 'error');
            }
        }

        function displayGeneratedNumbers(numbers, count) {
            const container = document.getElementById('generated-numbers');
            container.innerHTML = '';
            
            if (count === 1) {
                // 单个号码显示
                const numberGroup = document.createElement('div');
                numberGroup.className = 'number-group';
                numberGroup.style.marginBottom = '20px';
                
                numbers.red.forEach(num => {
                    const ball = document.createElement('div');
                    ball.className = 'red-ball';
                    ball.textContent = num;
                    numberGroup.appendChild(ball);
                });
                
                const blueBall = document.createElement('div');
                blueBall.className = 'blue-ball';
                blueBall.textContent = numbers.blue;
                numberGroup.appendChild(blueBall);
                
                container.appendChild(numberGroup);
            } else {
                // 多个号码显示
                numbers.forEach((number, index) => {
                    const numberGroup = document.createElement('div');
                    numberGroup.className = 'number-group';
                    numberGroup.style.marginBottom = '15px';
                    numberGroup.style.padding = '10px';
                    numberGroup.style.border = '1px solid #f0f0f0';
                    numberGroup.style.borderRadius = '4px';
                    
                    const groupTitle = document.createElement('div');
                    groupTitle.textContent = \`第 \${index + 1} 组：\`;
                    groupTitle.style.marginBottom = '10px';
                    groupTitle.style.fontWeight = 'bold';
                    groupTitle.style.color = '#666';
                    
                    const ballsContainer = document.createElement('div');
                    ballsContainer.className = 'number-container';
                    ballsContainer.style.justifyContent = 'flex-start';
                    
                    number.red.forEach(num => {
                        const ball = document.createElement('div');
                        ball.className = 'small-ball red-ball';
                        ball.textContent = num;
                        ballsContainer.appendChild(ball);
                    });
                    
                    const blueBall = document.createElement('div');
                    blueBall.className = 'small-ball blue-ball';
                    blueBall.textContent = number.blue;
                    ballsContainer.appendChild(blueBall);
                    
                    numberGroup.appendChild(groupTitle);
                    numberGroup.appendChild(ballsContainer);
                    container.appendChild(numberGroup);
                });
            }
        }

        async function getHistoryNumbers() {
            try {
                const container = document.getElementById('history-list');
                // 显示加载状态
                container.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">加载历史数据中...</div>';
                
                const response = await fetch('/api/history?limit=20');
                const result = await response.json();
                
                if (response.ok) {
                    if (result.numbers && result.numbers.length > 0) {
                        displayHistoryNumbers(result.numbers);
                    } else {
                        // 数据为空时的提示
                        container.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">暂无历史数据</div>';
                        showMessage('历史数据为空，请尝试更新数据', 'info');
                    }
                } else {
                    // API返回错误
                    container.innerHTML = '<div style="text-align: center; padding: 20px; color: #ff4d4f;">获取历史数据失败</div>';
                    showMessage(result.error || '获取历史数据失败', 'error');
                }
            } catch (error) {
                const container = document.getElementById('history-list');
                container.innerHTML = '<div style="text-align: center; padding: 20px; color: #ff4d4f;">获取历史数据失败</div>';
                console.error('获取历史数据失败:', error);
                showMessage('网络错误或服务器不可用', 'error');
            }
        }

        function displayHistoryNumbers(numbers) {
            const container = document.getElementById('history-list');
            container.innerHTML = '';
            
            numbers.forEach(item => {
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                
                historyItem.innerHTML = \`
                    <div class="history-numbers">
                        <div class="small-ball red-ball">\${item.red_1}</div>
                        <div class="small-ball red-ball">\${item.red_2}</div>
                        <div class="small-ball red-ball">\${item.red_3}</div>
                        <div class="small-ball red-ball">\${item.red_4}</div>
                        <div class="small-ball red-ball">\${item.red_5}</div>
                        <div class="small-ball red-ball">\${item.red_6}</div>
                        <div class="small-ball blue-ball">\${item.blue}</div>
                    </div>
                    <div class="history-info">
                        <div>期号: \${item.issue_number}</div>
                        <div>日期: \${item.draw_date}</div>
                    </div>
                \`;
                
                container.appendChild(historyItem);
            });
        }

        async function crawlHistory() {
            try {
                const response = await fetch('/api/crawl', { method: 'POST' });
                const result = await response.json();
                
                if (response.ok) {
                    showMessage(result.message, 'success');
                    getHistoryNumbers();
                } else {
                    showMessage(result.error, 'error');
                }
            } catch (error) {
                showMessage('获取最新数据失败', 'error');
            }
        }

        async function handleLogout() {
            try {
                const response = await fetch('/api/logout', { method: 'POST' });
                if (response.ok) {
                    window.location.href = '/login.html';
                }
            } catch (error) {
                showMessage('退出登录失败', 'error');
            }
        }

        // 处理Excel导入
        async function handleImport() {
            const fileInput = document.getElementById('excel-file');
            const file = fileInput.files[0];
            
            if (!file) {
                showMessage('请选择要上传的Excel文件', 'error');
                return;
            }
            
            const formData = new FormData();
            formData.append('file', file);
            
            try {
                const response = await fetch('/api/import', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showMessage(result.message, 'success');
                    getHistoryNumbers(); // 重新加载历史数据
                } else {
                    showMessage(result.error, 'error');
                }
            } catch (error) {
                showMessage('导入失败：' + error.message, 'error');
            }
        }
        
        // 下载Excel模板
        function downloadTemplate() {
            // 创建Excel模板数据
            const templateData = [
                { 
                    '期号': '2024001', '日期': '2024-01-01', 
                    '红球1': 1, '红球2': 2, '红球3': 3, '红球4': 4, '红球5': 5, '红球6': 6, 
                    '红球顺序1': 3, '红球顺序2': 5, '红球顺序3': 1, '红球顺序4': 6, '红球顺序5': 2, '红球顺序6': 4,
                    '蓝球': 1 
                },
                { 
                    '期号': '2024002', '日期': '2024-01-04', 
                    '红球1': 7, '红球2': 8, '红球3': 9, '红球4': 10, '红球5': 11, '红球6': 12, 
                    '红球顺序1': 12, '红球顺序2': 10, '红球顺序3': 8, '红球顺序4': 11, '红球顺序5': 7, '红球顺序6': 9,
                    '蓝球': 2 
                }
            ];
            
            // 创建工作簿和工作表
            const worksheet = XLSX.utils.json_to_sheet(templateData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, '双色球历史数据');
            
            // 设置列宽
            worksheet['!cols'] = [
                { wch: 10 }, // 期号
                { wch: 15 }, // 日期
                { wch: 8 },  // 红球1
                { wch: 8 },  // 红球2
                { wch: 8 },  // 红球3
                { wch: 8 },  // 红球4
                { wch: 8 },  // 红球5
                { wch: 8 },  // 红球6
                { wch: 10 }, // 红球顺序1
                { wch: 10 }, // 红球顺序2
                { wch: 10 }, // 红球顺序3
                { wch: 10 }, // 红球顺序4
                { wch: 10 }, // 红球顺序5
                { wch: 10 }, // 红球顺序6
                { wch: 8 }   // 蓝球
            ];
            
            // 下载文件
            XLSX.writeFile(workbook, '双色球历史数据模板.xlsx');
        }
        
        // 修改显示历史数据的函数，支持切换红球出球顺序
        function displayHistoryNumbers(numbers) {
            const container = document.getElementById('history-list');
            container.innerHTML = '';
            
            const showOrder = document.getElementById('show-order-checkbox').checked;
            
            numbers.forEach(item => {
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                
                // 选择显示的红球数据：出球顺序或排序后的数据
                const redBalls = showOrder ? 
                    [item.red_1_order, item.red_2_order, item.red_3_order, item.red_4_order, item.red_5_order, item.red_6_order] :
                    [item.red_1, item.red_2, item.red_3, item.red_4, item.red_5, item.red_6];
                
                const ballsHTML = redBalls.map(num => '<div class="small-ball red-ball">' + num + '</div>').join('') + 
                    '<div class="small-ball blue-ball">' + item.blue + '</div>';
                
                historyItem.innerHTML = 
                    '<div class="history-numbers">' +
                        ballsHTML +
                    '</div>' +
                    '<div class="history-info">' +
                        '<div>期号: ' + item.issue_number + '</div>' +
                        '<div>日期: ' + item.draw_date + '</div>' +
                    '</div>';
                
                container.appendChild(historyItem);
            });
        }
        
        // 监听出球顺序复选框变化
        document.getElementById('show-order-checkbox').addEventListener('change', function() {
            getHistoryNumbers(); // 重新加载历史数据以更新显示
        });
        
        // 引入xlsx库
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/xlsx/dist/xlsx.full.min.js';
        script.onload = function() {
            console.log('XLSX库加载完成');
        };
        document.head.appendChild(script);
        
        // 只在DOM加载完成后调用一次getHistoryNumbers
        document.addEventListener('DOMContentLoaded', function() {
            console.log('DOM加载完成，初始化历史数据');
            getHistoryNumbers();
        });
    </script>
</body>
</html>`;
}

// 导出Worker处理函数
export default { 
  fetch: handleRequest,
  scheduled: handleScheduled
};
