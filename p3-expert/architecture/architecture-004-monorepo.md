---
id: architecture-004
title: 前端架构之 Monorepo 与代码复用
series: 前端架构系列
seriesId: architecture
stage: expert
difficulty: 4
tags: [Monorepo, pnpm workspace, 代码复用, Turborepo, 分包策略]
readingTime: 18
prev: architecture-003
next: architecture-005
createdAt: 2026-10-26
---

# 前端架构之 Monorepo 与代码复用

## 从「修一个公共组件，发布到全公司用上，要 3 天」说起

```
多仓（Polyrepo）的公共包日常：
  修 utils 的 bug → 发版 utils@2.3.1 → 8 个项目各自升级 MR → 8 轮 CI → 分批上线
  一个 typo 的修复成本 = 3 天 ✖️ 惊人的一致性成本
```

Monorepo 的答案：**多个项目/包放在一个仓库里，原子提交、统一版本节奏**。⭐⭐ 本篇讲清它的核心机制（workspace）、工具选型（pnpm/turbo）与分包策略——它与微前端（003）是「拆分」的两个相反方向，一起构成组织架构的决策空间。

## 现象与直觉解释

```
Polyrepo: 每项目一仓 —— 隔离彻底，协作成本高（升级扩散慢）
Monorepo: 全家一仓   —— 协作原子化，需要工具管好规模

Monorepo 的核心收益:
  ① 原子提交: 跨包改动一个 MR（修组件+改用例+更新文档 一气呵成）⭐
  ② 即时联调: workspace 直链，改本地包 = 全项目立即生效（无需发版）
  ③ 统一治理: 一份 lint/tsconfig/CI 配置，一个依赖版本策略
```

## 深入原理

### 一、pnpm workspace：Monorepo 的地基 ⭐⭐⭐

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'      # 应用: web / admin / mobile-h5
  - 'packages/*'  # 包: ui / utils / hooks / config
```

```jsonc
// apps/web/package.json —— 包间引用用 workspace 协议
{
  "dependencies": {
    "@mono/ui": "workspace:*",      // ⭐ 指向本地源码，不发版直接用
    "@mono/utils": "workspace:*"
  }
}
// workspace:* 的发布魔法: 发版时自动替换为真实版本号 ^1.2.0
```

**工程化收益链**（与 engineering-001 的呼应）：

```
本地直链: 改 packages/utils → apps/web 热更新即时生效（联调零成本）⭐
依赖去重: pnpm 的全局 store + 严格拓扑（无幽灵依赖——子包也不能乱 import 别人的依赖）
统一版本: 根目录一份 lock —— 全仓依赖宇宙一致
```

### 二、任务编排：Turborepo 的「缓存与拓扑」 ⭐⭐⭐

```
问题: 12 个包各自 build/test，串行跑 20 分钟；改了一个包却全量重跑

Turborepo（或 Nx）的两个武器:
① 任务拓扑: 依赖声明的 DAG —— ui 变了只重建 [ui → 依赖 ui 的 apps]
  // package.json
  "turbo": { "build": { "dependsOn": ["^build"] } }   // 先构建我的依赖 ⭐
② 内容哈希缓存: 输入没变 → 直接吐上次产物（本地 + CI 共享远程缓存）⭐
  turbo run build --filter=web    # 只构建 web 及其依赖链
  # 二次构建常见从 8 分钟 → 40 秒（全缓存命中）
```

### 三、分包策略：边界比工具更重要 ⭐⭐⭐

```
常见结构（按"变化原因"分层 ⭐）:
monorepo/
├── apps/           # 部署单元（会上线的东西）: web admin docs
├── packages/
│   ├── ui/         # 设计系统（组件）—— 变化原因: 设计规范
│   ├── hooks/      # 通用逻辑
│   ├── utils/      # 纯函数工具
│   ├── api-client/ # 接口层封装（与后端契约同步）
│   ├── config/     # eslint/tsconfig/tailwind 预设
│   └── icons/      # 图标（自动生成）
└── pnpm-workspace.yaml

分包三问（判断新代码放哪）:
  ① 谁会用它？（只有 web → app 内部；≥2 应用 → packages）
  ② 它的变化节奏跟谁一致？（跟设计走 → ui；跟接口契约走 → api-client）
  ③ 它有独立外部使用者吗？（要发 npm → 独立包+严格 API；纯内部 → 宽松）
```

**反模式**：为「复用一个函数」建 10 个细碎包（包维护成本 > 复制成本）——**「三处重复再抽象」在包层面同样成立**。

### 四、版本与发布：Changesets ⭐⭐

```
问题: 全仓一起发还是各发各的？
Changesets 工作流:
  改动时写一个 .changeset/xxx.md（"@mono/ui: minor —— 新增 DatePicker"）
  → 合并主干后 CI 汇总 → 版本号自动 bump + CHANGELOG 生成 + 发布
  workspace 依赖的版本联动自动处理（ui minor → apps 引用自动升）
固定版本(locked) vs 独立版本(independent):
  内部套件 → locked（一套版本，心智简单 ⭐）; 对外开源的多包 → independent
```

### 五、Monorepo vs 微前端：一张对比与组合 ⭐⭐⭐

| | Monorepo | 微前端 |
|---|---|---|
| 拆什么 | **代码仓**（物理上一体） | **应用**（运行时拼装） |
| 解决 | 复用与协作成本 | 团队自治与独立部署 |
| 边界 | 包边界（编译期） | 应用边界（运行时沙箱） |
| 适合 | 同一平台团队/强关联产品线 | 跨部门/技术栈异构 |

**正交且常组合**：大厂常见「微前端的每个子应用本身是 Monorepo 中的一个域目录」——**仓库策略与运行时架构是两个独立决策**。

## 回看开篇

3 天修复周期的病根：多仓的「一致性成本」（升级扩散慢）；Monorepo 的原子提交+workspace 直链把成本压到分钟级——但代价是仓库规模治理（工具与纪律）。**拆分方向的选型：先问「要解决的是复用协作（Monorepo）还是组织自治（微前端）」**。

## 实战延伸

**1. 面试答题骨架**：「Monorepo 用一个仓库管理多个应用与包，获得原子提交、workspace 本地直链的即时联调与统一治理。地基是 pnpm workspace——包间用 workspace 协议引用本地源码、发版时自动替换真实版本，配合 pnpm 的严格拓扑杜绝幽灵依赖；任务层用 Turborepo 声明依赖拓扑（先建依赖再建自身）并按内容哈希缓存任务产物，二次构建大幅提速；发布用 Changesets 管理版本联动与变更日志。分包按变化原因分层——部署单元进 apps、按设计规范与接口契约变化的复用进 packages，遵循三处重复再抽象。它与微前端正交：前者解决复用协作，后者解决团队自治。」

**2. 一道设计题**：把「主站 + 运营后台 + 组件库 + 图标 + 请求封装」规划成 Monorepo 结构——画出目录、写三个 package.json 关键片段、配置一条 turbo 任务链。

## 图解总结

```
pnpm workspace: workspace:* 本地直链(联调零成本) │ 发版自动替换版本
              + 严格拓扑(无幽灵依赖) + 全仓一份lock
Turborepo: dependsOn: ["^build"] 拓扑执行 │ 内容哈希缓存(二次构建40秒)
分包: apps=部署单元 │ packages=按变化原因(ui/config/api-client)
     三问: 谁用? 变化跟谁? 有无外部使用者? │ 三处重复再抽象
发布: Changesets(版本联动+CHANGELOG) │ 内部locked / 开源independent
vs 微前端: 仓库策略 vs 运行时架构 —— 正交可组合
```

## 总结

- Monorepo 收益：原子提交、直链联调、统一治理；地基是 pnpm workspace；
- workspace 协议本地引用、发布自动换版本号；严格拓扑杜绝幽灵依赖；
- Turborepo：拓扑执行（^build）+ 内容哈希缓存（本地/CI 共享）；
- 分包按变化原因分层；三处重复再抽象是包级纪律；
- Changesets 管版本；与微前端正交——复用协作 vs 组织自治。

**面试一句话回答**：Monorepo 把多个应用与公共包收敛到一个仓库，核心收益是原子提交——跨包修改变更一次 MR 完成，以及 workspace 本地直链——修改公共包后所有引用方即时生效无需发版。其地基是 pnpm workspace：包之间以 workspace 协议引用本地源码、发布时自动替换为真实版本，同时 pnpm 的严格依赖拓扑在仓库层面杜绝幽灵依赖。任务层用 Turborepo 声明 build 依赖拓扑实现按需构建，并以输入内容哈希做任务缓存，本地与 CI 共享后二次构建从分钟级降到秒级；发布用 Changesets 自动处理版本联动与变更日志。分包按变化原因分层——部署单元在 apps、随设计规范或接口契约变化的复用代码在 packages，并遵循出现三处重复才抽象的原则。它与微前端是正交决策：前者解决复用与协作成本，后者解决团队自治与独立部署。

## 思考题

1. `workspace:*` 与 `workspace:^` 在发版替换时的差异？内部包为什么建议用 `*`（版本由 Changesets 联动，无需人为约定范围）？
2. Turborepo 的缓存 key 包含哪些输入？（文件内容+依赖+环境变量+参数——漏环境变量会导致「缓存命中却行为不同」的事故）
3. 「根目录的 package.json 该放什么依赖」？（工作区工具与格式化类；业务依赖进各包——避免幽灵依赖复辟）
4. 开放设计：5 人小团队、1 个产品线——Monorepo 还是 Polyrepo？给出决策变量与迁移时机建议。

（思考题解析将同步录入小程序题库，关联本文 id：architecture-004）

## 参考文献：

- pnpm — workspace 官方文档
- Turborepo — 缓存与拓扑执行文档
- Changesets — 版本管理流程
- 本课程《engineering-001 依赖管理》《architecture-003 微前端》
