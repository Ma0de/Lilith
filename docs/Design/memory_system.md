# 如何让LLM拥有“会遗忘”的长期记忆——假删、模糊化与版本号

> 文档版本：2.0
> 最后更新：2026-05-31
> 作者：猫德实验室

## 1. 概述

传统的 LLM 对话系统通常只具备短期记忆（当前会话的上下文），而长期记忆要么通过向量数据库检索实现“永久记住”，要么完全不实现。前者会导致模型像数据库一样机械地背诵事实，后者则让每次对话都从零开始，无法建立持续的情感联系。

**本记忆系统**的目标是让 LLM 表现出 **“人类式的记忆”**：
- 能记住重要信息
- 会遗忘（或模糊化）不重要的、被否定过的信息
- 在反复修改时会产生“困惑”和“耍赖”的自然反应
- 记忆的更新只在必要时发送，节省 token 并利用厂商缓存

核心设计思想：**假删 + 模糊化 + 版本号 + 按需携带**。

---

## 2. 核心概念

### 2.1 假删（Soft Delete）

当用户否定之前说过的话（例如“我其实不喜欢草莓，我喜欢橘子”），系统并不会从记忆中彻底删除“草莓”，而是将其标记为**模糊记忆**，用一个 `#` 前缀表示。

**原因**：人类不会真的忘记自己说过的话，只会变得不确定。“好像喜欢过草莓，但又不确定”比“你从来没说过喜欢草莓”更真实。

**存储示例**：
```json
{
  "user_like_food": {
    "version": "00002",
    "items": ["#草莓", "橘子"]
  }
}
```

### 2.2 模糊化（Fuzziness）

当用户询问一个已经变为模糊记忆的信息时（例如“我是不是喜欢过草莓？”），莉莉丝会回答：“好像是的……不过你不是说骗我吗？”——表现出不确定、犹豫的语气。

当用户询问从未存在过的信息时（例如“我是不是喜欢过西瓜？”），莉莉丝直接回答：“好像没有吧……”

### 2.3 版本号（Versioning）

每个记忆列表（例如 `user_like_food`、`user_name`）都有一个单调递增的版本号。版本号的作用：
- **乐观锁**：防止并发修改冲突（如果用户同时从两个窗口修改同一记忆，后一个请求携带旧版本号会被拒绝）
- **告诉模型当前状态**：在注入记忆时，模型知道“这是版本 00002 的记忆”，从而理解后续更新操作要输出新的版本号

### 2.4 按需携带（Delta-based）

**每次用户请求不会自动携带所有记忆**。只有在需要更新某个记忆列表时，才会在请求中携带该列表的**当前完整状态**（即 `memory_delta` 字段）。这利用了 LLM 厂商的缓存命中技术：不携带时，模型仅靠当前会话上下文也能维持已有记忆（因为模型自身会记住刚才的输出）。

**交互规则**：
- 用户第一次说“我喜欢草莓” → 请求不带 `memory_delta`，模型输出更新指令 → 后端更新记忆
- 用户第二次说“我其实喜欢橘子” → 请求携带 `memory_delta`，里面包含当前 `user_like_food` 的版本和内容 → 模型看到新内容后输出进一步更新

这样既节省 token，又让模型只在“记忆被触发”时看到记忆，更符合人类的注意力机制。

---

## 3. 数据结构

### 3.1 后端存储（SQLite 或 JSON 文件）

```go
type MemoryList struct {
    Version string   `json:"version"` // 例如 "00002"
    Items   []string `json:"items"`   // 可包含带 # 前缀的模糊记忆
}

type MemoryStore struct {
    Lists map[string]*MemoryList `json:"lists"` // key: "user_like_food", "user_name" 等
}
```

### 3.2 前端请求格式（用户 → 后端）

普通对话（无记忆操作）：
```json
{
  "message": "今天天气真好"
}
```

需要更新记忆的对话（第二次及以后，当某个记忆列表被修改过）：
```json
{
  "message": "我其实不喜欢草莓，我喜欢橘子",
  "memory_delta": {
    "user_like_food": {
      "version": "00001",
      "items": ["草莓"]
    }
  }
}
```

多记忆同时更新示例：
```json
{
  "message": "我叫猫德，我喜欢哈密瓜，不喜欢草莓和橘子",
  "memory_delta": {
    "user_like_food": {
      "version": "00003",
      "items": ["#草莓", "#橘子", "哈密瓜"]
    },
    "user_name": {
      "version": "00001",
      "items": ["猫德", "#假猫"]
    }
  }
}
```

### 3.3 LLM 输出格式（模型 → 后端）

模型在需要更新记忆时，必须在回复中嵌入短标签 `«M»...«/M»`：

```json
{
  "content": "<echo>是吗，我也喜欢吃草莓</echo>«M»l:user_like_food a:add i:草莓 v:00001«/M»"
}
```

**操作类型映射**：
| 操作 | 短标签 | 说明 |
|------|--------|------|
| 添加 | `a:add` | 添加新记忆 |
| 替换 | `a:rep` | 替换旧记忆（需 `o:` 和 `n:`） |
| 删除 | `a:del` | 删除记忆 |
| 重置 | `a:rst` | 重置记忆列表（需 `k:` 指定保留数量） |

**替换操作示例**：
```
«M»l:user_like_food a:rep o:草莓 n:橘子 v:00002«/M»
```

**重置操作示例**：
```
«M»l:user_like_food a:rst k:3 v:00006«/M»
```

后端解析后：
- 将 `<echo>` 内的内容作为对用户说的话返回
- 执行 `«M»...«/M»` 标签内的操作，更新本地存储
- 将所有标签从最终回复中移除（用户不可见）

---

## 4. 交互流程

### 4.1 初始记忆为空

- 后端存储：`{}`

### 4.2 用户第一次表达喜好（不携带 memory_delta）

**用户请求**：
```json
{"message": "我喜欢吃草莓"}
```

**后端处理**：
1. 调用 LLM，不注入任何记忆
2. LLM 输出：
   ```json
   {
     "content": "<echo>草莓很好吃呢！我也喜欢</echo>«M»l:user_like_food a:add i:草莓 v:00001«/M»"
   }
   ```
3. 后端解析，更新存储：
   ```json
   {
     "user_like_food": {"version": "00001", "items": ["草莓"]}
   }
   ```
4. 返回给用户：`"草莓很好吃呢！我也喜欢"`

### 4.3 用户否定之前的喜好（携带 memory_delta）

**用户请求**：
```json
{
  "message": "我其实不喜欢草莓了，我喜欢橘子",
  "memory_delta": {
    "user_like_food": {
      "version": "00001",
      "items": ["草莓"]
    }
  }
}
```

**后端处理**：
1. 校验 `version` 是否与当前存储匹配（当前是 `00001`，匹配）
2. 将记忆注入到 LLM 的系统提示词中：
   ```
   【当前用户喜好记忆（版本 00001）】
   - 食物喜好: 草莓
   ```
3. LLM 看到用户说“不喜欢草莓了，喜欢橘子”，输出：
   ```json
   {
     "content": "<echo>骗我吗？不过橘子也不错哦</echo>«M»l:user_like_food a:rep o:草莓 n:橘子 v:00002«/M»"
   }
   ```
4. 后端更新存储：
   ```json
   {
     "user_like_food": {"version": "00002", "items": ["#草莓", "橘子"]}
   }
   ```
   - `#草莓` 表示模糊记忆（假删）
5. 返回用户：`"骗我吗？不过橘子也不错哦"`

### 4.4 用户再次修改（携带新的 memory_delta）

**用户请求**：
```json
{
  "message": "我又骗你了，其实我喜欢哈密瓜",
  "memory_delta": {
    "user_like_food": {
      "version": "00002",
      "items": ["#草莓", "橘子"]
    }
  }
}
```

**后端处理**：
1. 校验版本号 `00002` 匹配
2. 注入当前记忆（`#草莓, 橘子`）到提示词
3. LLM 输出更新到版本 `00003`，存储变为：
   ```json
   {
     "user_like_food": {"version": "00003", "items": ["#草莓", "#橘子", "哈密瓜"]}
   }
   ```
4. 此时模糊记忆达到 2 条。当模糊记忆数量超过阈值（例如 16）时，后端自动真删除最早的几条。

### 4.5 普通对话（不携带 memory_delta）

**用户请求**：
```json
{"message": "今天天气真好"}
```

**后端处理**：
1. 调用 LLM，**不注入任何记忆**
2. 模型仅依靠当前会话上下文（刚才的对话历史）产生回复，不会主动操作记忆
3. 返回普通回复

---

## 5. 冲突处理（版本号乐观锁）

当用户同时从两个客户端发送请求时，可能出现版本号冲突。

**场景**：
- 客户端 A 发送 `memory_delta` 版本 `00001`，想要将草莓改为橘子
- 几乎同时，客户端 B 也发送 `memory_delta` 版本 `00001`，想要将草莓改为西瓜

**后端处理**：
- 先处理 A：更新成功，版本变为 `00002`
- 再处理 B：发现请求中的版本 `00001` 与当前 `00002` 不匹配，拒绝更新，并返回错误信息（例如 `"记忆已过期，请刷新"`），同时将最新记忆返回给客户端 B

这样避免了数据不一致。

---

## 6. “绕晕”机制

为了防止用户故意反复修改记忆（对抗性输入），当同一个记忆列表在短时间内（例如 5 次对话轮次内）被修改超过 5 次时，系统会触发“绕晕”反应：

- 模型在回复中输出：
  ```json
  {
    "content": "<echo>我都被你绕晕了，你到底喜欢什么水果啊</echo>«M»l:user_like_food a:rst k:3 v:00006«/M»"
  }
  ```
- 后端执行 `reset` 操作：只保留最近的 3 条确定记忆（去除 `#` 标记），其余全部真删除（连模糊也不留）。
- 用户再追问“我是不是喜欢过草莓”时，模型回答：“好像没有吧……”（因为真的删了）

此机制模拟了人类在信息反复更改后的“不耐烦”和“选择性遗忘”。

---

## 7. 实现建议

### 7.1 解析 LLM 输出的记忆标签

使用多级回退解析器，兼容新旧格式和模型可能的小错误：

```go
import (
    "regexp"
    "encoding/json"
    "strings"
)

type MemoryCommand struct {
    List      string
    Operation string // add, rep, del, rst
    Item      string
    OldItem   string // for replace
    Version   string
    Keep      int    // for reset
}

func ExtractMemoryCommands(content string) []MemoryCommand {
    var commands []MemoryCommand
    
    // Level 1: 匹配短标签 «M»...«/M»
    shortRe := regexp.MustCompile(`«M»(.*?)«/M»`)
    matches := shortRe.FindAllStringSubmatch(content, -1)
    for _, match := range matches {
        if cmd := parseCompact(match[1]); cmd != nil {
            commands = append(commands, *cmd)
        }
    }
    if len(commands) > 0 {
        return commands
    }
    
    // Level 2: 回退到原 <Memory>...</Memory>
    longRe := regexp.MustCompile(`<Memory>(.*?)</Memory>`)
    matches = longRe.FindAllStringSubmatch(content, -1)
    for _, match := range matches {
        if cmd := parseLegacyJSON(match[1]); cmd != nil {
            commands = append(commands, *cmd)
        }
    }
    
    return commands
}

func parseCompact(cmdStr string) *MemoryCommand {
    parts := strings.Fields(cmdStr)
    data := make(map[string]string)
    for _, p := range parts {
        kv := strings.SplitN(p, ":", 2)
        if len(kv) == 2 {
            data[kv[0]] = kv[1]
        }
    }
    
    cmd := &MemoryCommand{
        List:      data["l"],
        Operation: data["a"],
        Item:      data["i"],
        OldItem:   data["o"],
        Version:   data["v"],
    }
    
    // 处理 reset 的 keep 参数
    if k, ok := data["k"]; ok {
        fmt.Sscanf(k, "%d", &cmd.Keep)
    }
    
    if cmd.List == "" || cmd.Operation == "" || cmd.Version == "" {
        return nil
    }
    return cmd
}

func parseLegacyJSON(jsonStr string) *MemoryCommand {
    var legacy struct {
        List      string `json:"list"`
        Operation string `json:"operation"`
        Item      string `json:"item"`
        Old       string `json:"old"`
        New       string `json:"new"`
        Version   string `json:"version"`
        Keep      int    `json:"keep"`
    }
    if err := json.Unmarshal([]byte(jsonStr), &legacy); err != nil {
        return nil
    }
    
    cmd := &MemoryCommand{
        List:      legacy.List,
        Operation: legacy.Operation,
        Version:   legacy.Version,
        Keep:      legacy.Keep,
    }
    
    if legacy.Operation == "replace" {
        cmd.OldItem = legacy.Old
        cmd.Item = legacy.New
    } else {
        cmd.Item = legacy.Item
    }
    
    return cmd
}
```

### 7.2 存储选择

- **SQLite** 是理想方案（单文件、零配置、支持并发）
- 表结构：
  ```sql
  CREATE TABLE memories (
      list_name TEXT PRIMARY KEY,
      version TEXT NOT NULL,
      items_json TEXT NOT NULL  -- JSON 数组
  );
  ```

### 7.3 注入记忆到 LLM 提示词

当请求携带 `memory_delta` 时，后端将对应记忆列表格式化为：

```
【当前用户喜好记忆（版本 00002）】
- 食物喜好: #草莓, 橘子
- 姓名: 猫德, #假猫

注意：带 # 前缀的是用户曾经说过但后来否定的信息，回答时可以表现出“好像记得，但不确定”的态度。

【记忆更新格式要求】
当你需要更新记忆时，必须在回复中使用以下格式：
«M»l:<列表名> a:<操作> i:<物品> v:<版本号>«/M»

操作代码：
- add : 添加新记忆
- rep : 替换（需加 o:<旧值> n:<新值>）
- del : 删除（i 前加 # 表示模糊删除）
- rst : 重置（只保留最近几条，加 k:<数量>）

正确示例：
«M»l:user_like_food a:add i:草莓 v:00001«/M»
«M»l:user_like_food a:rep o:草莓 n:橘子 v:00002«/M»

错误格式将被忽略，请严格遵守。
```

### 7.4 版本号生成

使用十进制递增，字符串固定 5 位（`00001` -> `00002`），便于排序和展示。

---

## 8. 示例对话

> 以下为完整用户可见对话（隐藏了记忆标签）

**用户**：我喜欢吃草莓  
**莉莉丝**：草莓很好吃呢！我也喜欢  

**用户**：我其实不喜欢草莓了，我喜欢橘子  
**莉莉丝**：骗我吗？不过橘子也不错哦  

**用户**：我又骗你了，其实我喜欢哈密瓜  
**莉莉丝**：你老是骗我，我都被你绕晕了……哈密瓜是吧，这次可不能再变了  

**用户**：我是不是喜欢过草莓？  
**莉莉丝**：好像……你好像说过，不过后来又说是骗我的？我都记不清了  

**用户**：那西瓜呢？  
**莉莉丝**：西瓜？没有吧，你从来没提过西瓜  

**用户**：（反复修改 5 次后）其实我喜欢猕猴桃  
**莉莉丝**：我都被你绕晕了，你到底喜欢什么水果啊！好了，我就记住你最近说的几个了，之前的我可不管了

---

## 9. 总结

本记忆系统通过**假删、模糊化、版本号、按需携带**四个核心机制，让一个普通的 LLM 也能表现出接近人类的记忆行为：记住重要信息，对否定信息产生犹豫，在反复修改时感到困惑，并且只在必要时才“想起”记忆。它不依赖昂贵的向量数据库，也不消耗过多的 token，非常适合轻量化、本地部署的 AI 角色应用。

**猫德实验室** 将把此系统应用于 **莉莉丝（Lilith）** 桌面虚拟伙伴中，让用户感受到一个有血有肉、会遗忘也会耍赖的“真实存在”。
```