---
id: handwritten-012
title: 手写 LRU 缓存
series: 手写源码系列
seriesId: handwritten
stage: expert
difficulty: 4
tags: [LRU, 缓存, Map 有序性, 双向链表, LeetCode 146]
readingTime: 18
prev: handwritten-011
next: null
createdAt: 2026-10-26
---

# 手写 LRU 缓存

## 从「一次缓存引发的内存事故」说起

给接口响应加缓存：

```js
const cache = new Map();
function getData(key) {
  if (!cache.has(key)) cache.set(key, expensive(key));
  return cache.get(key);
}
// 一个月后线上告警：内存持续增长直到页面崩溃
// —— 缓存只进不出，key 无限增长（《js-deep-005 闭包》篇埋过的雷）
```

解法是给缓存加**容量上限 + 淘汰策略**：满了删谁？最合理的启发式是 **LRU（Least Recently Used，最近最少使用）**——「很久没人用的数据，大概率以后也不会用」。⭐⭐ LRU 是 LeetCode 146，也是手写题里「数据结构味」最浓的一道——Map 一行版与链表 O(1) 版，两版都要求会。

## 现象与直觉解释

LRU 缓存的行为语义：

```
LRUCache(2)            // 容量 2
put('a', 1)            // {a}
put('b', 2)            // {a, b}
get('a')    → 1        // a 变成「最近使用」：{b, a}
put('c', 3)            // 容量满！淘汰最久未用的 b：{a, c}
get('b')    → -1       // b 已被淘汰
```

**核心约束：get 与 put 都要 O(1)**。这决定了数据结构的选型——「查询快」和「有序可调整」两个需求要同时满足。

## 深入原理：两个版本

### 版本一：Map 有序性版（30 行，面试首选）⭐⭐

《es6-007》的伏笔：**Map 保持键的插入顺序**——而「删除再插入」会刷新到末尾。这个特性刚好映射 LRU：

```
「最近使用」= Map 中靠后的键
get/put 命中 → delete + set（重插刷新顺序）
容量超限    → 删 first key（Map 迭代器的第一个 = 最久未用）
```

```js
class LRUCache {
  #map = new Map();
  #capacity;

  constructor(capacity = 16) {
    if (!(capacity > 0)) throw new Error('capacity must be positive');
    this.#capacity = capacity;
  }

  get(key) {
    if (!this.#map.has(key)) return -1;

    const value = this.#map.get(key);
    this.#map.delete(key);       // ⭐ 刷新顺序的关键两步
    this.#map.set(key, value);   //    重插到「最新」位置
    return value;
  }

  put(key, value) {
    if (this.#map.has(key)) this.#map.delete(key); // 已存在：先删（刷新顺序）
    else if (this.#map.size >= this.#capacity) {
      // 淘汰最旧：迭代器的第一个键
      const oldest = this.#map.keys().next().value;
      this.#map.delete(oldest);
    }
    this.#map.set(key, value);
  }

  get size() { return this.#map.size; }
}

// 验证（对照行为语义那五步）
const c = new LRUCache(2);
c.put('a', 1); c.put('b', 2);
c.get('a');   // 1
c.put('c', 3); // 淘汰 b
c.get('b');   // -1
```

**复杂度**：get/put 均 O(1)（Map 的哈希查找 + 增删均为均摊 O(1)）——依赖宿主实现，面试说「借助 Map 的哈希与有序性」即可。

### 版本二：哈希表 + 双向链表（白板手写版）⭐⭐

「Map 版是调 API，链表版才是数据结构功力」——LeetCode 146 追求的原始形态：**哈希表负责查得到 O(1)，双向链表负责顺序可 O(1) 调整**。

```js
class Node {
  constructor(key, value) {
    this.key = key;         // 淘汰时要从哈希表反向删除，节点必须存 key
    this.value = value;
    this.prev = null;
    this.next = null;
  }
}

class LRUCache2 {
  #capacity;
  #map = new Map();          // key → Node
  // 两个哨兵：头尾虚拟节点，免去大量边界判断 ⭐
  #head = new Node(null, null);
  #tail = new Node(null, null);

  constructor(capacity) {
    this.#capacity = capacity;
    this.#head.next = this.#tail;
    this.#tail.prev = this.#head;
  }

  // ── 链表三操作（O(1)）──
  #remove(node) {                 // 摘下任意节点
    node.prev.next = node.next;
    node.next.prev = node.prev;
  }
  #addToFront(node) {             // 插到 head 之后（最新区）
    node.next = this.#head.next;
    node.prev = this.#head;
    this.#head.next.prev = node;
    this.#head.next = node;
  }

  get(key) {
    const node = this.#map.get(key);
    if (!node) return -1;
    this.#remove(node);           // 移动 = 摘下 + 插到最前
    this.#addToFront(node);
    return node.value;
  }

  put(key, value) {
    let node = this.#map.get(key);
    if (node) {                   // 已存在：更新值 + 移动
      node.value = value;
      this.#remove(node);
      this.#addToFront(node);
      return;
    }
    if (this.#map.size >= this.#capacity) {
      const lru = this.#tail.prev;        // 尾部哨兵前一个 = 最久未用
      this.#remove(lru);
      this.#map.delete(lru.key);          // ⭐ 反向清理哈希表（所以 Node 要存 key）
    }
    node = new Node(key, value);
    this.#map.set(key, node);
    this.#addToFront(node);
  }
}
```

三个设计要点（追问点）：

1. **为什么双向链表**：摘除任意节点需要「前驱指针」——单链表做不到 O(1) 摘中间节点；
2. **为什么哨兵节点**：head/tail 虚拟节点让「空链表」「删到只剩一个」不再需要特判；
3. **为什么 Node 存 key**：淘汰链尾时要从哈希表同步删掉条目——没有 key 就无法反向定位。

<figure style="margin:2.2em 0">
<svg viewBox="0 0 720 320" width="100%" role="img" aria-label="LRU：哈希定位与双向链表序联动">
  <defs>
    <marker id="lru-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#B03A2E"/>
    </marker>
    <marker id="lru-ink" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#1C1A17"/>
    </marker>
    <path id="lru-fly" d="M 150 108 H 340 C 380 108 370 92 330 92 L 316 92" fill="none"/>
  </defs>
  <text x="140" y="28" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13.5" font-weight="700" fill="#6E675A">Map：key → Node（哈希定位）</text>
  <text x="470" y="28" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13.5" font-weight="700" fill="#6E675A">双向链表：head ⇄ 最新 ⇄ … ⇄ 最旧 ⇄ tail</text>
  <rect x="40" y="44" width="200" height="190" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.5"/>
  <line x1="40" y1="86" x2="240" y2="86" stroke="#1C1A17" stroke-width="1"/>
  <line x1="40" y1="130" x2="240" y2="130" stroke="#1C1A17" stroke-width="1"/>
  <line x1="40" y1="174" x2="240" y2="174" stroke="#1C1A17" stroke-width="1"/>
  <text x="70" y="72" font-family="JetBrains Mono,monospace" font-size="12" fill="#B03A2E">'a' →</text>
  <text x="70" y="116" font-family="JetBrains Mono,monospace" font-size="12" fill="#1C1A17">'b' →</text>
  <text x="70" y="160" font-family="JetBrains Mono,monospace" font-size="12" fill="#1C1A17">'c' →</text>
  <circle cx="196" cy="68" r="5" fill="#B03A2E"/>
  <circle cx="196" cy="112" r="5" fill="#1C1A17"/>
  <circle cx="196" cy="156" r="5" fill="#1C1A17"/>
  <rect x="264" y="76" width="60" height="40" rx="6" fill="#FBF8F1" stroke="#1C1A17" stroke-width="1.4"/>
  <text x="294" y="101" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12" fill="#1C1A17">head</text>
  <rect x="352" y="76" width="86" height="40" rx="6" fill="#FBF8F1" stroke="#B03A2E" stroke-width="2"/>
  <text x="395" y="95" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12.5" font-weight="700" fill="#1C1A17">a（最新）</text>
  <text x="395" y="111" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9.5" fill="#6E675A">value: v1</text>
  <rect x="462" y="76" width="86" height="40" rx="6" fill="#FBF8F1" stroke="#1C1A17" stroke-width="1.4"/>
  <text x="505" y="95" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12.5" fill="#1C1A17">b</text>
  <text x="505" y="111" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9.5" fill="#6E675A">value: v2</text>
  <rect x="572" y="76" width="86" height="40" rx="6" fill="#EFE8D8" stroke="#6E675A" stroke-width="1.4" stroke-dasharray="5 4"/>
  <text x="615" y="95" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12.5" fill="#6E675A">c（最旧）</text>
  <rect x="676" y="76" width="40" height="40" rx="6" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.4"/>
  <text x="696" y="101" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="11" fill="#6E675A">tail</text>
  <path d="M 340 96 H 352" stroke="#1C1A17" stroke-width="1.4" marker-end="url(#lru-ink)"/>
  <path d="M 438 96 H 462" stroke="#1C1A17" stroke-width="1.4" marker-end="url(#lru-ink)"/>
  <path d="M 548 96 H 572" stroke="#1C1A17" stroke-width="1.4" marker-end="url(#lru-ink)"/>
  <path d="M 658 96 H 676" stroke="#1C1A17" stroke-width="1.4" marker-end="url(#lru-ink)"/>
  <circle r="5.5" fill="#B03A2E">
    <animateMotion dur="3s" repeatCount="indefinite" path="M 150 108 H 340 C 380 108 372 96 395 96"/>
  </circle>
  <text x="196" y="286" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12.5" fill="#B03A2E">① 哈希定位（O(1)）</text>
  <text x="470" y="286" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12.5" fill="#B03A2E">② 摘除 → 头插刷新「最近」</text>
  <text x="640" y="148" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12" fill="#B03A2E">③ 容量满 →</text>
  <text x="640" y="168" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12" fill="#B03A2E">淘汰 tail.prev 并反向删表项</text>
</svg>
<figcaption style="font-family:'Noto Sans SC',sans-serif;font-size:13px;color:#6E675A;text-align:center;margin-top:10px">图 · LRU 的两件套——哈希表管「找得到」，双向链表管「排得动」；红点走完一次 get('a') 的完整旅程</figcaption>
</figure>

### 两版对比与选型

| | Map 版 | 哈希+双向链表版 |
|---|---|---|
| 代码量 | ~30 行 | ~70 行 |
| 复杂度 | 均摊 O(1) | 严格 O(1)（自己实现） |
| 考察点 | Map 有序性的理解 | 数据结构功底 |
| 生产使用 | ✅ 完全够用 | 手写 HTTP 缓存/框架内部（避免 Map 开销时） |

**面试策略**：先写 Map 版（快而稳），主动补一句「严格 O(1) 与白板版是哈希+双向链表，哨兵+存 key 是两个关键设计」——展示层次。

## 回看开篇

无上限缓存 → 容量上限 + LRU 淘汰：

```js
const cache = new LRUCache(100);          // 上限 100 条
function getData(key) {
  let v = cache.get(key);
  if (v === -1) { v = expensive(key); cache.put(key, v); }
  return v;
}
// 内存有界、热点数据自动留任、冷数据自动出局
```

真实系统里它是 HTTP 缓存、CDN 边缘节点、Redis `maxmemory-policy allkeys-lru`、浏览器内存缓存的共同底座——同一个思想从手写题贯穿到分布式系统。

## 实战延伸

**1. 变体速答**：LFU（按访问频次淘汰，两个 HashMap + 频次链表）；TTL+LRU 混合（过期优先、容量兜底）；**immutable 考点**：get 的对象引用返回后外部修改会污染缓存——存时深拷贝或返回冻结对象。

**2. 与 WeakMap 的搭配**：缓存 key 为对象且允许「对象死了缓存自动消」时用 WeakMap——但它无序无 size，做不了 LRU，只能做「无上限的随缘缓存」（《es6-007》的选型判据重现）。

## 图解总结

```
Map 版：
  get/put 命中 ── delete+set 重插 ──▶ 「靠后 = 越新」
  容量超限 ── keys().next().value ──▶ 删第一个（最旧）

链表版：
  head ⇄ [最新] ⇄ … ⇄ [最旧] ⇄ tail      （⇄ 双向指针；head/tail 为哨兵）
  哈希表: key → Node（查 O(1)）
  命中: remove(node) + addToFront(node)
  淘汰: tail.prev 摘除 + map.delete(node.key) ⭐反向清理
```

## 总结

- LRU 语义：容量满淘汰最久未使用；get/put 都要 O(1)；
- Map 版：插入序 + 删除重插刷新顺序 + 首键淘汰，30 行解决 90% 场景；
- 链表版：哈希表查 + 双向链表序，三要点——双向（O(1) 摘除）、哨兵（免边界）、Node 存 key（反向清理）；
- 生产意义：一切「容量有界的记忆」的通用底座；
- 变体：LFU、TTL 混合、不可变缓存值。

**面试一句话回答**：LRU 缓存要求 get 与 put 都是 O(1)——用 Map 实现时利用其保持插入序的特性，命中时先 delete 再 set 把键刷新到末尾表示最新，容量超限时删除 keys 迭代器的第一个即最久未用项；严格版用哈希表定位加双向链表维护顺序，节点摘除与头插都是 O(1)，并借助头尾哨兵消除边界特判、在节点中保存 key 以便淘汰尾节点时反向删除哈希表条目——它是浏览器缓存、CDN 与 Redis 淘汰策略的共同底座。

## 思考题

1. 给 Map 版加 `getLruKey()` 与 `touchAll()` 之外的扩展：`peek(key)`（查看但不刷新顺序）——为什么 Map 版做不到 O(1) 的 peek？（它必须刷新才能维持序）
2. 实现 `TTLCache(capacity, defaultTtl)`：get 时惰性过期 + LRU 兜底——过期条目在 put 超限时如何顺带清理？
3. 链表版如何支持 `O(1)` 的 `getKthRecent(k)`（第 k 新的键）？（提示：从 head 走 k 步——那 get 呢？）
4. 开放设计：前端图片缓存用 LRU——key 是 URL、value 是 blob，容量限制用「条数」还是「字节」更合理？字节版的淘汰策略要怎么改（提示：不满足整除时的连续淘汰）？

（思考题解析将同步录入小程序题库，关联本文 id：handwritten-012）

## 参考文献：

- LeetCode 146. LRU Cache（本题原典，Follow up 就是双向链表版）
- 《算法（第 4 版）》链表章节（哨兵模式的经典论述）
- 本课程《es6-007 Set 与 Map》《v8-005 内存管理与垃圾回收》
