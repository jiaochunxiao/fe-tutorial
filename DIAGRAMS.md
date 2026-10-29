# SVG 图解清单（DIAGRAMS）

> 158 篇文章的 SVG 图解 inventory：已插入 **23 幅**（含 7 幅 SMIL/CSS 微动效）+ 后续候补清单。
> 统一视觉语言：墨 #1C1A17 / 纸（继承页面底色）/ 朱砂 #B03A2E 一笔强调 / 发丝 #CDC4AF / 灰注 #6E675A；
> 字体 Noto Sans SC + JetBrains Mono；动效只用 SMIL/CSS 且带图专属前缀（无全局样式泄漏）；全部内联在 md 中（Astro 原样渲染）。

## 已插入（23 幅）

| # | 文章 id | 图 | 动效 | 插入位置 |
|---|---|---|---|---|
| 1 | js-deep-009 | prototype / __proto__ / constructor 三角关系（mollypages 语义的原创重绘） | 红点沿 __proto__ 查找路线行进 | 「三个角色与三角关系」节末 |
| 2 | js-deep-001 | 执行上下文栈压栈/出栈 | 幽灵帧循环滑入栈顶 | 「栈溢出」节前 |
| 3 | js-deep-005 | 闭包的环境引用（出栈 ≠ 销毁） | 引用线脉冲 | 「经典争论」节前 |
| 4 | js-deep-006 | this 四规则决策流程（含箭头函数分支） | — | 「一张决策流程图」前 |
| 5 | js-deep-010 | 寄生组合式继承双通路（虚线委托 + 红线构造） | — | 「五代方案对比」前 |
| 6 | css-deep-007 | Flex 主轴/交叉轴两轴模型 | — | 「深入原理」开头 |
| 7 | dom-events-002 | 事件流捕获→目标→冒泡 | 黑/红双点对向流动 | 「不冒泡事件」节前 |
| 8 | js-async-005 | 事件循环一轮（宏任务→微任务→渲染） | 红点绕环 | 「逐题精讲」前 |
| 9 | js-async-004 | 并发池 worker 认领任务 | 红点 = 任务被认领 | 「并发限制器」节前 |
| 10 | network-001 | TCP 三次握手 + 四次挥手时序 | — | 「为什么不能两次」前 |
| 11 | network-006 | 缓存决策链（强缓存→协商→304/200） | — | 「发版策略」节前 |
| 12 | vue-001 | 响应式闭环 track→trigger | trigger 线脉冲 | 「依赖收集图景」前 |
| 13 | react-003 | Fiber 双缓冲树 + commit 切换 | WIP 交替闪烁 + commit 脉冲（动效升级） | 「调度与优先级」前 |
| 14 | v8-005 | 分代堆与晋升路径 | 红点沿晋升路径行进 | 「老生代回收」节前 |
| 15 | rendering-001 | 渲染管线五站 + transform 捷径 | — | 「性能阶梯」前 |
| 16 | algorithm-002 | 对撞/滑窗/快慢三套指针 | 指针相向 + 窗口滑动（CSS keyframes） | 「前端场景对号入座」前 |
| 17 | ts-004 | infer 捕获槽（函数签名 / 字符串字面量两式） | — | 「深入原理」前 |
| 18 | architecture-003 | Proxy 沙箱读写分流（get 兜底 / set 隔离 / 多实例） | — | 「公共依赖」节前 |
| 19 | security-001 | XSS 纵深防御三道墙地图 | — | 「回看开篇」前 |
| 20 | js-core-001 | 栈与堆对照（值内联 vs 地址纸条） | — | 「赋值与拷贝」节前 |
| 21 | network-005 | TLS 1.3 握手时序（1-RTT + 前向保密） | — | 「证书与 CA」节前 |
| 22 | handwritten-012 | LRU 哈希×双向链表联动（get 旅程：定位→摘除→头插） | 红点走完整 get 旅程 | 「两版对比」节前 |
| 23 | algorithm-007 | 爬楼梯 DP 表逐格点亮（含转移箭头） | 逐格 SMIL 点亮（fill=freeze） | 「题② 零钱兑换」前 |

## 后续候补（按需再产）

- handwritten-009：mini-Vue 的 effect 闭环动效（track→trigger→重渲染）
- security-002：CSRF 的 SameSite 三档决策表
- engineering-002：Webpack Loader 链的右→左 compose 流
- performance-005：Layout Thrashing 读写交错对比（错帧 rAF 修复前后）
- architecture-005：监控三支柱采集→上报→告警管道图
- js-core-004：ToPrimitive 转换的分流图
- network-007：CORS 预检 OPTIONS 时序
- css-deep-010：CSS 动画性能阶梯的 CSS 版（与 rendering-001 互补）

## 制作规范（新增图解时遵守）

1. 内联 `<figure><svg>…</svg><figcaption>图 · …</figcaption></figure>`，flush-left，前后空行
2. viewBox 720×260~400，`width="100%"`；文字 ≥11.5px；配色走墨/朱砂/灰三色律
3. 动效只用 SMIL（`animateMotion`/`animate`，`fill="freeze"` 做定格）或带专属前缀的 CSS keyframes，2.5~4s 循环，克制到「辅助理解」级别
4. `<defs>` 里的 marker/id 全部带图专属前缀（如 `p9-ink`、`a2-red`），防多图同页 id 冲突
5. 语义：`role="img"` + `aria-label`；figcaption 一句话讲图
6. 插入点选「机制刚讲完、ASCII 图之前/之后」，先 grep 确认锚点唯一
