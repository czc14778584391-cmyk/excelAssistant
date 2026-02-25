# 环境配置说明

## 配置智谱 AI API Key

### 步骤 1: 创建环境变量文件

在项目根目录创建 `.env.local` 文件（如果不存在）：

```bash
# Windows (PowerShell)
New-Item -Path .env.local -ItemType File

# Linux/Mac
touch .env.local
```

### 步骤 2: 添加 API Key

在 `.env.local` 文件中添加以下内容：

```env
VITE_ZHIPU_API_KEY=your_actual_api_key_here
```

**重要提示：**
- 必须以 `VITE_` 开头，Vite 才会将环境变量暴露到客户端代码
- 将 `your_actual_api_key_here` 替换为您的实际 API Key

### 步骤 3: 获取 API Key

1. 访问 [智谱 AI 开放平台](https://open.bigmodel.cn/)
2. 注册/登录账号
3. 在控制台中创建 API Key
4. 复制 API Key 到 `.env.local` 文件

### 步骤 4: 重启开发服务器

配置环境变量后，需要重启开发服务器才能生效：

```bash
# 停止当前服务器 (Ctrl+C)
# 然后重新启动
npm run dev
```

## 验证配置

配置完成后，运行项目并尝试使用 AI 分类功能。如果仍然出现 "Missing Zhipu API Key" 错误，请检查：

1. ✅ `.env.local` 文件是否在项目根目录
2. ✅ 环境变量名是否为 `VITE_ZHIPU_API_KEY`（必须以 VITE_ 开头）
3. ✅ API Key 是否正确（没有多余的空格或引号）
4. ✅ 是否已重启开发服务器

## 示例文件结构

```
test-page/
├── .env.local          ← 在这里创建（不会被提交到 Git）
├── .gitignore
├── package.json
├── vite.config.ts
└── ...
```

## 故障排除

### 问题：仍然提示 Missing API Key

**解决方案：**
1. 确认文件名为 `.env.local`（注意前面的点）
2. 确认环境变量名以 `VITE_` 开头
3. 重启开发服务器
4. 清除浏览器缓存并刷新页面

### 问题：API Key 格式错误

**解决方案：**
- 确保 API Key 没有引号：`VITE_ZHIPU_API_KEY=abc123` ✅
- 不要写成：`VITE_ZHIPU_API_KEY="abc123"` ❌
