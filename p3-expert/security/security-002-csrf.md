---
id: security-002
title: 前端安全之 CSRF：SameSite 与 Token
series: 前端安全系列
seriesId: security
stage: expert
difficulty: 4
tags: [CSRF, SameSite, Token, 双重Cookie, 防御]
readingTime: 18
prev: security-001
next: security-003
createdAt: 2026-10-26
---

# 前端安全之 CSRF：SameSite 与 Token

## 从「你在看视频，你的账号悄悄发了帖」说起

```
你已经登录了 weibo.com（Cookie 里躺着会话）
你点开 evil.com 的一个链接，页面里有:
  <form action="https://weibo.com/post" method="POST">
    <input name="content" value="关注 evil 领福利">
  </form>
  <script>document.forms[0].submit();</script>
  
  // 表单跨站提交 weibo.com —— 浏览器【自动带上你的 Cookie】(Cookie 的默认行为)
  // weibo 收到一个"带着合法会话"的发帖请求 —— 分不清是你点的还是攻击者 forged 的 💥
```

⭐⭐⭐ CSRF（跨站请求伪造）的本质：**攻击者借你的 Cookie 当通行证**。与 XSS 的对比一句话：XSS 是「你的页面执行我的代码」，CSRF 是「我的页面发起你的请求」。

## 现象与直觉解释

CSRF 成立的三个条件（也是防御的三个打击点）：

```
① Cookie 自动携带（跨站请求也带）—— 这是攻击的"通行证"来源
② 关键操作可用「表单/简单请求」触发（GET 查询有副作用 / POST 无额外验证）
③ 服务器无法区分"用户本意"与"伪造请求"（两者在网络层一模一样 ⚠️）
```

## 深入原理

### 一、CSRF 的攻击面清单 ⭐⭐

```html
<!-- ① GET 型（最冤——查询接口有副作用） -->
<img src="https://bank.com/transfer?to=evil&amount=1000">

<!-- ② POST 表单型（开篇案例）—— 无需 JS，邮件/网页皆可 -->
<form action="…" method="POST">…</form>

<!-- ③ 深链接型（a 标签诱导点击） -->
<a href="https://app.com/delete/all">查看福利</a>

// ⚠️ 关键操作的"简单请求"都能被伪造 —— 但【预检请求】拦得住复杂请求:
// 带 Authorization 头 / application/json 的跨站请求 → 先 OPTIONS 预检（network-007）
// → evil.com 过不了预检 ✅ —— 这就是"自定义头"能防 CSRF 的原理
```

### 二、防御体系：四道关 ⭐⭐⭐

**第一关：SameSite Cookie（现代首选，浏览器原生）** ⭐⭐⭐

```
Set-Cookie: sid=xxx; SameSite=Lax; Secure; HttpOnly

Lax（默认值，2020+）: 跨站【子请求】(img/form POST) 不带 Cookie；
                      仅顶级导航的 GET 放行 —— 挡掉绝大多数 CSRF ✅
Strict: 一切跨站不带 —— 最安全，但外链进来"看着没登录"，体验差
None: 跨站都带（第三方场景）—— 必须 Secure + 通常仅支付回调用

「默认 Lax 已经消灭了传统 CSRF 的大半江山」—— 但不能只依赖它 ⭐
（老浏览器/特殊 None 配置/顶级 GET 导航型仍然暴露）
```

**第二关：CSRF Token（服务端状态的经典方案）** ⭐⭐⭐

```
原理: 给每个会话发一个【攻击者拿不到】的随机值，请求必须带上:
  ① 服务端渲染页面时埋 <input type="hidden" name="_csrf" value="r4nd0m…">
  ② 提交表单/请求时带上该值（header X-CSRF-Token）
  ③ 服务端校验 会话绑定的 token === 请求携带的
为什么有效: evil.com 能【发送】请求，但【拿不到】你页面的 token
  （token 在你的 DOM 里，跨站读不到 —— 同源策略 browser-basic-005 ⭐）
```

**第三关：双重 Cookie（无会话状态的变体）** ⭐⭐

```
① 登录时服务端 Set-Cookie: csrf=r4nd0m（非 HttpOnly）
② 前端 JS 读该 cookie → 每次请求放到自定义头 X-CSRF-Token: r4nd0m
③ 服务端比对 cookie 值 == header 值
原理: evil.com 能让浏览器带 cookie，但【读不到】cookie 内容（同源策略）→
     无法把它放进自定义头 —— 而带自定义头 = 复杂请求 = 还要过预检双保险 ⭐
```

**第四关：自定义请求头 + 预检（架构级）** ⭐⭐

```
团队规范: 所有写接口要求 Content-Type: application/json + 自定义头(X-Requested-With)
→ 跨站伪造必触发 CORS 预检 → evil.com 无 CORS 授权 → 预检失败 ✅
「把 CSRF 防御做进 API 设计约定」—— 一劳永逸的架构解 ⭐
```

### 三、与 XSS 的联动：CSRF 防不住 XSS ⭐⭐

```
如果站内已有 XSS（security-001 被攻破）:
  攻击脚本在你的域名下运行 —— 同源策略不设防
  → 读得到 CSRF token、cookie —— 一切 CSRF 防御归零 💥
结论: XSS 是万恶之源 —— 「先防住 XSS，CSRF 防御才有意义」（纵深防御的次序）
```

### 四、工程清单 ⭐⭐

```
□ 会话 Cookie: SameSite=Lax 起步（回调用 None+Secure 白名单）
□ 关键写操作: CSRF Token（服务端模板）或 双重Cookie（SPA）二选一
□ API 约定: 写接口 JSON + 自定义头（预检兜底）
□ GET 无副作用（REST 纪律也是安全纪律 ⭐）
□ 敏感操作二次验证（支付密码/短信——最后一道人的防线）
□ 测试: 用无痕窗口（无 Cookie）直接 curl 接口 —— 应被拒绝
```

## 回看开篇

「看视频被发帖」的攻击链断点：SameSite=Lax 让 evil.com 的跨站 POST **带不上 Cookie**（第一关）；即使带上了（None 配置），没有 CSRF Token 的请求被服务端拒绝（第二关）；即使 token 机制被绕过，application/json + 自定义头触发预检（第四关）——**三关全破才会失守**。

## 实战延伸

**1. 面试答题骨架**：「CSRF 是攻击者诱导浏览器向目标站发起跨站请求、自动携带用户 Cookie 从而冒充身份，与 XSS 的区别在于不注入代码只伪造请求。防御四道关——Cookie 设 SameSite=Lax 阻断跨站子请求携带凭证；会话绑定 CSRF Token，攻击者因同源策略拿不到 token 内容；双重 Cookie 变体让前端读 cookie 放入自定义头，配合自定义头触发 CORS 预检形成双保险；架构上约定写接口必须 JSON 加自定义头，使伪造请求必过预检。同时 GET 必须无副作用，敏感操作加二次验证，且前提是先防住 XSS——站内 XSS 能读到一切 token 使 CSRF 防御归零。」

**2. 一道对比题**：XSS 与 CSRF 各自的「信任滥用点」？（XSS 滥用「页面执行权」；CSRF 滥用「Cookie 自动携带」——修复点完全不同：转义 vs 不带凭证）。

## 图解总结

```
CSRF = 借你的Cookie当通行证（我的页面发起你的请求）
成立条件: Cookie跨站自动带 │ 简单请求可触发 │ 服务端无法辨真伪

四道关:
 ①SameSite=Lax(默认): 跨站子请求不带Cookie ⭐现代首选
   Strict(最严/体验差) │ None(+Secure, 仅第三方回调)
 ②CSRF Token: 会话绑定随机值 —— 攻击者读不到(同源策略) 
 ③双重Cookie: cookie值→自定义头 —— 读不到就放不进头
 ④架构约定: 写接口 JSON+自定义头 → 必过预检 → 无CORS授权即失败
GET无副作用 │ 敏感操作二次验证 │ XSS不破CSRF才有效(次序!)
```

## 总结

- CSRF 借 Cookie 冒充身份；三条件即攻击面；
- SameSite=Lax 是现代第一关（默认值已消灭大半）；
- Token/双重 Cookie 依赖同源策略「读不到」；
- 自定义头 + JSON 触发预检是架构级防线；
- GET 无副作用、二次验证；XSS 是上游——先防 XSS。

**面试一句话回答**：CSRF 跨站请求伪造的原理是攻击者页面诱导浏览器向目标站发起请求，浏览器自动携带用户的会话 Cookie，服务端收到的是带着合法凭证的请求而无法辨别真伪——它与 XSS 的区别是不需要注入代码、只是伪造请求。防御四道关：给会话 Cookie 设置 SameSite，Lax 级别默认阻断跨站子请求携带凭证；使用与会话绑定的 CSRF Token，攻击者因同源策略读不到 token 内容而无法伪造；双重 Cookie 方案让前端把 cookie 值放进自定义请求头、服务端比对，配合自定义头使跨站请求触发 CORS 预检形成双保险；架构约定所有写接口必须 application JSON 加自定义头，令伪造请求必然止步于预检。此外 GET 接口必须无副作用、敏感操作加二次验证，并牢记 XSS 是上游漏洞——站内一旦有 XSS，一切 token 都可被读取，CSRF 防御随之失效。

## 思考题

1. SameSite=Lax 下「顶级导航的 GET 放行」还能构造什么攻击？（GET 登出/GET 点赞类——GET 副作用的最后一击）
2. SPA 项目选 CSRF Token 还是双重 Cookie？（无服务端模板渲染 → 双重 Cookie 更顺；配合拦截器自动带头——handwritten-007 的落点）
3. CORS 配置 `Access-Control-Allow-Origin: *` 与凭证的关系？（* 与 credentials 互斥——network-007 安全条款的复习）
4. 开放讨论：JWT 存 localStorage 的方案天然免疫 CSRF 吗？（是——不自动携带；但引入 XSS 偷 token 的新风险——完整权衡 security-004 展开）。

（思考题解析将同步录入小程序题库，关联本文 id：security-002）

## 参考文献：

- OWASP — CSRF Prevention Cheat Sheet
- MDN — Set-Cookie 的 SameSite（network-008 联动）
- Google — SameSite 迁移指南（2020 浏览器变更的官方说明）
