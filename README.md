<div align="center">

# 🖨️ EmojiCut AI - 可爱贴纸打印机

**使用 Gemini Nano Banana Pro 一键生成 LINE 风格贴纸表情包**

![Cute Sticker Printer](https://img.shields.io/badge/AI-Gemini%20Pro-pink?style=for-the-badge)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript)

</div>

---

## ✨ 功能特点

- 🎨 **AI 一键生成** - 上传角色图片，自动生成 16 张可爱贴纸
- 🎀 **自定义风格** - 支持输入任意画面风格（赛博朋克、水彩风、像素艺术等）
- ✂️ **智能切图** - 自动识别并切分贴纸，生成独立 PNG
- 📦 **批量下载** - 一键打包下载所有贴纸为 ZIP
- 🖨️ **可爱 UI** - 粉色系贴纸打印机界面，贴纸动画"吐出"效果

## 🚀 快速开始

### 环境要求

- Node.js 20.19+（GitHub Actions 和 Docker 均使用 Node 20）
- Gemini API Key

### 安装运行

```bash
# 克隆项目
git clone https://github.com/Rayinf/EmojiCut.git
cd EmojiCut

# 安装依赖
npm install

# 配置 API Key
# 在 .env.local 文件中设置 GEMINI_API_KEY=你的Gemini_API_Key
# 或者打开网页右上角设置，在浏览器本地填写 API Key / API URL / Model

# 启动开发服务器
npm run dev
```

访问 http://localhost:3000 开始使用！

### Docker Compose 多人部署

推荐多人使用时走服务端代理：API Key 只放在 Docker 环境变量里，不会打包进前端 JS。
`docker-compose.yml` 默认使用 GHCR 拉取镜像：

```yaml
image: ghcr.io/spacex-3/emojicut:latest
pull_policy: always
```

```bash
docker compose pull
docker compose up -d
```

编辑 `docker-compose.yml`：

```yaml
environment:
  AI_PROVIDER: openai
  API_BASE_URL: https://api.openai.com/v1
  API_KEY: your-api-key
  IMAGE_MODEL: gpt-image-1
  NAMING_MODEL: gpt-4o-mini
  APP_PASSWORD: your-web-password
```

然后访问：

```text
http://localhost:8080
```

如果你的服务是 Gemini API，也可以这样配置：

```yaml
environment:
  AI_PROVIDER: gemini
  API_BASE_URL: https://generativelanguage.googleapis.com
  API_KEY: your-gemini-api-key
  IMAGE_MODEL: gemini-3-pro-image-preview
  NAMING_MODEL: gemini-2.5-flash
  APP_PASSWORD: your-web-password
```

### OpenAI-compatible API 说明

`AI_PROVIDER=openai` 时，服务端默认调用：

- 生成表情包：`POST {API_BASE_URL}/images/edits`
- 命名贴纸：`POST {API_BASE_URL}/chat/completions`

如果你的中转服务路径不同，可以用：

```yaml
OPENAI_IMAGE_ENDPOINT: /images/edits
OPENAI_CHAT_ENDPOINT: /chat/completions
OPENAI_IMAGE_SIZE: 1024x1024
# OPENAI_RESPONSE_FORMAT: b64_json
```

### 密码验证

- 设置 `APP_PASSWORD` 后，网页会先显示简单密码页。
- 留空 `APP_PASSWORD` 可关闭密码验证。
- 登录状态使用 HttpOnly session cookie。

### 隐私 / 生成记录

服务端只做临时转发处理：

- 不写数据库；
- 不保存上传图片；
- 不保存生成图片；
- 不保存 prompt 或 API 响应；
- 不打印图片 base64、prompt、API Key 或请求体日志；
- 生成结果只保留在当前浏览器页面内存里，用户下载 ZIP 后由浏览器本地保存。

### GitHub Actions 编译

仓库包含 `.github/workflows/build.yml`，会在 push / pull request 时执行：

```bash
npm ci
npm test
npm run build
```

推送到 `main` / `master` 后还会自动构建并发布镜像到：

```text
ghcr.io/spacex-3/emojicut:latest
ghcr.io/spacex-3/emojicut:<commit-sha>
```

如果 GHCR 包首次发布后无法拉取，请在 GitHub 仓库的 Packages 页面把镜像可见性改为 Public，或在部署机器上执行 `docker login ghcr.io` 后再拉取。

## 📖 使用说明

1. **上传图片** - 点击打印机屏幕上传角色参考图
2. **输入风格** - 在输入框描述想要的画面风格（可选）
3. **生成贴纸** - 点击"生成贴纸"按钮，等待 AI 生成
4. **自动切图** - 生成完成后自动进入切图模式
5. **下载保存** - 点击"全部保存"下载 ZIP 包

## 🛠️ 技术栈

| 技术 | 说明 |
|------|------|
| **Gemini 3 Pro Image** | Nano Banana Pro 图像生成模型 |
| **React 19** | 前端框架 |
| **TypeScript** | 类型安全 |
| **Vite** | 构建工具 |
| **JSZip** | 打包下载 |

## 📁 项目结构

```
emoji-cut/
├── App.tsx              # 主应用组件
├── components/
│   ├── CutePrinter2D.tsx   # 可爱打印机 UI（含 AI 生成）
│   ├── StickerStack.tsx    # 贴纸堆叠展示
│   └── ManualCropModal.tsx # 手动裁剪弹窗
├── services/
│   ├── geminiService.ts    # Gemini API 调用
│   └── imageProcessor.ts   # 图片切割处理
├── shojo.css            # 可爱风格样式
└── types.ts             # TypeScript 类型定义
```

## 🎨 预设风格

- 🌸 可爱 LINE 贴纸
- 😆 Q版表情包
- 🎀 粉彩少女风
- ⚡ 动感活力风

也可以自定义输入任意风格描述！

## 📄 License

MIT License

---

<div align="center">

Made with 💕 using Gemini AI

</div>
