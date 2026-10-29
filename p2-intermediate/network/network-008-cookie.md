---
id: network-008
title: 网络与浏览器之 Cookie 深入
series: 网络与浏览器系列
seriesId: network
stage: intermediate
difficulty: 3
tags: [Cookie, SameSite, HttpOnly, Secure, 会话管理]
readingTime: 20
prev: network-007
next: network-009
createdAt: 2026-10-26
---

# 网络与浏览器之 Cookie 深入

## 从「用户突然全被登出」说起

一次安全加固上线后，客服炸了：大量用户反馈「一打开网站就是未登录」。代码零改动，只是给 Cookie 多加了一个属性——`SameSite`。

这不是玄学：Cookie 的每个属性都在回答「**什么时候、通过什么通道、允许谁读取**」这一组问题，属性组合错一个，认证链路就断。⭐⭐ Cookie 属性与 SameSite 是「网络安全 + 浏览器机制」的交叉考点。

## 现象与直觉解释

Cookie 是**服务器存在浏览器里、之后每次请求自动携带**的小段数据——HTTP 是无状态协议，Cookie 是给它「记忆」的补丁：

```
① 登录成功，服务器下发：
   Set-Cookie: sid=abc123; Path=/; HttpOnly; Secure; SameSite=Lax
② 之后对该站点的每个请求，浏览器自动带：
   Cookie: sid=abc123          ← 「自动带」就是全部魔法：无需 JS 参与
```

与 localStorage 的本质区别正在「**自动随请求携带**」——Storage 是纯本地仓库，永远不会自己出现在请求头里。会话类数据用 Cookie（要自动携带），偏好类数据用 Storage（要容量与 API）。

## 深入原理

### 一、属性全景：一张「生命与边界」清单 ⭐⭐

| 属性 | 管什么 | 关键值 |
|---|---|---|
| `Expires` / `Max-Age` | **寿命** | 不设 = 会话 Cookie（关浏览器就没）；`Max-Age` 优先于 `Expires` |
| `Domain` | **哪些域名可见** | 默认只当前域；`Domain=a.com` 则 `a.com` 及全部子域可见（**放宽**） |
| `Path` | **哪些路径可见** | `Path=/user` 只在该路径前缀的请求带（作用有限，别拿来当权限） |
| `Secure` | **传输通道** | 仅 HTTPS 发送 |
| `HttpOnly` | **读取权限** | **JS 读不到**（document.cookie 无此条）——防 XSS 窃取 ⭐ |
| `SameSite` | **跨站携带策略** | `Strict` / `Lax` / `None`（防 CSRF 的第一道闸，《security-002》） |

### 二、SameSite 三档详解（开篇事故的元凶）⭐⭐

「跨站（cross-site）」判定：A 页面发起请求到 B——两者是否同一家（同注册域 + 顶级域方案，eTLD+1）。

```
Strict：跨站请求一律不带 —— 最安全，体验最糙
  从别的网站点链接进来，第一次请求都不带 Cookie → 看起来「未登录」

Lax（现代浏览器默认值）：折中 —— 顶级导航的 GET（点链接进来）允许带，
  其余跨站（子资源请求、iframe、POST 表单）不带 ✅ 大多数站点的合理默认

None：跨站都带 —— 必须同时 Secure；适配「第三方 Cookie」场景
  （如支付回调域、嵌入式组件）；同时也是 CSRF 敞开的口子
```

开篇事故还原：加了 `SameSite=Strict` 后，用户从搜索引擎/外链进入站点，首个请求不带 Cookie，被判定未登录——**改 `Lax` 即恢复**。而 Chrome 推动「第三方 Cookie 退场」的多年计划（影响 `SameSite=None` 的跨站追踪场景）历经多次反复，2024 年起转向「用户可选择的方案」——知道这条时间线即可，别赌具体日期。

### 三、两个高频机制细节 ⭐

**1. Cookie 的「越域」规则**：只能设置**当前域或父域**的 Cookie（不能设给别的网站——那是安全底线）；子域可覆盖同名 Cookie 造成「同名遮蔽」，排障时 DevTools → Application → Cookies 里按域看。

**2. Cookie 数量与大小限制**：单条 ~4KB、单域约 50 条（各家实现有差异）——把大状态塞 Cookie 既超限又让**每个请求都变重**（它是请求头！）。状态大了换 token + 服务端存储，或分片方案。

### 四、会话管理的两种现代姿势

**姿势 A：Session Cookie（服务端会话）**

```
Set-Cookie: sid=abc123; HttpOnly; Secure; SameSite=Lax
服务端：sid → 用户表的映射（内存/Redis）
```

**姿势 B：Token（如 JWT）**——状态放客户端，请求头 `Authorization: Bearer xxx` 携带。

对比（面试常考）：

| 维度 | Cookie+Session | Token |
|---|---|---|
| 携带方式 | 浏览器自动 | 前端手动设置头 |
| XSS 窃取风险 | HttpOnly 可挡 ⭐ | 存 storage 必然可被 JS 读到 |
| CSRF 风险 | 有（靠 SameSite 防御） | 天然无（不自动携带） |
| 服务端状态 | 有（可随时踢人下线） | 无（吊销要额外机制） |
| 跨域/移动端/小程序 | Cookie 三件套配置繁琐 | 头部传递天然顺手 |

结论不是二选一：**Web 端「HttpOnly Cookie + SameSite」仍是安全上限最高的组合**；多端（App/小程序）场景 token 更现实。

## 回看开篇

「全部登出」= `SameSite=Strict` 拦掉了跨站进入的首个请求。Cookie 的六个属性各自把守一道边界：寿命（Expires/Max-Age）、可见域（Domain/Path）、通道（Secure）、读取（HttpOnly）、跨站（SameSite）——**改任何一个属性，都要先画出「用户的登录链路会经过哪些边界」**。

## 实战延伸

**1. 亲手检查认证链路**：DevTools → Application → Cookies → 逐条核对：`HttpOnly` 有没有（XSS 面）、`Secure` 有没有、`SameSite` 是什么档（CSRF 面）、`Domain/Path` 是否意外放宽。

**2. 「登录了但接口 401」排障三连**：① Cookie 带上了吗（Network → 请求头）② 带的是「哪个域」的 Cookie（同名遮蔽）③ 跨站场景 SameSite 档位是否拦截。

**3. 安全基线一句话**：`Set-Cookie: sid=…; HttpOnly; Secure; SameSite=Lax`——这三个开关是所有会话 Cookie 的起配线，缺一个就多一类攻击面（XSS / 明文嗅探 / CSRF）。

## 图解总结

```
Set-Cookie 的六道边界
┌─────────────────────────────────────────────┐
│ 寿命   Expires / Max-Age（不设=会话级）        │
│ 可见   Domain（父域放宽） / Path               │
│ 通道   Secure（仅 HTTPS）                     │
│ 读取   HttpOnly（JS 不可读 → XSS 拿不走）      │
│ 跨站   SameSite: Strict | Lax(默认) | None    │
│         （None 必须 + Secure → 第三方场景）    │
└─────────────────────────────────────────────┘
        请求来时：浏览器按「域匹配 + 路径匹配 + SameSite 放行」自动携带
```

## 总结

- Cookie 的本质是「随请求自动携带的服务器下发数据」，这是它与 localStorage 的分水岭；
- 六组属性六道边界：寿命、可见域、路径、通道、读取权、跨站策略；
- SameSite 三档：Strict（最严）、Lax（默认、合理）、None（跨站带，必须 Secure，CSRF 面）；
- HttpOnly 是 XSS 下保护会话的关键；安全基线三件套：HttpOnly + Secure + SameSite；
- Cookie+Session 与 Token 各有攻防面：HttpOnly 挡 XSS、无状态 token 免 CSRF 但难吊销。

**面试一句话回答**：Cookie 是服务器通过 Set-Cookie 下发、浏览器按域匹配在后续请求中自动携带的状态机制——Expires/Max-Age 管寿命、Domain/Path 管可见范围、Secure 限制仅 HTTPS 传输、HttpOnly 禁止 JavaScript 读取以防 XSS 窃取、SameSite 控制跨站携带以防 CSRF（Strict 全禁、Lax 放行顶级导航 GET 为现代默认、None 需配 Secure 用于跨站场景）；与会话存储相比它可被 HttpOnly 保护但自动携带带来 CSRF 面，与 token 相比它防 XSS 但难做跨端与无状态扩展。

## 思考题

1. `SameSite=Lax` 下，从邮件链接点进网站的 GET 首页带 Cookie 吗？在该页面上由 JS 发起的跨站 POST 呢？
2. XSS 攻击者能在设置了 HttpOnly 的站点偷到什么、偷不到什么？（提示：偷不到 Cookie，但能以你身份发请求——为什么这就够了？）
3. 为什么「Path=/admin 的 Cookie」不能当作权限控制？（提示：Path 只影响「是否携带」，想想谁能伪造请求）
4. 开放设计：多端产品（Web + App + 小程序）的统一认证怎么设计？哪些端用 Cookie、哪些端用 token、网关层如何兼容两者？

（思考题解析将同步录入小程序题库，关联本文 id：network-008）

## 参考文献：

- RFC 6265bis — Cookies: HTTP State Management Mechanism（现行修订版）
- MDN — [Set-Cookie](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Headers/Set-Cookie)、[HTTP cookies](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Cookies)
- 本系列《security-001 XSS》《security-002 CSRF》（两个攻击面的专篇）
