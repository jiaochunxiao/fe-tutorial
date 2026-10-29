---
id: browser-basic-005
title: 浏览器基础之同源策略初识
series: 浏览器基础系列
seriesId: browser-basic
stage: foundation
difficulty: 2
tags: [同源策略, 源, 安全边界, 沙箱, 安全地基]
readingTime: 14
prev: browser-basic-004
next: browser-basic-006
createdAt: 2026-10-26
---

# 浏览器基础之同源策略初识

## 从「如果浏览器没有同源策略」的思想实验说起

假设任何网站都能自由读取其他网站的数据：

```
你登录了银行 a-bank.com（Cookie 里躺着会话）
然后点开了 evil.com：
  evil.com 的 JS 执行 fetch('https://a-bank.com/api/balance')
  → 浏览器【自动带上你的 Cookie】（Cookie 的默认行为）
  → 拿到余额 JSON，发回攻击者服务器 💥
  你甚至全程无感
```

**同源策略（Same-Origin Policy，SOP）**就是阻断这条链的浏览器安全基石：**一个源的脚本，默认不能读取另一个源的资源**。⭐ 本篇是《network-007 跨域》与《security》系列的地基——先把「源是什么、拦什么、不拦什么」立清楚。

## 现象与直觉解释

**源（origin）= 协议 + 域名 + 端口**，三者全同才是同源：

```
https://a.com/page  与  https://a.com/api        同源 ✅（路径无关）
https://a.com       与  http://a.com             跨源 ❌（协议不同）
https://a.com       与  https://www.a.com        跨源 ❌（域名不同——子域也算）
https://a.com       与  https://a.com:8443      跨源 ❌（端口不同）
```

直觉：**每个源是一个「租户」，浏览器是大楼的保安**——SOP 规定：一个租户的代码，默认不能进入其他租户的房间（读数据）。

## 深入原理

### 一、SOP 到底拦什么（重要：不是全拦）⭐⭐

最常被误解的点——**同源策略拦的是「读取」，不是「发出与写入」**：

| 行为 | 是否受限 | 说明 |
|---|---|---|
| 跨源**发请求**（GET/POST 发出去） | 不拦 | 请求会到达服务器 |
| 跨源**读响应内容** | **拦** ⭐ | 没 CORS 头，浏览器扣下响应（《network-007》的主角） |
| 跨源**写目标**（如表单提交跳转） | 基本不拦 | 写操作靠 CSRF token 防护（《security-002》） |
| 读取跨源 **DOM/iframe** | **拦** | `iframe.contentWindow.document` 报错 |
| 读取跨源 **Cookie/localStorage** | **拦** | 存储按源隔离 |
| `<img>/<script>/<link>` **加载**跨源资源 | 不拦 | 历史能力——但 JS 读不到内容（画到 canvas 会污染） |
| 跨源脚本调用另一个 window 的 JS | 受限 | 只能 postMessage 通信 |

**为什么 `<img src>` 能跨源加载却算「安全」**？——因为「加载并展示」不等于「让攻击者的 JS 读到内容」；但数据一旦想进 canvas 被脚本读取，taint（污染）机制就会拦截 `getImageData`——**SOP 的红线始终是「脚本读到跨源数据」**。

### 二、SOP 与进程/沙箱的关系（架构串讲）⭐

三层防线层层递进（《browser-basic-001》的呼应）：

```
① 进程隔离：不同站点的页面/iframe 分属不同渲染进程 —— 物理隔离（防旁路攻击）
② 沙箱：渲染进程无系统权限 —— 就算被攻破也摸不到磁盘网络
③ 同源策略：【同一进程内】不同源之间的数据隔离 —— 逻辑隔离（防的是「合法能力被滥用」）
```

SOP 防的威胁模型：**恶意页面 + 你已有的登录态**——它不防病毒，防的是「你的身份被别人的代码冒用」。

### 三、被 SOP「卡住」的日常清单 ⭐

```js
// ① 跨源接口：CORS 报错（响应被扣）→ 解法：CORS 头 / 代理（network-007）
// ② iframe 通信：contentWindow.document 拒绝访问
iframe.contentWindow.postMessage(msg, targetOrigin);   // ✅ 合法通道
window.addEventListener('message', (e) => {
  if (e.origin !== 'https://trusted.com') return;      // ⭐ 校验来源
  // e.data
});
// ③ Canvas 读取跨源图片：crossOrigin="anonymous" + 服务器 CORS 头
// ④ Cookie 并非完全按「源」隔离：SameSite 管【跨站】携带（站点=注册域，比源粗）
```

### 四、SOP 的「官方豁免通道」一览 ⭐

| 通道 | 用途 |
|---|---|
| CORS（响应头放行） | 跨源接口读取的标准正门 |
| postMessage | 跨窗口/iframe 通信 |
| JSONP（script 标签） | 历史 hack，GET-only |
| WebSocket | 不受 SOP 约束（有自己的鉴权） |
| 公共资源加载 | img/script/link 媒体类 |

## 回看开篇

思想实验的链路断在哪：evil.com 的 `fetch` 请求**确实发出去了**、Cookie **确实带上了**、银行**确实返回了余额**——但**浏览器在最后一步扣下响应**，evil.com 的 JS 读不到内容（除非银行响应带 `Access-Control-Allow-Origin: https://evil.com`——显然不会）。SOP 拦的不是枪响，是**把战利品带回敌方营地**的那一步。

## 实战延伸

**1. 面试答题骨架**：「同源指协议、域名、端口完全一致；SOP 是浏览器对跨源数据读取的隔离机制——请求可以发出、响应能到达，但没有 CORS 放行头时浏览器扣下响应内容；同时隔离跨源 DOM、iframe 文档与按源隔离的存储。它防的威胁是恶意页面滥用用户已有登录态，与进程隔离、沙箱构成三层防线；合法跨源通道有 CORS、postMessage、WebSocket，历史方案 JSONP 已淘汰。」

**2. 快手判断**：`https://music.a.com` 页面里请求 `https://www.a.com/api` ——跨源（域名不同）；要共享子域 Cookie 靠 `Domain=a.com`（Cookie 的域放宽规则，《network-008》）——**Cookie 的「域」与 SOP 的「源」是两套粒度**。

## 图解总结

```
源 = 协议 + 域名 + 端口（全同才同源）

evil.com 的 JS ──fetch──▶ bank.com（Cookie 自动带，请求到达）
                         ◀── 200 响应（数据回来了）
        ┌── 浏览器 SOP 检查：无 CORS 放行头 ──▶ ❌ 扣下响应，抛 CORS 错
        ▼ （有的放行才放行 JS 读取）

拦「读」不拦「发」： DOM/iframe 读取 ✘ │ 存储（按源隔离）✘ │ script/img 加载 ✓（但不可读）
豁免通道： CORS 正门 │ postMessage 消息 │ WebSocket │ 历史JSONP
三层防线： 进程隔离 ─ 沙箱 ─ 同源策略
```

## 总结

- 源 = 协议+域名+端口；缺一即跨源；
- SOP 拦「读取」不拦「发出」——CORS 错误时请求已成功、响应被扣；
- 同时隔离：跨源 DOM、iframe 文档、按源隔离的存储；媒体标签可加载不可读；
- 合法通道：CORS、postMessage（要校验 origin）、WebSocket；
- 与进程隔离、沙箱构成浏览器三层安全防线。

**面试一句话回答**：同源是指协议、域名与端口完全相同，三者任一不同即跨源；同源策略是浏览器对跨源数据读取的隔离机制——跨源请求可以发出、Cookie 会正常携带、服务器也会响应，但若响应缺少 CORS 放行头，浏览器会扣下响应内容使脚本无法读取；它同样禁止读取跨源的 iframe 文档与 DOM，并且存储按源隔离，而 img、script 等标签可以加载跨源资源但脚本不能读取其内容。它与进程隔离、沙箱共同构成浏览器安全的三层防线，防的是恶意页面滥用用户已有身份，合法的跨源通道包括 CORS、postMessage 与 WebSocket。

## 思考题

1. SOP 能防住「evil.com 用 form 提交转账请求到 bank.com」吗？该谁防？（引出 CSRF 与 SameSite，《security-002》）
2. 为什么 `new Image().src='https://other.com/x'` 可以用于跨站打点上报？（「能发不能读」的正面应用）
3. iframe 嵌入同源页面 vs 跨源页面：`contentWindow.document` 的行为差异？跨源时有哪些有限访问（location 只写、postMessage 可用）？
4. 开放讨论：微前端把不同团队的子应用聚到一个页面——SOP 对架构选型（同域部署 vs iframe vs 代理）的约束有哪些？

（思考题解析将同步录入小程序题库，关联本文 id：browser-basic-005）

## 参考文献：

- MDN — [浏览器的同源策略](https://developer.mozilla.org/zh-CN/docs/Web/Security/Same-origin_policy)
- web.dev — Same-origin policy（官方解读）
- 本课程《network-007 跨域 CORS》《security-002 CSRF》（两条延伸线）
