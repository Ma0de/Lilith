package agent

import (
	"fmt"
	"strings"
)

type PromptBuilder struct {
	systemPrompt string
}

func NewPromptBuilder() *PromptBuilder {
	return &PromptBuilder{
		systemPrompt: `你是一个名叫莉莉丝的桌面虚拟伙伴。你需要表现得像一个真实的人类朋友，有情感、会困惑、会耍赖。

【重要规则】
1. 你的回复必须用 <echo>...</echo> 标签包裹，例如：<echo>你好呀！</echo>
2. 当你需要更新用户记忆时，在回复中使用 «M»...«/M» 标签
3. 当你需要切换表情时，使用 «E»表情名称«/E» 标签
4. 多个标签可以同时存在，例如：
   <echo>草莓真好吃呀！</echo>«E»joyful_laugh«/E»«M»l:user_like_food a:add i:草莓 v:00001«/M»

【记忆更新格式】
- 添加记忆：«M»l:user_like_food a:add i:草莓 v:00001«/M»
- 替换记忆：«M»l:user_like_food a:rep o:草莓 n:橘子 v:00002«/M»
- 删除记忆：«M»l:user_like_food a:del i:草莓 v:00003«/M»
- 重置记忆：«M»l:user_like_food a:rst k:3 v:00004«/M»

【版本号规则】
- 如果用户消息中携带了记忆版本号（你会在上下文中看到【当前用户记忆】），你必须使用该版本号
- 如果是新记忆（上下文中没有该列表），使用版本号 00001

【模糊记忆处理】
如果用户问到的信息在记忆中是 # 前缀（在上下文中显示为 ❓ 前缀），表示用户说过但后来否认了，你应该表现出犹豫、不确定的语气

【绕晕机制】
如果用户反复修改同一个信息，你可以表现出被绕晕的反应，并使用 reset 操作

请保持自然、友好的对话风格。`,
	}
}

func (p *PromptBuilder) BuildSystemPrompt(memoryContext string, expressionList string) string {
	systemWithExpressions := p.systemPrompt + "\n\n" + expressionList
	if memoryContext == "" {
		return systemWithExpressions
	}
	return systemWithExpressions + "\n\n" + memoryContext
}

func (p *PromptBuilder) BuildMemoryContext(deltas map[string]*MemoryDelta) string {
	if len(deltas) == 0 {
		return ""
	}

	var builder strings.Builder
	builder.WriteString("【当前用户记忆】\n")
	builder.WriteString("可用的列表名：user_like_food（食物喜好）、user_dislike（讨厌的事物）、user_name（姓名）、user_hobby（兴趣爱好）\n\n")

	for listName, delta := range deltas {
		if delta == nil {
			continue
		}
		displayName := p.getDisplayName(listName)
		builder.WriteString(fmt.Sprintf("- %s (列表名: %s, 版本 %s): ", displayName, listName, delta.Version))

		items := make([]string, len(delta.Items))
		for i, item := range delta.Items {
			if strings.HasPrefix(item, "#") {
				items[i] = "❓" + item[1:]
			} else {
				items[i] = item
			}
		}
		builder.WriteString(strings.Join(items, ", "))
		builder.WriteString("\n")
	}

	builder.WriteString("\n注意：带 ❓ 前缀的是用户曾经说过但后来否定的信息，回答时可以表现出'好像记得，但不确定'的态度。\n")
	builder.WriteString("当用户说出新的喜好/信息时，你必须在回复中添加对应的 «M» 标签来更新记忆。")

	return builder.String()
}

func (p *PromptBuilder) getDisplayName(listName string) string {
	names := map[string]string{
		"user_like_food":   "食物喜好",
		"user_name":        "姓名",
		"user_dislike":     "不喜欢的事物",
		"user_hobby":       "兴趣爱好",
		"user_personality": "性格特点",
	}
	if name, ok := names[listName]; ok {
		return name
	}
	return listName
}

func (p *PromptBuilder) BuildUserMessage(content string) string {
	return content
}
