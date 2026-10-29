---
id: network-005
title: 网络与浏览器之 HTTPS：TLS 握手全过程
series: 网络与浏览器系列
seriesId: network
stage: intermediate
difficulty: 4
tags: [HTTPS, TLS, 证书, 非对称加密, 对称加密, 中间人攻击]
readingTime: 24
prev: network-004
next: network-006
createdAt: 2026-10-26
---

# 网络与浏览器之 HTTPS：TLS 握手全过程

## 从「咖啡馆 Wi-Fi 里的裸奔」说起

连上公共 Wi-Fi 打开一个 **HTTP** 网站：同一网络里的嗅探者可以**完整看到**你访问了什么、提交了什么（账号密码明文），甚至篡改响应内容（插广告、换下载链接）。

HTTPS 要对抗的正是这三件事：**窃听**（加密）、**篡改**（完整性校验）、**冒充**（身份认证）。⭐⭐ 「HTTPS 的握手过程」与「为什么既用非对称又用对称」是网络安全的必考题。

## 现象与直觉解释

HTTPS = HTTP + TLS：在 TCP 连接（已通线路，《network-001》）之上、HTTP 通信之前，插入一段「**先谈好怎么加密，再开始通信**」的 TLS 握手。

核心设计是一个精妙的分工：

> **非对称加密**（公钥/私钥）：安全但**慢**——只在握手阶段用，解决「密钥交换」和「身份认证」；
> **对称加密**（一把钥匙）：快——用非对称阶段商量出的**会话密钥**，加密后续所有数据。

一句话：**用贵的锁锁门一次，把便宜的钥匙留给日常**。

## 深入原理

### 一、TLS 1.3 握手全过程（现代主流）⭐⭐

```
客户端                                                     服务端
  │ ── ClientHello ──────────────────────────────────────▶ │
  │    支持的 TLS 版本/密码套件、随机数 Rc、                │
  │    (key_share: 客户端临时公钥)                          │
  │                                                        │
  │ ◀─ ServerHello ────────────────────────────────────── │  ① 选定套件 + 随机数 Rs + key_share
  │ ◀─ Certificate ────────────────────────────────────── │  ② 服务器证书（含公钥，由 CA 签发）
  │ ◀─ CertificateVerify ──────────────────────────────── │  ③ 用私钥签名证明「证书是我的」
  │ ◀─ Finished ───────────────────────────────────────── │  ④ 握手完成标记（带校验值）
  │ ── Finished ────────────────────────────────────────▶ │
  │                                                        │
  │ ═════ 双方各自算出相同的会话密钥，开始对称加密通信 ═══════ │
  │ ── Application Data（对称加密）─────────────────────▶ │
```

TLS 1.3 只需 **1 RTT**（ClientHello 发出时已带 key_share，双方基于各自随机数 + 对方公钥独立算出相同密钥——ECDHE 的数学魔法）。握手后的每条应用数据都带 **AEAD 认证标签**——改一个比特都会校验失败（防篡改）。

<figure style="margin:2.2em 0">
<svg viewBox="0 0 720 320" width="100%" role="img" aria-label="TLS 1.3 握手时序：1-RTT 建立加密通道">
  <defs>
    <marker id="t5-ink" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#1C1A17"/>
    </marker>
    <marker id="t5-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#B03A2E"/>
    </marker>
  </defs>
  <rect x="50" y="30" width="140" height="40" rx="6" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.6"/>
  <text x="120" y="55" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13" font-weight="700" fill="#1C1A17">客户端</text>
  <rect x="530" y="30" width="140" height="40" rx="6" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.6"/>
  <text x="600" y="55" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13" font-weight="700" fill="#1C1A17">服务器</text>
  <path d="M 120 70 V 286" stroke="#1C1A17" stroke-width="1.2"/>
  <path d="M 600 70 V 286" stroke="#1C1A17" stroke-width="1.2"/>
  <path d="M 120 96 H 596" stroke="#1C1A17" stroke-width="1.6" marker-end="url(#t5-ink)"/>
  <text x="358" y="88" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11" fill="#1C1A17">ClientHello：随机数 + 套件 + 临时公钥</text>
  <path d="M 600 130 H 124" stroke="#1C1A17" stroke-width="1.6" marker-end="url(#t5-ink)"/>
  <text x="358" y="122" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11" fill="#1C1A17">ServerHello + 证书 + 签名（私钥自证）</text>
  <rect x="120" y="150" width="480" height="44" rx="8" fill="#EFE8D8" stroke="#B03A2E" stroke-width="1.6"/>
  <text x="360" y="172" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12.5" font-weight="700" fill="#B03A2E">双方各自：ECDHE(我的私钥, 对方公钥) + 随机数 → 相同的会话密钥</text>
  <text x="360" y="190" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="11" fill="#6E675A">私钥从不传输 → 窃听者拿到全部报文也算不出 → 前向保密</text>
  <path d="M 120 236 H 596" stroke="#1C1A17" stroke-width="1.6" stroke-dasharray="8 5" marker-end="url(#t5-red)"/>
  <text x="358" y="228" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12" fill="#1C1A17">Finished（握手校验）→ 应用数据全用对称加密 + AEAD 完整性</text>
  <path d="M 70 96 H 84" stroke="#B03A2E" stroke-width="2"/>
  <path d="M 70 236 H 84" stroke="#B03A2E" stroke-width="2"/>
  <text x="60" y="170" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11" fill="#B03A2E">1-RTT</text>
</svg>
<figcaption style="font-family:'Noto Sans SC',sans-serif;font-size:13px;color:#6E675A;text-align:center;margin-top:10px">图 · TLS 1.3 握手——传输握手与密钥协商一步完成，会话密钥由双方各自推导、私钥从不上网</figcaption>
</figure>

### 二、证书与 CA：信任的传递链 ⭐

「公钥」谁都能生成，**怎么证明这个公钥真的属于这个网站？** 靠证书体系：

1. 服务器向 **CA（证书颁发机构）** 申请证书：CA 验证域名所有权后，用 **CA 的私钥**对「站点信息 + 站点公钥」签名，颁发证书；
2. 浏览器/操作系统内置了一批**根 CA 证书**（信任的起点）；
3. 握手时服务器出示证书，浏览器沿「根 CA → 中间 CA → 站点证书」**逐级验签**（用上级公钥解下级签名）——只要链条顶端可信，整条链可信。

```
根CA(Root, 内置系统) ──签发──▶ 中间CA ──签发──▶ 站点证书
   ▲ 你电脑里预装的信任锚                  浏览器逐级验签
```

**中间人攻击（MITM）为什么失败**：攻击者伪造证书 → 没有可信 CA 私钥签名 → 浏览器验签失败 → 著名的「您的连接不是私密连接」警告。⚠️ 但如果你**安装了来路不明的根证书**（某些抓包工具要求这么做），攻击者就能自签证书冒充任何网站——**公司内网抓包可以，个人设备千万别装陌生根证书**。

### 三、经典四问 ⭐

**问 1：为什么不全程用非对称加密？**
性能：非对称加密比对称慢 2~3 个数量级，TLS 只用它完成「安全地商量一把对称钥匙」，数据传输全用对称加密。

**问 2：会话密钥明明经过网络传输的随机数推导，为什么窃听者算不出来？**
因为用的是 **ECDHE（椭圆曲线 Diffie-Hellman 临时密钥交换）**：双方各自持有一个**从不发送**的临时私钥，交换的只是各自公钥；数学上「由公钥和对方参数推私钥」不可行（离散对数难题）。窃听者拿到全部往来报文也算不出密钥——这叫**前向保密**（Forward Secrecy）：即使将来服务器私钥泄露，历史流量也解不开（每次会话的临时密钥都不同且已销毁）。

**问 3：证书验证哪些东西？** ① 签名链条完整可信；② 域名匹配（CN/SAN）；③ 有效期内；④ 吊销状态（OCSP/CRL）。任一不过即告警。

**问 4：TLS 1.2 与 1.3 的差别？** 1.2 需 2 RTT、支持一堆弱套件（RSA 密钥交换没有前向保密）；1.3 砍到 1 RTT、强制前向保密套件、加密更多握手内容（连证书都是加密传输的——SNI 加密是 ECH 的持续演进）。

### 四、前端视角的 HTTPS 常识

1. **混合内容（Mixed Content）**：HTTPS 页面里加载 HTTP 资源——脚本类直接被浏览器**阻止**，图片类降级处理。迁移 HTTPS 站点的常见坑；
2. **HSTS**：响应头 `Strict-Transport-Security: max-age=...` 告诉浏览器「这个域名永远用 HTTPS」，防止降级劫持（关联《security-002》）；
3. **Charles/Fiddler 抓 HTTPS 的原理**：本机装它们的根证书 → 它们做「中间人」分别与两端握手——**本质上就是一次你亲手授权的 MITM**，这也是为什么测试机可以、用户设备绝不可以；
4. **性能影响已被抹平**：TLS 1.3 1-RTT、会话复用 0-RTT、QUIC 融合握手（《network-004》）——「HTTPS 慢」已是过时印象。

## 回看开篇

咖啡馆 Wi-Fi 场景的防御链：加密（对称密钥保护内容）+ 完整性（AEAD 标签防篡改）+ 认证（CA 证书链防冒充）。三者分别对应窃听、篡改、冒充三类威胁——HTTPS 不是「一个加密」，而是一套对抗矩阵。

## 实战延伸

**1. 亲手看握手**：DevTools → Security 面板能看到证书链、TLS 版本与套件；`openssl s_client -connect example.com:443` 输出更完整。

**2. 本地开发证书**：localhost 的 HTTPS 用 mkcert 生成本地信任的证书，比「忽略警告」安全得多。

**3. 面试答题骨架**：「HTTPS 在 TCP 之上先做 TLS 握手——客户端发 ClientHello（随机数+支持的套件+临时公钥），服务器回证书并用私钥签名自证；双方基于 ECDHE 各自算出会话密钥（私钥从不上网），之后全程对称加密 + AEAD 完整性校验。非对称只用于握手是因为慢；证书链由内置根 CA 逐级验签，挡住中间人；TLS 1.3 压缩到 1-RTT 并强制前向保密。」

## 图解总结

```
TCP 连接建立（《network-001》三次握手）
        │
        ▼
TLS 握手（1-RTT）
 ClientHello ──▶ [随机数Rc + 套件 + 临时公钥]
 ServerHello ◀── [随机数Rs + 选定套件 + 证书 + 临时公钥 + 签名]
     │                              │
     └── 双方各自：ECDHE(我的私钥, 对方公钥) + 随机数 ──▶ 相同的会话密钥
        │        （私钥从不传输 → 窃听者算不出 → 前向保密）
        ▼
应用数据：HTTP 报文 + 对称加密(AES-GCM) + 完整性标签
```

## 总结

- HTTPS = 加密（防窃听）+ 完整性（防篡改）+ 身份认证（防冒充）；
- 分工：非对称加密只用于握手（慢但解决密钥交换与身份），会话密钥对称加密所有数据（快）；
- ECDHE 双方私钥不上网 → 窃听者无法推钥 → 前向保密；
- 信任来自证书链：内置根 CA → 逐级验签 → 中间人伪造必败；
- TLS 1.3：1-RTT、强制前向保密；QUIC 更进一步融合握手。

**面试一句话回答**：HTTPS 在 TCP 之上先进行 TLS 握手——客户端发送随机数、支持的密码套件和临时公钥，服务器返回证书并用私钥签名自证身份，双方基于 ECDHE 各自用从不传输的私钥推导出相同的会话密钥，之后全部数据用对称加密并附完整性校验；非对称只在握手阶段使用因为性能慢两个数量级，信任由系统内置根 CA 对证书链逐级验签建立从而抵御中间人，TLS1.3 进一步把握手压缩到 1-RTT 并强制前向保密。

## 思考题

1. 为什么会话密钥的推导需要「客户端随机数 + 服务端随机数」两个？只有 ECDHE 结果行不行？（提示：思考随机数在防重放中的作用）
2. 「私钥泄露后，历史流量会被解开吗？」——分 RSA 密钥交换与 ECDHE 两种方案回答。
3. 抓包工具为什么必须先安装根证书？如果攻击者诱导用户安装了它的根证书，HTTPS 的哪一层防线被突破？
4. 开放分析：HTTPS 页面加载 HTTP 的图片为什么只是「降级警告」而 HTTP 的 script 直接被阻止？从两类资源的攻击面差异解释。

（思考题解析将同步录入小程序题库，关联本文 id：network-005）

## 参考文献

- RFC 8446 — TLS 1.3
- Cloudflare 博客 — A detailed look at RFC 8446（TLS1.3 图解）
- 《图解密码技术》第 10~14 章（对称/非对称/证书的密码学基础）
- MDN — [HTTP over TLS](https://developer.mozilla.org/zh-CN/docs/Web/Security/Transport_Layer_Security)
