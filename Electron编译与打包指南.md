# Electron 编译与打包指南

本文档记录本项目在 Windows 上进行生产编译、生成安装包和核验产物的标准流程。新对话开始时，让 Codex 先完整阅读本文档即可复用。

> 本项目是基于 [LX Music（洛雪音乐助手）](https://github.com/lyswhut/lx-music-desktop) 开源项目修改的非官方版本。播放器背景算法参考了 [jayfunc/BetterLyrics](https://github.com/jayfunc/BetterLyrics)。

## 1. 项目信息

- 项目目录：`<项目目录>`
- 技术栈：Electron + Vue 3 + Webpack
- 软件版本：读取 `package.json` 中的 `version`
- 生产资源目录：`dist`
- 安装包输出目录：`build`
- 默认安装包格式：Windows x64 NSIS 安装程序
- 默认文件名格式：`lx-music-desktop-v版本号-x64-Setup.exe`

开始操作：

```powershell
Set-Location '<项目目录>'
node --version
npm --version
Test-Path node_modules
```

本项目要求 Node.js 22 或更高版本。若 `node_modules` 不存在或依赖不完整，先运行：

```powershell
npm install
```

不要直接修改 `dist`、`build` 或根目录的 `renderer.js` 等生成文件。功能修改应落在 `src` 下。

## 2. 默认完整打包命令

日常生成 Windows x64 安装包时使用：

```powershell
npm run pack
```

这是推荐命令，它会依次执行：

1. `node build-config/pack.js`：编译 Main、Renderer、歌词窗口、Renderer 脚本和主题等生产资源。
2. `npm run pack:win:setup:x64`：调用 electron-builder 生成 Windows x64 NSIS 安装程序。

不要把下面的命令当成完整编译：

```powershell
npm run pack:win:setup:x64
```

该命令只封装当前已有的 `dist`。若源码刚修改但没有先执行生产构建，安装包可能包含旧代码。

## 3. 只进行生产编译

编译所有生产资源，但不生成安装包：

```powershell
npm run build
```

按模块单独检查：

```powershell
npm run build:main
npm run build:renderer
npm run build:renderer-lyric
npm run build:renderer-scripts
```

仅修改普通 Vue 页面时，可先用 `npm run build:renderer` 快速验证；正式交付仍应运行 `npm run pack`。

## 4. Windows 打包类型

以下命令只打包现有 `dist`。源码发生变化时，应先执行 `npm run build`，或者直接使用第 2 节的 `npm run pack`。

### x64 安装版

```powershell
npm run pack:win:setup:x64
```

### x64 便携版

```powershell
npm run pack:win:portable:x64
```

### x64 绿色压缩包

```powershell
npm run pack:win:7z:x64
```

### Windows 7 x64 安装版

```powershell
npm run pack:win7:setup:x64
```

项目还提供 x86、ARM64、Linux 和 macOS 脚本，具体名称以 `package.json` 的 `scripts` 为准。不要在 Windows 上假定能够可靠生成并验证 macOS 安装包。

## 5. 打包前处理开发进程

先检查开发端口：

```powershell
Get-NetTCPConnection -LocalPort 9080 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress, LocalPort, State, OwningProcess
```

根据 PID 查看命令行，确认它确实属于本项目：

```powershell
$pidToCheck = 12345
Get-CimInstance Win32_Process -Filter "ProcessId = $pidToCheck" |
  Select-Object ProcessId, Name, CommandLine
```

只有命令行包含本项目路径时才停止：

```powershell
Stop-Process -Id $pidToCheck
```

定位本项目 Electron Main 进程：

```powershell
Get-CimInstance Win32_Process |
  Where-Object {
    $_.Name -eq 'electron.exe' -and
    $_.CommandLine -like '*lx-music-desktop*dist\main.js*'
  } |
  Select-Object ProcessId, Name, CommandLine
```

不要使用 `Stop-Process -Name electron`，它会关闭 Codex、VS Code 或其他 Electron 应用。多数情况下开发服务不会妨碍生产打包；只有文件被占用、需要清理产物或避免混淆测试窗口时才停止它。

## 6. 检查打包产物

打包成功后，列出最新安装包：

```powershell
Get-ChildItem '.\build' -File |
  Where-Object Extension -In '.exe', '.7z' |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 10 FullName, Length, LastWriteTime
```

进一步核验默认安装包：

```powershell
$artifact = Get-ChildItem '.\build\lx-music-desktop-v*-x64-Setup.exe' |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

$artifact | Select-Object FullName, Length, LastWriteTime
Get-FileHash -LiteralPath $artifact.FullName -Algorithm SHA256
```

核验重点：

- 命令退出代码为 `0`。
- 文件大小明显大于 `0`，并符合 Electron 安装包的正常体量。
- `LastWriteTime` 是本次打包时间，而不是旧产物。
- 文件名中的版本、架构和类型正确。
- 需要交付时记录 SHA-256，便于确认文件未损坏或被替换。

如需实际安装验证，先确认不会覆盖重要的现用配置，再启动安装包并检查安装、启动、核心页面和卸载流程。

## 7. 常见问题

### 端口 9080 被占用

这通常影响 `npm run dev`，不一定影响生产打包。按第 5 节查看 PID 和命令行，只停止确认属于本项目的进程。

### `build` 文件被占用

关闭已运行的本项目打包版和开发版窗口，再按项目路径定位相关进程。不要按 `electron.exe` 名称批量结束。

### Electron 或 electron-builder 下载失败

先确认网络和代理设置，再重试。项目提供 `npm run dp` 作为带本地代理参数的打包脚本，但它固定使用 `127.0.0.1:2081`；只有本机确实有该代理时才能使用。

依赖下载已完成时，electron-builder 通常会复用用户缓存。不要为了试错随意删除全部 npm 或 Electron 缓存。

### `winCodeSign` 无法创建符号链接

典型错误如下：

```text
ERROR: Cannot create symbolic link: 客户端没有所需的特权。
darwin\10.12\lib\libcrypto.dylib
darwin\10.12\lib\libssl.dylib
```

这是 electron-builder 解压 `winCodeSign-2.6.0.7z` 时触发的 Windows 权限问题。优先开启 Windows“开发者模式”，或在具有“创建符号链接”权限的终端中重试。

若只需生成 Windows 安装包，失败的两个链接属于归档内的 macOS 工具，Windows 实际使用的是 `rcedit-x64.exe`。第一次失败通常已经把 Windows 文件解压到随机数字目录，可以将最新的完整目录复制到 electron-builder 的固定缓存目录：

```powershell
$cache = Join-Path $env:LOCALAPPDATA 'electron-builder\Cache\winCodeSign'
$target = Join-Path $cache 'winCodeSign-2.6.0'
$source = Get-ChildItem $cache -Directory |
  Where-Object {
    $_.Name -ne 'winCodeSign-2.6.0' -and
    (Test-Path (Join-Path $_.FullName 'rcedit-x64.exe'))
  } |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

New-Item -ItemType Directory -Force -Path $target | Out-Null
Copy-Item -Path (Join-Path $source.FullName '*') -Destination $target -Recurse -Force
Test-Path (Join-Path $target 'rcedit-x64.exe')
```

最后一行必须返回 `True`。如果生产编译已经成功，只需重试封装，不必再次编译：

```powershell
npm run pack:win:setup:x64
```

若这一步继续尝试联网下载，检查固定目录名是否准确、`rcedit-x64.exe` 是否直接位于该目录根部。不要使用来源不明的签名工具缓存。

### 其他权限、缓存或签名工具报错

先保留完整错误文本并确认失败发生在哪一步。若 Codex 沙箱阻止了用户缓存、签名工具或安装包生成，应让 Codex 对同一打包命令申请必要权限后重试，而不是跳过打包。放开沙箱不一定等于获得 Windows 管理员或符号链接特权，应以实际错误为准。

本项目默认生成未配置商业证书签名的本地安装包。Windows 的信誉或 SmartScreen 提示不等同于构建失败；正式公开分发时应另行配置代码签名。

### 安装包生成了但内容还是旧版

常见原因是直接运行了 `npm run pack:win:setup:x64`，却没有更新 `dist`。重新执行：

```powershell
npm run pack
```

然后核对产物修改时间。

### 内存不足或构建异常中止

关闭不必要的开发进程，确认磁盘空间充足，再重新执行。不要把上一次残留的安装包误认为本次成功产物，应同时核对命令退出码和修改时间。

## 8. 新对话可直接使用的提示词

```text
请先完整阅读：
<项目目录>\Electron编译与打包指南.md

然后在以下项目中编译并打包：
<项目目录>

要求：
1. 先检查 package.json、现有工作区和依赖，不覆盖已有修改。
2. 查看 9080 和 Electron 进程；只停止命令行明确属于本项目的进程。
3. 使用 npm run pack 完整编译并生成 Windows x64 安装包。
4. 如果遇到网络、缓存或权限问题，保留错误并继续处理，不要只完成 Renderer 构建。
5. 等待命令完整结束，确认退出代码为 0。
6. 从 build 目录找到本次生成的安装包，报告绝对路径、文件大小、修改时间和 SHA-256。
7. 不发布、不上传，也不要安装，除非我另行要求。
```

需要同时进行界面开发和实时演示时，再阅读：

`<项目目录>\Electron边编辑边运行与演示指南.md`

## 9. 完成标准

一次编译打包任务至少应满足：

- 使用生产模式编译了最新源码。
- 完整打包命令退出代码为 `0`。
- 目标格式和架构正确。
- 安装包实际存在且大小正常。
- 安装包修改时间属于本次任务。
- 已报告产物的绝对路径、大小和校验值。
- 未把旧产物或仅完成的 Renderer 构建误报为打包成功。
