# dsh-client-ui-sidebar-idea

DeepSeek Harness 的 Idea 风格侧边栏。

它替换掉原生侧边栏列，分成三部分：

- 左侧的 **活动栏**，按钮分别是侧边栏主体、工作区文件树、底部终端面板；
- 由活动栏按钮打开的 **面板列**；
- 窗口底部的 **终端面板**，带标签页、可拖拽高度，跑的是当前会话目录下的真实 shell。

终端面板用活动栏按钮或 Ctrl 加反引号键打开。命令行在 **设置 → 终端** 里配置，默认新
标签用哪一个也在那里选。

本插件和原生侧边栏占用同一个 `sidebar` 座位，两者只能启用一个。

## 打包

```sh
pnpm install
pnpm build
```

`pnpm build` 生成 `lib/`，它是构建产物，不进版本库。

## 安装

有两种办法，用哪种都行。

### 办法一：项目里的脚本

```sh
pnpm run install:profile          # 装进 desktop（默认）
pnpm run install:profile web      # 装进 web
```

命令后面那个名字就是 profile 名，不写就是 `desktop`。

它做三件事：

1. 在 `~/.dsh/profiles/<名字>/package.json` 的 `dependencies` 里加一条链接，指向本目录；
2. 把本包的包名加进同一个文件的 `dsh.profile.bundles` 列表；
3. 在 profile 目录里跑一次 `pnpm install`，让那条链接变成真的模块。

### 办法二：dsh 命令

```sh
# 在本目录里执行
dsh plugin --profile web add .
```

`dsh plugin add` 干的是同一件事，而且依赖由它自己处理。但它不认 `desktop` 这个
profile —— 那个 profile 归 DSH Desktop 应用独占管理，命令会直接报错。所以装进
`desktop` 请用办法一。

两种办法重复执行都安全。装完重启 DSH Desktop 生效。

本包自带 patch 层，会禁用原生侧边栏列，以及原生右侧边栏的终端（它占着本面板要用的
Ctrl 加反引号这个快捷键）。所以选中这个 bundle 就是全部安装步骤，profile 的 patch 文件
不需要手工改。

## 开发

```sh
pnpm check   # 类型检查、测试、打包、冒烟
```
