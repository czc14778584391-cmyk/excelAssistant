<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/19O5YMqaSTDEOCHpq9x6bJ5BsNYC2y11S

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   ```bash
   npm install
   ```

2. 配置智谱 AI API Key：
   - **重要**：在项目根目录创建 `.env.local` 文件（注意文件名以点开头）
   - 添加以下内容（**必须以 VITE_ 开头**）：
     ```env
     VITE_ZHIPU_API_KEY=your_zhipu_api_key_here
     ```
   - 获取 API Key：访问 [智谱 AI 开放平台](https://open.bigmodel.cn/) 注册并获取 API Key
   - **配置后必须重启开发服务器**才能生效
   
   > 📖 详细配置说明请查看 [SETUP.md](./SETUP.md)

3. Run the app:
   ```bash
   npm run dev
   ```

## 使用智谱 AI

本项目已集成智谱 AI（GLM-4）模型进行交易分类。主要特性：

- 使用智谱 GLM-4 模型进行智能分类
- 支持 JSON 格式输出
- 可配置置信度阈值
- 支持自定义提示词模板

### API 配置说明

- 环境变量：`VITE_ZHIPU_API_KEY` 或 `ZHIPU_API_KEY`
- 默认模型：`glm-4`（可在 `services/zhipuService.ts` 中修改为 `glm-4-flash` 等）
- API 端点：`https://open.bigmodel.cn/api/paas/v4/chat/completions`
