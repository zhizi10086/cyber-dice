# 虚空天机计算盘 V4.1.0

“赛博骰子”的网页版与多端离线版。项目保留原始 C 程序的六骰权重、反向 D100、吉平凶阈值、综合偏差和五档天师批语，并提供自动掷骰、手动点数解析、D20 一掷问天、天机卡牌与天命档案。

## 在线访问

- GitHub Pages：<https://zhizi10086.github.io/cyber-dice/>
- Windows 离线版：<https://github.com/zhizi10086/cyber-dice/releases/latest/download/Cyber-Dice-win-x64.exe>
- macOS 离线版：<https://github.com/zhizi10086/cyber-dice/releases/latest/download/Cyber-Dice-macOS-universal.dmg>
- Android 版：<https://github.com/zhizi10086/cyber-dice/releases/latest/download/Cyber-Dice-android.apk>

网页底部同样提供以上三个稳定下载入口；iPhone/iPad 请使用 Safari 的“添加到主屏幕”安装 PWA。

## 网页开发

直接用现代浏览器打开 `index.html` 即可。页面没有框架、构建步骤、CDN 或外部字体依赖。

如果浏览器限制本地脚本，可以在项目根目录启动任意静态文件服务器：

```powershell
python -m http.server 4173
```

随后访问 `http://127.0.0.1:4173/`。

主要文件：

```text
.
├── index.html
├── styles.css
├── app.js
├── assets/                  # 福马等本地视觉资源
├── vendor/                  # 本地内置的卡牌与二维码生成库
├── manifest.json            # PWA 应用清单
├── sw.js                    # PWA 离线缓存
├── tools/                   # PWA 图标生成等辅助脚本
├── launcher/                # Windows 离线版工程
├── desktop/                 # Tauri macOS 离线版工程
├── android/                 # Bubblewrap TWA Android 工程
├── build-exe.ps1            # Windows 离线版构建脚本
└── .github/workflows/       # Pages 与 macOS 构建流程
```

## Windows 离线版

离线版是原生 Win32 + WebView2 窗口程序，HTML、CSS 和 JavaScript 全部编译进 EXE，不需要本地服务器，也不需要联网下载页面资源。

构建要求：

- Windows 10/11 x64
- Visual Studio 2026，安装“使用 C++ 的桌面开发”
- Windows 11 SDK
- 首次还原 `Microsoft.Web.WebView2 1.0.4314.35` 时需要网络

在 PowerShell 中运行：

```powershell
.\build-exe.ps1
```

输出文件为 `dist/Cyber-Dice-win-x64.exe`，同时生成 `dist/Cyber-Dice-win-x64.exe.sha256`。

常见 Windows 10/11 已包含 WebView2 Runtime。如果运行环境缺少该组件，程序会提示并回退到默认浏览器打开内嵌页面。也可以主动使用以下命令测试浏览器回退：

```powershell
.\dist\Cyber-Dice-win-x64.exe --browser
```

### 运行提示

离线 EXE 未进行代码签名，其他电脑首次运行时可能出现“未知发布者”或 Microsoft Defender SmartScreen 提示。请只从本仓库的 Releases 页面下载，并使用 Release 说明中公布的 SHA-256 校验文件。

## macOS 离线版

macOS 版使用 Tauri 2 构建 x86_64 与 Apple Silicon 通用应用。网页资源在构建前由 `desktop/scripts/stage.mjs` 复制到 `desktop/dist/`，随后打包为未签名的通用 DMG。

本地可在已安装 Rust 与 Xcode Command Line Tools 的 macOS 上运行：

```bash
cd desktop
npm ci
npm run tauri -- build --target universal-apple-darwin
```

也可以在 GitHub Actions 手动运行 `Build macOS Universal DMG`，下载 `Cyber-Dice-macOS-universal` 构建产物。首次打开未签名应用时，可能需要在 Finder 中右键选择“打开”。

## Android 版

Android 版使用 Bubblewrap 将正式 PWA 包装为 Trusted Web Activity（TWA），支持 Android 7.0（API 24）及以上，包名为 `com.zhizi10086.cyberdice`。首次启动需要联网验证站点与应用关联，成功缓存后可在离线状态继续使用。

APK 使用单独的发布密钥签名；密钥、密码和本地签名配置只保存在被忽略的 `_内部文档/android-signing/`，不会进入公开仓库。正式安装包仅在 Android 真机验收通过后发布。

## iOS 与 PWA

iPhone/iPad 使用 Safari 的“添加到主屏幕”安装 PWA，不另行分发原生应用。已适配安全区、独立显示、触摸布局、离线缓存和文件分享；若系统不支持文件分享，会回退为下载 PNG。

## GitHub Pages 发布

仓库推送 `main` 后，`.github/workflows/pages.yml` 会自动把网页资源部署到 GitHub Pages，也可以从 Actions 页面手动触发。

首次启用时，需要在仓库 **Settings → Pages** 中将发布来源设置为 **GitHub Actions**。

## PWA 安装与离线使用

GitHub Pages 首次成功加载后会安装 Service Worker，并缓存页面、第三方脚本、图标与福马素材。支持 PWA 的浏览器可从原生安装入口添加到桌面；断网后仍可使用起卦、分享回放、天命档案和卡牌生成。

离线 EXE 使用独立的 `https://cyber-dice.local` 虚拟域名保存档案，不注册浏览器 Service Worker。

## 功能说明

- 自动模式使用 Web Crypto 生成均匀随机点数。
- 手动模式接受 1 到对应骰子面数之间的整数。
- 支持“六合推演 / 一掷问天”体系切换；一掷问天使用 Web Crypto 生成均匀 D20 点数，并提供本地 Canvas 正二十面体动画。
- D20 按 1、2–5、6–15、16–19、20 五档显示等级、判词与天机低语，不依赖场景，也不提供手动点数输入。
- 手机端使用加减步进器调整骰子点数。
- 骰子顺序为 D20、D100、D12、D8、D6、D4；D100 为反向骰。
- D100 文案：凶“深渊凝视”、平“暗流涌动”、吉“风平浪静”。
- 支持虚空漫游、开核桃、洗紫卡和捅玄骸四种场景及对应低语。
- 包含隐藏成就、献祭福马彩蛋和最近五十条天命档案。
- 天命档案支持全部、吉、平、凶筛选，单条展开明细，以及带完整时间的文字战报和结果链接分享；六合与 D20 记录可混合保存。
- 五分钟后防沉迷提示同时适用于网页版与离线版。
- 综合结果支持一键复制群聊战报。
- 支持复制带骰子参数的正式分享链接，六合与 D20 分享均可只读回放，且不会写入本地档案。
- 支持自定义法号并生成 750×1334 的 PNG 天机卡牌，六合卡牌与 D20 单骰卡牌均附带本局二维码。
- 支持 PWA 安装，并在首次在线加载后离线使用。
- 提供 Windows 单文件 EXE、macOS 通用 DMG 和 Android TWA APK；iOS 使用 Safari PWA。
- 吉态、凶态和极端场景提供对应视觉反馈。
- 页面支持桌面与手机布局，并遵循系统的“减少动态效果”设置。

卡牌生成使用本地内置的 `html2canvas 1.4.1` 和 `qrcode-generator 2.0.4`，二者的 MIT 许可与版权信息见 `THIRD_PARTY_NOTICES.md`。

本工具仅供娱乐，结果不构成现实建议。
