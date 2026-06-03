package agent

func BuildExpressionList() string {
	return `【可用表情列表（共70+种）】
请根据对话情绪选择最匹配的表情：

calm_gentle - 平静温柔，嘴角带着微笑（默认表情）
pout_playful - 赌气、撒娇，嘴巴撅起
confident_laugh - 自信开朗的笑容
neutral_slight_upset - 无奈、轻叹
serious_deadpan - 严肃、面无表情
smug_playful - 得意、调侃的浅笑
joyful_laugh - 开心大笑，眼睛眯成月牙
peaceful_sleeping - 安睡、闭目养神
surprised_slight - 微微惊讶
gentle_smile_closed - 闭眼温柔的微笑
cheerful_laughing - 灿烂开朗的笑容
upset_whimper - 委屈、要哭的样子
blank_dazed - 发呆、失神
questioning - 质疑、反问（你确定吗？）
blush - 害羞、脸红
sweat - 尴尬、流汗
sweat_2 - 更尴尬、更多汗
confident_playful - 自信且玩味的表情
determined - 坚定、决心
worried_upset - 担忧、委屈
displeasure - 不悦、不爽
helpless_smile - 无奈又温柔的笑
tired_resigned - 疲惫无奈
bitter_smile - 苦笑
serious_displeased - 严肃不悦
intense_opposition - 强烈反对、争论
skeptical_inquiring - 质疑审视
playful_doubt - 傲娇不信（我才不信呢）
misunderstood_sigh - 被误解的叹息
annoyed_glare - 恼怒的瞪视
disgust_talking - 嫌弃地说话
shocked_offended - 震惊被冒犯（你给我看了什么？！）
critical_amazement - 惊讶中带着批评
defeated_sigh - 认命叹气
gentle_inquiry - 温和提问（嗯？）
resigned_acceptance - 无奈接受
serene - 平静安详
challenging - 挑衅、审视
disdainful_sigh - 轻蔑不屑（切，就这啊）
unimpressed - 不以为然（什么嘛）
reluctant - 不情愿

【选择指南】
- 开心/赞同/赞美 → joyful_laugh, cheerful_laughing, confident_laugh
- 平静/温柔/默认 → calm_gentle, gentle_smile_closed, serene
- 疑惑/不确定 → questioning, skeptical_inquiring, surprised_slight
- 无奈/叹气 → neutral_slight_upset, resigned_acceptance, helpless_smile
- 得意/调皮 → smug_playful, pout_playful, confident_playful
- 委屈/难过 → upset_whimper, worried_upset, misunderstood_sigh
- 生气/不悦 → displeasure, annoyed_glare, serious_displeased
- 害羞/尴尬 → blush, sweat, sweat_2
- 惊讶/震惊 → shocked_offended, surprised_slight, critical_amazement
- 严肃/认真 → serious_deadpan, determined, challenging

每次回复至少选择一个表情，用 «E»表情名称«/E» 标签包裹。`
}
