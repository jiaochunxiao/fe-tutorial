---
id: network-006
title: 网络与浏览器之浏览器缓存：强缓存与协商缓存
series: 网络与浏览器系列
seriesId: network
stage: intermediate
difficulty: 3
tags: [强缓存, 协商缓存, Cache-Control, ETag, Last-Modified, 缓存决策链]
readingTime: 24
prev: network-005
next: network-007
createdAt: 2026-10-26
---

# 网络与浏览器之浏览器缓存：强缓存与协商缓存

## 从「发版后用户看到旧页面」说起

两个真实场景，同一个根源：

1. **周五发版，周一还有用户反馈「页面是旧的」**——旧的 HTML/JS 被浏览器缓存了；
2. **反过来**：静态资源明明没变，每次刷新都全量重新下载——白白烧流量、拖慢首屏。

一边是「缓存太顽固」，一边是「缓存不存在」——浏览器缓存的整套机制，就是在这两端之间做精确的**分级决策**。⭐⭐ 缓存是面试网络题的第一梯队，也是前端工程化（发版策略）的地基。

## 现象与直觉解释

直觉模型：浏览器对每个 URL 的请求先过一道「**缓存闸门**」，闸门分两级：

```
请求一个资源
   │
   ▼
① 强缓存（本地就能拍板）
   │ 命中（未过期）──▶ 直接用本地副本，连请求都不发 ✅（DevTools 显示 200 from cache）
   │ 未过期时间到
   ▼
② 协商缓存（问服务器拍板）
   │ 发请求带「指纹」──▶ 服务器：没变 → 304（用本地副本，无 body）
   │                    服务器：变了 → 200 + 新资源 + 新指纹
```

- **强缓存**：本地判断「过没过期」——省掉整个网络请求；
- **协商缓存**：本地过期后，带凭证问服务器「还能用吗」——省掉响应体（只回 304 空壳）。

## 深入原理

### 一、强缓存：两个头的一生 ⭐

**`Expires`（HTTP/1.0，元老）**：

```http
Expires: Wed, 28 Oct 2026 07:00:00 GMT
```

绝对时间——**致命伤是依赖客户端时钟**：用户电脑时间错乱，缓存判断全乱。已被 Cache-Control 取代（做兜底兼容）。

**`Cache-Control`（HTTP/1.1，现任）**：

```http
Cache-Control: max-age=31536000
```

相对秒数（从响应生成起算），不受客户端时钟影响。常用指令速查：

| 指令 | 含义 |
|---|---|
| `max-age=N` | N 秒内新鲜（强缓存期） |
| `no-cache` | **不是不缓存！** 是「每次使用前必须协商」（跳过强缓存走协商） |
| `no-store` | 真正的「完全不留缓存」（敏感数据） |
| `public / private` | 中间代理可否缓存（CDN vs 仅浏览器） |
| `s-maxage` | 共享缓存（CDN）专用的新鲜期，覆盖 max-age |
| `immutable` | 「永不变」标记——用户刷新时也不发起协商（配合永久 hash 文件名） |

**最高频辨析：`no-cache` vs `no-store`** ⭐⭐——`no-cache` 缓存但每次协商（304 仍可用），`no-store` 一个字节都不存。面试答错率极高。

**注意：强缓存命中时，地址栏回车/链接跳转会使用，但「普通刷新（Cmd+R）」会带 `max-age=0` 强制走协商，「强制刷新（Shift+Cmd+R）」直接禁用缓存**——解释了「为什么 F5 之后 Size 列变了」。

### 二、协商缓存：两对「指纹」⭐

**第一代：`Last-Modified` / `If-Modified-Since`**

```
首次响应:  Last-Modified: Mon, 26 Oct 2026 08:00:00 GMT   （服务器记录的修改时间）
再次请求:  If-Modified-Since: Mon, 26 Oct 2026 08:00:00 GMT（原样带上）
服务器:    没变 → 304 | 变了 → 200 + 新内容 + 新 Last-Modified
```

精度只有**秒级**的三个坑：① 1 秒内改两次识别不出；② 文件内容没变但时间戳变了（重新部署 touch）会误判「变了」；③ 某些服务器无法精确取修改时间。

**第二代：`ETag` / `If-None-Match`（优先级更高）**

```
首次响应:  ETag: "abc123"              （内容指纹，通常是内容的哈希）
再次请求:  If-None-Match: "abc123"
服务器:    相同 → 304 | 不同 → 200 + 新内容 + 新 ETag
```

按**内容**判变——时间戳的三个坑全部解决。**两对同时存在时，ETag 优先**（服务器先比 If-None-Match）。

### 三、完整决策链（面试的核心得分点）⭐⭐

把两级缓存、四个头串成一条链（DevTools → Network → 某请求的 Headers 面板可逐项对照）：

```
发起请求
  │
  ├─ 内存缓存（memory cache）──▶ 进程内存里的副本（会话级，脚本/图片，秒取）
  ├─ 磁盘缓存（disk cache）────▶ 强缓存的常驻形态（max-age 未过 → 直接用）
  │        │ 过期/命中 no-cache
  ▼        ▼
  发起 HTTP 请求（带 If-None-Match / If-Modified-Since）
  │
  ├─ 304 Not Modified ──▶ 复用本地副本（只省了 body）✅ 协商缓存命中
  └─ 200 + 新资源 ──────▶ 使用新副本，按响应头重新入库
```

补充两站：**Service Worker** 的可编程缓存排在 HTTP 缓存**之前**（PWA 的离线能力）；**CDN（共享缓存）** 挡在浏览器与源站之间（`s-maxage` 管它）。完整层次：Service Worker → memory → disk → 协商 → CDN → 源站。

<figure style="margin:2.2em 0">
<svg viewBox="0 0 720 320" width="100%" role="img" aria-label="浏览器缓存决策链">
  <defs>
    <marker id="cc6-ink" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#1C1A17"/>
    </marker>
    <marker id="cc6-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#B03A2E"/>
    </marker>
  </defs>
  <rect x="40" y="40" width="180" height="52" rx="10" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.6"/>
  <text x="130" y="62" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13" font-weight="700" fill="#1C1A17">发起请求</text>
  <text x="130" y="82" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="11.5" fill="#6E675A">浏览器要一个资源</text>
  <rect x="270" y="40" width="180" height="52" rx="10" fill="#FBF8F1" stroke="#1C1A17" stroke-width="1.6"/>
  <text x="360" y="62" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13" font-weight="700" fill="#1C1A17">强缓存检查</text>
  <text x="360" y="82" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10.5" fill="#6E675A">max-age 未过期？</text>
  <path d="M 220 66 H 264" stroke="#1C1A17" stroke-width="1.6" marker-end="url(#cc6-ink)"/>
  <text x="242" y="56" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12" fill="#1C1A17">命中</text>
  <rect x="270" y="106" width="180" height="44" rx="10" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.4" stroke-dasharray="6 4"/>
  <text x="360" y="133" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12.5" fill="#1C1A17">✓ 直接用副本，连请求都不发</text>
  <path d="M 360 92 V 170" stroke="#1C1A17" stroke-width="1.6" marker-end="url(#cc6-ink)"/>
  <text x="452" y="136" font-family="Noto Sans SC,sans-serif" font-size="12.5" fill="#6E675A">过期 / no-cache ↓</text>
  <rect x="270" y="172" width="180" height="52" rx="10" fill="#FBF8F1" stroke="#1C1A17" stroke-width="1.6"/>
  <text x="360" y="194" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13" font-weight="700" fill="#1C1A17">协商缓存</text>
  <text x="360" y="214" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10.5" fill="#6E675A">If-None-Match / If-Modified-Since</text>
  <path d="M 450 198 H 520" stroke="#1C1A17" stroke-width="1.6" marker-end="url(#cc6-ink)"/>
  <text x="485" y="188" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12" fill="#1C1A17">问服务器</text>
  <rect x="522" y="120" width="158" height="52" rx="10" fill="#FBF8F1" stroke="#1C1A17" stroke-width="1.6"/>
  <text x="601" y="142" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13" font-weight="700" fill="#1C1A17">未变 → 304</text>
  <text x="601" y="162" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="11.5" fill="#6E675A">复用本地副本（无 body）</text>
  <rect x="522" y="196" width="158" height="52" rx="10" fill="#FBF8F1" stroke="#B03A2E" stroke-width="1.6"/>
  <text x="601" y="218" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13" font-weight="700" fill="#B03A2E">变了 → 200 + 新资源</text>
  <text x="601" y="238" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="11.5" fill="#6E675A">新内容 + 新指纹入库</text>
  <path d="M 360 224 V 258 H 516" fill="none" stroke="#B03A2E" stroke-width="1.6" marker-end="url(#cc6-red)"/>
</svg>
<figcaption style="font-family:'Noto Sans SC',sans-serif;font-size:13px;color:#6E675A;text-align:center;margin-top:10px">图 · 缓存决策链——强缓存本地拍板，协商缓存带指纹问服务器，红框是唯一会重新下载的分支</figcaption>
</figure>

### 四、发版策略：缓存的工程正解 ⭐

「发版后旧页面」与「资源重复下载」的工业级解法——**HTML 不缓存 + 资源永久缓存 + 文件名带内容哈希**：

```http
# index.html —— 每次都要最新的（入口必须新鲜）
Cache-Control: no-cache

# app.a3f8c2.js —— 文件名 = 内容哈希，内容变 → 名字变 → 新 URL 无旧缓存问题
Cache-Control: public, max-age=31536000, immutable
```

原理闭环：HTML 永远协商（拿到最新入口）；JS/CSS 名字随内容变（改代码 → 哈希变 → 引用新文件 → 直接 200 拉新；没改 → 永久强缓存命中）。**这是 webpack/vite 产出 `app.[contenthash].js` 的深层原因**（关联《engineering-008 部署与缓存策略》）。

## 回看开篇

场景 1（旧页面）：HTML 被强缓存了——入口应 `no-cache`；场景 2（重复下载）：资源没配 `max-age` 或每次改代码都同名覆盖——应上内容哈希 + 长强缓存。**缓存不是配不配的问题，是给谁配什么等级的问题**。

## 实战延伸

**1. DevTools 三种 Size 标注**：`(memory cache)`、`(disk cache)`、`304`——分别对应决策链的第 1、2、4 站。

**2. 「为什么改了代码用户没看到更新」排障顺序**：① HTML 是否被强缓存（入口不新鲜）② 部署是否同名覆盖（哈希没生效）③ CDN 是否旧缓存（s-maxage 太长）④ 用户是否开了强刷仍旧（Service Worker 拦截）。

**3. 面试答题骨架**：「浏览器缓存分强缓存与协商缓存两级——强缓存由 Cache-Control 的 max-age（旧标准 Expires）控制，未过期直接用本地副本不发请求；过期或 no-cache 后进入协商缓存，带 If-None-Match(ETag) 或 If-Modified-Since(Last-Modified) 询问服务器，未变回 304 复用副本、变了回 200 给新资源，ETag 按内容判变且优先于时间戳。工程上 HTML 用 no-cache、带内容哈希的资源用 max-age 一年加 immutable，兼顾即时更新与永久缓存。」

## 图解总结

```
请求 ──▶ [Service Worker 可编程缓存]
              │未命中
              ▼
         [强缓存: memory/disk]  Cache-Control: max-age 未过?
              │命中→直接用(不发请求)          │过期/no-cache
              ▼
         [协商请求] ──▶ 服务器
              ◀── 304 (ETag/Last-Modified 未变 → 复用副本)
              ◀── 200 + 新资源 + 新指纹
```

## 总结

- 两级闸门：强缓存（本地拍板，不发请求，Cache-Control: max-age）→ 协商缓存（服务器拍板，发轻量请求，304 复用）；
- `no-cache`≠不缓存（是强制协商），`no-store` 才是彻底不存；
- 协商指纹两代：Last-Modified（秒级精度、时间戳陷阱）→ ETag（内容哈希、优先级更高）；
- 完整层次：Service Worker → memory → disk → 协商 → CDN → 源站；
- 工程正解：HTML no-cache + 资源内容哈希 + 长强缓存 immutable。

**面试一句话回答**：浏览器缓存分两级——强缓存通过 Cache-Control 的 max-age 在本地判断新鲜度，未过期直接使用副本不发任何请求；过期后进入协商缓存，请求携带 If-None-Match 或 If-Modified-Since，服务器比对 ETag 或 Last-Modified 后未变则返回 304 复用本地副本、变了返回 200 与新资源，ETag 基于内容所以优先于秒级精度的修改时间；注意 no-cache 是每次协商而非不缓存，no-store 才是不存储，工程上配合「HTML 不缓存、静态资源内容哈希命名加一年强缓存」实现发版即时生效。

## 思考题

1. 为什么 `no-cache` 的命名极具误导性？用一句话向团队新人解释它与 `no-store` 的区别。
2. 文件内容没变但 Last-Modified 变了（重新部署），会发生什么？ETag 会遇到同样问题吗？
3. 用户反馈「刚发的新版本还是旧的」，按缓存决策链列出你的排查顺序与每步的判断依据。
4. 开放设计：给「新闻首页（HTML）+ 图片 CDN + 用户头像 API」分别设计缓存策略（含 CDN 侧），并说明理由。

（思考题解析将同步录入小程序题库，关联本文 id：network-006）

## 参考文献

- RFC 9111 — HTTP Caching（现行缓存规范）
- MDN — [HTTP 缓存](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Caching)
- Chrome DevTools 文档 — Network 面板缓存行为说明
- 本系列《engineering-008 部署与缓存策略》（服务端与 CDN 侧的另一半）
