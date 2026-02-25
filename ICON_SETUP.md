# 图标设置说明

## 图标文件要求

为了在 Electron 应用中使用图标，需要准备以下图标文件：

### 1. 基础图标文件（必需）
- **icon.png** - 放在项目根目录
  - 尺寸：512x512 或 1024x1024 像素
  - 格式：PNG（透明背景）
  - 用途：Linux 平台和应用内使用

### 2. Windows 图标（必需）
- **icon.ico** - 放在项目根目录
  - 尺寸：包含多个尺寸（16x16, 32x32, 48x48, 256x256）
  - 格式：ICO
  - 用途：Windows 平台应用图标和安装程序

### 3. macOS 图标（可选）
- **icon.icns** - 放在项目根目录
  - 尺寸：包含多个尺寸（16x16 到 1024x1024）
  - 格式：ICNS
  - 用途：macOS 平台应用图标

## 如何生成图标文件

### 方法 1：使用在线工具
1. 访问 https://convertio.co/zh/png-ico/ 或 https://cloudconvert.com/png-to-ico
2. 上传您的 PNG 图标文件
3. 下载生成的 ICO 文件，重命名为 `icon.ico`

### 方法 2：使用 ImageMagick（命令行）
```bash
# 安装 ImageMagick
# Windows: choco install imagemagick
# macOS: brew install imagemagick
# Linux: sudo apt-get install imagemagick

# 生成 ICO 文件（包含多个尺寸）
magick convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico

# 生成 ICNS 文件（macOS）
# 需要先创建 iconset 目录结构
mkdir icon.iconset
sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
iconutil -c icns icon.iconset
```

### 方法 3：使用 Electron Builder 图标生成工具
```bash
# 安装 electron-icon-maker
npm install -g electron-icon-maker

# 生成所有格式的图标
electron-icon-maker --input=icon.png --output=.
```

## 文件放置位置

将所有图标文件放在项目根目录：
```
test-page/
├── icon.png    (必需)
├── icon.ico    (Windows 必需)
├── icon.icns   (macOS 可选)
└── ...
```

## 验证

配置完成后，运行以下命令验证：
```bash
# 开发模式测试
npm run electron

# 构建应用（会使用图标）
npm run build:electron
```

## 注意事项

1. **图标尺寸**：建议使用 512x512 或 1024x1024 的 PNG 作为源文件
2. **透明背景**：PNG 图标应使用透明背景
3. **文件命名**：必须使用 `icon.png`、`icon.ico`、`icon.icns` 这些文件名
4. **托盘图标**：代码会自动从 `icon.png` 加载并调整大小
