---
id: security-003
title: 前端安全之点击劫持与防御
series: 前端安全系列
seriesId: security
stage: expert
difficulty: 4
tags: [点击劫持, Clickjacking, X-Frame-Options, frame-ancestors, 透明iframe]
readingTime: 14
prev: security-002
next: security-004
createdAt: 2026-10-26
---

# 前端安全之点击劫持与防御

## 从「你以为在点抽奖，其实在点转账确认」说起

```
evil.com 的页面:
  ┌─────────────────────────────┐
  │  🎁 大转盘抽奖（可见层）        │   ← 用户看到的
  │  ┌─────────────────────────┐│
  │  │ bank.com/transfer(透明)  ││   ← 嵌入的银行页 iframe，opacity:0
  │  │   [确认转账] 按钮恰好     ││      与"抽奖"按钮位置重叠
  │  │   叠在"立即抽奖"下方       ││
  │  └─────────────────────────┘│
  └─────────────────────────────┘
用户点"立即抽奖" → 实际点击穿透到透明 iframe 的[确认转账] 💥
（银行页带着用户的 Cookie 加载 —— 一次"合法"的转账确认）
```

⭐⭐ 点击劫持（Clickjacking）：**攻击者的页面把你的页面"套壳隐藏"，诱导用户在不知情下操作你的页面**——不偷凭证、不注代码，借的是「用户的真实点击 + 浏览器的合法嵌套」。

## 现象与直觉解释

攻击成立的三个条件：

```
① 你的页面能被 iframe 嵌套（无防御头）
② 关键操作是"点一下"就能触发（且登录态在 Cookie 里自动生效）
③ 攻击者能让 iframe 透明 + 与诱导内容重叠（CSS 一行 opacity:0）
```

变体家族速览：

```
经典型: 透明覆盖钓鱼（如上）
拖拽型: 诱导拖拽滑块 → 拖进隐藏 iframe 的输入框（窃取选中内容）
遮照型: 只露出目标页的一小块（输入框逐字符窃取 —— 键盘记录的近亲）
```

## 深入原理：防御的两行配置 ⭐⭐⭐

攻击条件的①是全部要害——**禁止被嵌套，攻击即刻瓦解**：

```
方案A: X-Frame-Options（老牌响应头）
  X-Frame-Options: DENY           // 任何页面都不许嵌我
  X-Frame-Options: SAMEORIGIN     // 仅同源可嵌 ⭐ 常用

方案B: CSP frame-ancestors（现代，功能更强）⭐
  Content-Security-Policy: frame-ancestors 'self' https://partner.com;
  // 优势: 支持【多来源白名单】（XFO 做不到）+ 表达力（self/uri）
  // 与 CSP 其他指令一次下发 —— 一个头管所有安全策略

（旧的 JS 反框架代码 if (top !== window) top.location = self.location
  —— 历史遗迹: 有绕过手法(限制导航的 sandbox iframe)且体验差，已不推荐 ⭐）
```

### 配套防御：两层加码 ⭐❄

```
① 关键操作的"非点击依赖":
   转汇款/改密码 → 二次输入(密码/验证码) —— 点击劫持偷不走"输入"
② sandbox iframe（当你必须嵌别人时）:
   <iframe src="untrusted" sandbox="allow-scripts">
   // 不给 allow-same-origin/allow-top-navigation —— 嵌入物拿不到你的一切
   // （反向利用: 微前端/三方组件的安全边界 —— architecture-003 的安全注脚）
```

### 哪些页面该配？⭐⭐

```
默认全站配 frame-ancestors 'self' —— 这应是「安全基线」而非个案 ⭐
例外放行: 需要被合作伙伴嵌入的页（支付回调/微前端子应用）→ 白名单精确列出
自查: curl -I https://your-site.com | grep -i frame —— 十秒体检
```

## 回看开篇

抽奖转盘的把戏依赖「银行页可被 evil.com 嵌套」——`frame-ancestors 'self'` 一行让 evil 的 iframe 直接渲染失败（透明套壳不存在了）；即便个别老页面漏配，转账的二次密码输入挡住最后一击。**点击劫持的防御成本低到惊人（一行头），却常年出现在安全扫描的高危项里——因为「没人想到要配」**。

## 实战延伸

**1. 面试答题骨架**：「点击劫持是攻击页把目标站以透明 iframe 嵌套并与诱导按钮重叠，借用户真实点击和自动携带的 Cookie 完成敏感操作。防御核心是禁止被嵌套——老牌的 X-Frame-Options 支持 DENY 与 SAMEORIGIN，现代首选 CSP 的 frame-ancestors 支持多来源白名单且能与其他 CSP 指令合并下发；全站默认配置 self、确需被嵌的页面精确白名单。辅助手段是关键操作加二次输入使单纯点击无效，以及嵌入第三方内容时用 sandbox iframe 收权。」

**2. 一道判断题**：「我的接口有 CSRF Token，还怕点击劫持吗？」——怕：点击劫持不伪造请求，用户在真页面上的真点击（token 就在真页面里，会带上）——**防的是"点击能直达"的危险性**，两病两药。

## 图解总结

```
攻击: 透明iframe套壳 + 按钮重叠 → 用户真点击你的真页面（凭证齐全）
条件: 可被嵌套 │ 点击直达敏感操作 │ Cookie自动生效

防御:
 一行头(核心): frame-ancestors 'self' [白名单]（现代）
              X-Frame-Options: DENY/SAMEORIGIN（老牌）
 加码: 敏感操作二次输入 │ 嵌别人时 sandbox 收权
基线: 全站默认配 —— curl -I 十秒自查
与CSRF区别: 不伪造请求，借真点击 —— CSRF防御不覆盖它 ⚠️
```

## 总结

- 点击劫持 = 透明嵌套 + 诱导点击，借真页面真凭证；
- 防御核心一行头：frame-ancestors（现代、支持白名单）> X-Frame-Options；
- 全站默认配置，白名单例外；
- 二次输入让「点击直达」失效；sandbox 管住嵌入的第三方；
- 与 CSRF 正交：不伪造请求，防不住的维度不同。

**面试一句话回答**：点击劫持的攻击原理是攻击者页面将目标网站以透明 iframe 的形式嵌入，并把诱导按钮与目标页的敏感操作按钮位置重叠，用户在不知情下的真实点击穿透到目标页面，配合自动携带的 Cookie 完成转账等操作——它不注入脚本也不伪造请求，因此 CSRF 防御对它无效。防御的核心是一行响应头配置：现代首选 CSP 的 frame-ancestors 指令，声明只允许自身或白名单来源嵌套，比老牌的 X-Frame-Options 多来源白名单能力更强；全站应默认配置、确需被合作方嵌入的页面精确放行。辅助手段包括敏感操作增加二次输入使单次点击无法直达、以及自己嵌入第三方内容时用 sandbox 属性收权。

## 思考题

1. X-Frame-Options 在代理/CDN 层被剥掉的事故怎么防？（配置审计进 CI——响应头检查清单）
2. 微前端架构里「主应用嵌子应用」与点击劫持防御矛盾吗？（frame-ancestors 白名单精确放行自家域名；qiankun 的 DOM 挂载模式天然无 iframe——架构选型的安全红利）
3. 拖拽型劫持（drag-and-drop 窃取）为什么 JS 反框架防不住？（拖拽发生在浏览器层）——header 防御为什么有效？
4. 开放审计：给你负责的站点做十秒体检（curl -I 查三个安全头：CSP/XFO/HSTS），记录缺失项与补齐顺序。

（思考题解析将同步录入小程序题库，关联本文 id：security-003）

## 参考文献：

- OWASP — Clickjacking Defense Cheat Sheet
- MDN — X-Frame-Options / CSP frame-ancestors
- 本课程《security-001 CSP》《architecture-003 微前端》（嵌套与安全的交集）
