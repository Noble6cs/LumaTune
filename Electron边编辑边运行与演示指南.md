# Electron 边编辑边运行与演示指南

本文档记录本项目在 Codex 中进行“修改源码、保持程序运行、实时查看效果、截图验证”的标准流程。新对话开始时，让 Codex 先阅读本文档即可复用。

> 本项目是基于 [LX Music（洛雪音乐助手）](https://github.com/lyswhut/lx-music-desktop) 开源项目修改的非官方版本。播放器背景算法参考了 [jayfunc/BetterLyrics](https://github.com/jayfunc/BetterLyrics)。

## 1. 项目信息

- 项目目录：`<项目目录>`
- 开发环境：Windows + PowerShell + Electron + Vue 3 + Webpack
- Renderer 源码：`src\renderer`
- Main 进程源码：`src\main`
- 启动命令：`npm run dev`
- Renderer 生产构建：`npm run build:renderer`

不要直接修改以下生成文件：

- `dist\*`
- 根目录生成的 `renderer.js`
- Webpack 输出的带 hash CSS 文件

这些文件会在构建时被覆盖，功能修改应落在 `src` 下。

## 2. 为什么可以边编辑边运行

`npm run dev` 会启动项目的开发 runner。它负责：

1. 监听 Renderer 源码变化。
2. 使用 Webpack 重新编译变化的 Vue、JS、TS 和样式文件。
3. 启动 Electron 开发窗口。
4. Renderer 变化后执行热更新或页面刷新。

因此，开发程序运行期间修改 `src\renderer` 下的文件，通常不需要手动重启 Electron。

以下修改通常需要重启开发程序：

- `src\main` 下的 Electron Main 进程代码。
- 启动配置、Webpack 配置或 preload 相关代码。
- `package.json` 依赖或启动脚本。
- 热更新异常、Electron 窗口退出或开发 runner 中断。

## 3. 推荐工作流程

### 第一步：确认依赖和现有修改

```powershell
Set-Location '<项目目录>'
git status --short
Test-Path node_modules
```

工作区可能已有用户修改。不要使用 `git reset --hard`、`git checkout --` 等命令覆盖它们。

### 第二步：启动前台开发程序

首次调试时优先在前台启动，方便看到编译错误：

```powershell
npm run dev
```

Codex 桌面环境中，启动 Electron GUI 可能需要用户批准。批准 `npm run dev` 后即可打开开发窗口。

### 第三步：保持程序运行并编辑源码

开发程序启动后，使用 `apply_patch` 修改源码。Renderer 文件保存后等待 Webpack 编译完成，再检查应用窗口。

适合热更新的文件包括：

- `src\renderer\views\**\*.vue`
- `src\renderer\components\**\*.vue`
- `src\renderer\store\**\*.ts`
- `src\renderer\assets\styles\**`
- `src\lang\*.json`

一次修改尽量聚焦一个行为，便于判断是哪项修改导致视觉或运行问题。

### 第四步：定向检查

先对本轮涉及的文件运行 ESLint：

```powershell
npx eslint -f node_modules/eslint-formatter-friendly `
  src/renderer/views/List/AllMusic/index.vue `
  src/renderer/views/List/AllMusic/PlaylistCard.vue
```

不要一开始就修复整个仓库的历史 lint 问题，只检查本次修改涉及的文件。

### 第五步：完整 Renderer 构建

功能完成后运行：

```powershell
npm run build:renderer
```

该命令验证：

- Vue 模板是否可以编译。
- 路径别名是否正确。
- TypeScript 和 JavaScript 是否可以打包。
- CSS/Less 是否可以生成。
- 生产环境条件分支是否有效。

只有 lint 和生产构建均通过，才算完成代码层验证。

## 4. 后台保持开发程序运行

需要让 Codex 继续执行其他命令，同时保留 Electron 窗口时，可以隐藏 npm 控制台并后台启动：

```powershell
$project = '<项目目录>'
$process = Start-Process `
  -FilePath npm.cmd `
  -ArgumentList 'run', 'dev' `
  -WorkingDirectory $project `
  -WindowStyle Hidden `
  -PassThru

$process.Id
```

注意事项：

- `-WindowStyle Hidden` 只隐藏 npm 控制台，Electron 应用窗口仍会显示。
- 记录返回的进程 ID，便于判断这次启动是否仍在运行。
- 后台 runner 偶尔可能因重编译或父进程结束而退出；Electron 消失时重新执行即可。
- 不要使用 `Stop-Process -Name electron`，这可能关闭其他 Electron 应用。

## 5. 安全定位本项目的 Electron 进程

电脑上可能同时运行 Codex、VS Code 和其他 Electron 应用，不能只按进程名选择。

先根据命令行中的项目路径定位 Electron Main 进程：

```powershell
$projectPattern = '*lx-music-desktop*dist\main.js*'
$mainProcess = Get-CimInstance Win32_Process |
  Where-Object {
    $_.Name -eq 'electron.exe' -and
    $_.CommandLine -like $projectPattern
  } |
  Select-Object -First 1

$appProcess = Get-Process -Id $mainProcess.ProcessId
$appProcess | Select-Object Id, MainWindowHandle, MainWindowTitle
```

如果 `MainWindowHandle` 为 `0`，等待几秒后重新读取；Renderer 和窗口可能仍在启动。

## 6. 应用窗口视觉检查

视觉检查不能只看代码，应实际确认：

- 页面不是空白。
- Canvas 有非黑、非透明像素。
- 卡片不会溢出父容器。
- 一排铺满后能自动换到下一排。
- 标题不会覆盖相邻卡片。
- 悬停、播放按钮和当前播放高亮正常。
- 窗口缩窄后网格仍能重新排布。

本项目“所有列表”页采用 CSS Grid 自动换行：

```less
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 24px 18px;
}
```

这里的换行对象是封面卡片，不是歌单名。歌单名保持单行并使用省略号：

```less
.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

## 7. 直接截取 Electron 窗口

普通桌面截图可能被 Codex 窗口遮挡。Windows 下可使用 `PrintWindow` 直接截取目标 Electron 窗口。

```powershell
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class ElectronCapture {
  [DllImport("user32.dll")]
  public static extern bool ShowWindow(IntPtr hWnd, int command);

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);

  [DllImport("user32.dll")]
  public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint flags);

  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }
}
'@

$projectPattern = '*lx-music-desktop*dist\main.js*'
$mainProcess = Get-CimInstance Win32_Process |
  Where-Object {
    $_.Name -eq 'electron.exe' -and
    $_.CommandLine -like $projectPattern
  } |
  Select-Object -First 1
$appProcess = Get-Process -Id $mainProcess.ProcessId

# 3 表示最大化。若不希望改变窗口状态，可删除这一行。
[ElectronCapture]::ShowWindow($appProcess.MainWindowHandle, 3) | Out-Null
Start-Sleep -Milliseconds 800

$rect = New-Object ElectronCapture+RECT
[ElectronCapture]::GetWindowRect($appProcess.MainWindowHandle, [ref]$rect) | Out-Null
$width = $rect.Right - $rect.Left
$height = $rect.Bottom - $rect.Top

$bitmap = New-Object System.Drawing.Bitmap $width, $height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$hdc = $graphics.GetHdc()
$captured = [ElectronCapture]::PrintWindow($appProcess.MainWindowHandle, $hdc, 2)
$graphics.ReleaseHdc($hdc)

$output = Join-Path $PWD 'qa\electron-preview.png'
New-Item -ItemType Directory -Force -Path (Split-Path $output) | Out-Null
$bitmap.Save($output, [System.Drawing.Imaging.ImageFormat]::Png)

$graphics.Dispose()
$bitmap.Dispose()

Write-Output "Captured=$captured Path=$output"
```

截图完成后可让 Codex 使用本地图片查看工具检查结果。

## 8. 动画页面的性能与悬停验证

大量卡片同时运行高帧率 Canvas 动画会造成明显负载。本项目当前策略是：

- 只为进入可视区域的卡片分配高分辨率 Canvas。
- 离开可视区域后停止动画并将 Canvas 缩回 `1x1`。
- 多张卡片共享流体算法的采样网格和计算缓冲。
- 未悬停卡片低刷新频率、正常流速。
- 鼠标进入某张封面后，只提高该卡片的刷新频率和流速。
- “我的收藏”是例外：悬停不加速，只根据当前状态触发一次“收敛后展开”或“直接展开”。
- CSS 装饰动画使用 transform，避免触发布局重排。
- 使用 `prefers-reduced-motion` 时关闭装饰动画。

当前“所有列表”封面参数位于：

- `src\renderer\views\List\AllMusic\PlaylistCard.vue`
- `src\renderer\components\layout\PlayDetail\DyiStyleVisual.vue`

流速核心逻辑：

```js
animationTime += elapsed * (isHovered.value ? 2.2 : 0.64)
const interval = isHovered.value ? 52 : 140
```

含义：

- 未悬停时使用 `0.64` 流速。
- 悬停时切换到 `2.2` 流速。
- 悬停卡片的 Canvas 刷新间隔也会缩短。

## 9. 演示数据不能污染真实数据

为了展示更多封面和自动换行，可以在开发环境追加内存演示项，但必须满足：

- 不调用列表创建接口。
- 不写数据库。
- 不写用户配置。
- 不允许演示卡片进入不存在的列表。
- 生产环境绝不显示。

本项目使用以下条件：

```js
window.lx.isProd ? [] : [
  { id: '__demo_list_1', name: 'Daily Mix', isDemo: true },
  // ...
]
```

点击处理器还需要阻止演示项执行真实操作：

```js
if (entry.isDemo) return
```

`window.lx.isProd` 在 `src\renderer\core\globalData.ts` 中由 `process.env.NODE_ENV` 设置。因此 `npm run dev` 会显示演示项，生产构建不会显示。

## 10. 使用真实数据副本测试

需要复现真实歌单、歌词或播放状态时，不能让开发版直接写入现用数据。原始目录通常是：

```text
$env:APPDATA\lx-music-desktop\LxDatas
```

只复制 `LxDatas`，不需要复制 `Cache`、`GPUCache` 等浏览器缓存。先停止本项目开发进程，再创建 Electron 官方支持的便携测试目录：

```powershell
$project = '<项目目录>'
$source = Join-Path $env:APPDATA 'lx-music-desktop\LxDatas'
$testUserData = Join-Path $project 'node_modules\electron\dist\portable\userData'

New-Item -ItemType Directory -Force -Path $testUserData | Out-Null
Copy-Item -LiteralPath $source -Destination (Join-Path $testUserData 'LxDatas') -Recurse
```

规则：

- 原始 `LxDatas` 只读，不覆盖、不迁移、不清理。
- 应用产生的数据库、播放状态和日志只能写入 `portable\userData` 副本。
- 复制 SQLite 数据时包含 `.db`、`.db-wal` 和 `.db-shm`。
- 测试完成后先停止本项目 Electron，再确认 `portable` 的绝对路径位于项目内，最后删除由本次测试创建的整个 `portable` 目录。
- 不要遗留 `portable`，否则下一次 `npm run dev` 仍会使用测试副本。

可根据 Electron 子进程的 `--user-data-dir` 确认隔离是否生效；路径应指向项目内的 `node_modules\electron\dist\portable\userData`。

## 11. 运行时和交互调试

### 区分 HMR 状态损坏与真实错误

热更新后偶尔会出现 Vue 的 `emitsOptions`、组件实例为 `null` 等错误。这类错误可能只是旧组件实例与新模块不兼容。处理顺序：

1. 保存完整错误文本和截图。
2. 只停止命令行包含本项目路径的 Node/Electron 进程。
3. 冷启动 `npm run dev`。
4. 在相同操作下重新复现。

冷启动后消失的是 HMR 状态问题；冷启动后仍能稳定出现并带有相同业务栈的，才按真实代码错误修复。不能为了让遮罩消失而忽略可重复的异常。

### 使用远程调试端口捕获错误

需要自动进入页面、读取 DOM 或捕获 `Runtime.exceptionThrown` 时，可以启动本机调试端口：

```powershell
netstat -ano | Select-String ':9333'
npm run dev -- --remote-debugging-port=9333
```

先确认端口空闲；若被 Edge、Chrome 或其他进程占用，换用另一个端口，不要结束无关进程。页面列表位于：

```text
http://127.0.0.1:9333/json/list
```

选择 URL 以 `http://localhost:9080/` 开头的 `page`，不要选 User API、DevTools 或 Worker。调试结束后关闭带调试端口的开发进程。

### 动画必须进行多帧验证

一张截图只能证明某一帧非空，不能证明完整周期正确。对于“收敛、展开、长时间停留、再次收敛”动画，应在鼠标移开时按关键阶段截取完整周期，并检查：

- 收敛状态仍保留约画面宽度的 `1/3`，不会完全消失。
- 展开范围达到设计参考。
- 展开后实际停留 `30-60` 秒，不会提前收回或持续抖动。
- 自动收敛后能再次展开。
- 悬停已展开封面时会先收敛再展开；悬停收敛中的封面时会直接展开，流速和刷新率不加速。

可使用 `PrintWindow` 在收敛、展开完成、停留中段和自动收回时取帧，再把目标封面区域拼成横向时间序列。悬停状态单独检查，确认播放键只出现在鼠标所在封面。

### 应用前台播放键盘回归

应用窗口处于前台时，键盘控制应在所有页面生效，不要求打开播放详情页。新增键盘控制后至少验证：

1. `Space` 切换一次播放状态，再按一次恢复。
2. 单按一次 `←` 或 `→`，等待超过双击间隔，歌曲不切换。
3. 在 420 毫秒内连续按两次 `→`，切到下一首。
4. 连续按两次 `←`，返回上一首。
5. 输入框、选择框、文本域和可编辑区域不会误触发。
6. 应用失去焦点后按键不生效，重新获得焦点时不会沿用失焦前的第一次方向键。
7. 切歌后页面无开发错误遮罩，运行时监听没有捕获异常。

切歌错误应检查歌曲标题变化和完整异常栈。例如歌词状态在切歌瞬间可能是行对象而不是字符串，显示层调用字符串方法前必须做类型保护，数据入口也应只写入声明类型允许的值。

## 12. 本次“所有列表”功能文件

- 固定栏目与排序：`src\renderer\views\List\MyList\index.vue`
- 页面入口切换：`src\renderer\views\List\index.vue`
- 所有列表数据与响应式网格：`src\renderer\views\List\AllMusic\index.vue`
- 歌单封面和动画：`src\renderer\views\List\AllMusic\PlaylistCard.vue`
- 最近播放列表记录：`src\renderer\store\player\recentPlay.ts`
- 播放器记录接入：`src\renderer\core\useApp\usePlayer\usePlayer.ts`
- 流体算法共享渲染：`src\renderer\components\layout\PlayDetail\DyiStyleVisual.vue`
- 播放详情页交互：`src\renderer\components\layout\PlayDetail\index.vue`
- 歌词状态入口：`src\renderer\core\lyric.ts`
- 持久化 IPC：`src\renderer\utils\ipc.ts`
- 文案：`src\lang\zh-cn.json`、`zh-tw.json`、`en-us.json`

## 13. 常见问题

### Electron 窗口突然消失

先确认 `npm run dev` 的父进程是否仍存在。如果后台 runner 已退出，重新启动。不要直接修改生成文件来绕过重启。

### 截图是黑色或尺寸只有一条窄条

可能原因：

- 选中了错误的 Electron 进程。
- 应用处于迷你窗口状态。
- 使用了屏幕复制，而窗口被其他应用遮挡。

处理方式：

1. 根据命令行中的项目路径定位 Main 进程。
2. 使用 `ShowWindow(..., 3)` 临时最大化。
3. 使用 `PrintWindow`，不要只用 `CopyFromScreen`。

### 修改后没有热更新

检查开发 runner 是否仍在运行。如果修改的是 Main 进程、构建配置或 preload，直接重启 `npm run dev`。

### 热更新后出现全屏红色错误遮罩

先记录错误，再冷启动复现。若冷启动后仍出现，使用控制台或远程调试捕获 `Runtime.exceptionThrown`，不要只根据遮罩最上方的一行猜测原因。

### 生产版出现演示卡片

检查演示数据是否完整包裹在 `window.lx.isProd ? [] : [...]` 条件中，并再次运行 `npm run build:renderer`。

### 卡片很多时内存上涨

检查是否为每张卡片单独创建了大尺寸采样网格、ImageData 或永久运行的 RAF。算法缓冲应共享，离屏卡片应停止 RAF 并释放高分辨率 Canvas。

## 14. 新对话可直接使用的提示词

```text
请先完整阅读：
<项目目录>\Electron边编辑边运行与演示指南.md

然后在以下项目中继续开发：
<项目目录>

要求：
1. 先检查现有工作区和相关源码，不覆盖已有修改。
2. 启动 npm run dev，并在修改 Renderer 时保持 Electron 开发版运行。
3. 每轮修改后等待热更新并实际检查窗口，不只看代码。
4. 需要更多演示内容时，只使用开发环境内存数据，不写入真实列表或数据库。
5. 需要真实数据时，只读复制 LxDatas 到项目内 portable 测试目录，所有写入落在副本，测试后停止项目进程并清理副本。
6. 检查桌面宽屏和较窄窗口下的布局、自动换行、文本溢出和交互状态。
7. 动画按完整周期多帧取样，悬停状态单独检查；不能只看一张静态图。
8. HMR 报错先记录，再冷启动复现；稳定错误使用完整运行时栈定位。
9. 完成后对涉及文件运行定向 ESLint，再运行 npm run build:renderer。
10. 使用 PrintWindow 截取 Electron 窗口并检查 Canvas 非空、卡片不重叠。
11. 开发程序保持运行，最后说明验证结果和主要修改文件。

本次具体需求：
（在这里填写新需求）
```

## 15. 完成标准

一次边改边演示任务至少应满足：

- 源码修改位于正确模块。
- Electron 开发版实际启动。
- 热更新后的页面已人工或截图检查。
- 演示数据与真实数据隔离。
- 真实数据测试只写入经过确认的副本。
- 可见卡片和 Canvas 非空。
- 周期动画已用多帧而非单帧验证。
- 卡片可以按容器宽度自动换行。
- 交互状态不会引发布局跳动。
- 定向 ESLint 通过。
- `npm run build:renderer` 通过。
- 冷启动后的关键交互没有运行时错误遮罩。
- 最终说明开发程序状态和验证结果。
