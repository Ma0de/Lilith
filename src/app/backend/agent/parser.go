package agent

import (
	"encoding/json"
	"log"
	"regexp"
	"strconv"
	"strings"
)

type MemoryCommand struct {
	List      string
	Operation string
	Item      string
	OldItem   string
	Version   string
	Keep      int
}

type ParsedOutput struct {
	EchoContent string
	Commands    []MemoryCommand
	Expression  string // 新增：表情名称
}

func ParseOutput(content string) *ParsedOutput {
	result := &ParsedOutput{
		EchoContent: content,
		Commands:    make([]MemoryCommand, 0),
		Expression:  "",
	}

	log.Printf("[Parser] 原始内容: %s", content)

	// 提取表情标签 «E»emotion«/E»
	expressionRe := regexp.MustCompile(`«E»(.*?)«/E»`)
	expMatches := expressionRe.FindAllStringSubmatch(content, -1)
	if len(expMatches) > 0 && len(expMatches[0]) > 1 {
		result.Expression = strings.TrimSpace(expMatches[0][1])
		result.EchoContent = strings.Replace(result.EchoContent, expMatches[0][0], "", 1)
		log.Printf("[Parser] 提取到表情: %s", result.Expression)
	}

	// 提取记忆命令标签
	commandRe := regexp.MustCompile(`«M»(.*?)«/M»`)
	matches := commandRe.FindAllStringSubmatch(content, -1)
	log.Printf("[Parser] 找到 %d 个命令标签", len(matches))

	for _, match := range matches {
		if len(match) < 2 {
			continue
		}
		if cmd := parseCommand(match[1]); cmd != nil {
			result.Commands = append(result.Commands, *cmd)
			result.EchoContent = strings.Replace(result.EchoContent, match[0], "", 1)
			log.Printf("[Parser] 解析到命令: %+v", cmd)
		}
	}

	// 提取 echo 内容
	echoRe := regexp.MustCompile(`<echo>(.*?)</echo>`)
	echoMatches := echoRe.FindStringSubmatch(result.EchoContent)
	if len(echoMatches) > 1 {
		result.EchoContent = echoMatches[1]
		log.Printf("[Parser] 提取到 echo 内容: %s", result.EchoContent)
	} else {
		result.EchoContent = strings.TrimSpace(result.EchoContent)
		log.Printf("[Parser] 未找到 echo 标签，使用原始内容: %s", result.EchoContent)
	}

	return result
}

func parseCommand(cmdStr string) *MemoryCommand {
	parts := strings.Fields(cmdStr)
	data := make(map[string]string)

	for _, p := range parts {
		kv := strings.SplitN(p, ":", 2)
		if len(kv) == 2 {
			data[kv[0]] = kv[1]
		}
	}

	list := data["l"]
	operation := data["a"]
	version := data["v"]

	if list == "" || operation == "" || version == "" {
		return nil
	}

	cmd := &MemoryCommand{
		List:      list,
		Operation: operation,
		Version:   version,
	}

	switch operation {
	case "add":
		cmd.Item = data["i"]
	case "rep":
		cmd.OldItem = data["o"]
		cmd.Item = data["n"]
	case "del":
		cmd.Item = data["i"]
	case "rst":
		if k, ok := data["k"]; ok {
			cmd.Keep, _ = strconv.Atoi(k)
		}
	}

	if cmd.Operation == "add" && cmd.Item == "" {
		return nil
	}
	if cmd.Operation == "rep" && (cmd.OldItem == "" || cmd.Item == "") {
		return nil
	}
	if cmd.Operation == "del" && cmd.Item == "" {
		return nil
	}

	return cmd
}

func ParseLegacyMemoryTag(jsonStr string) *MemoryCommand {
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

	if legacy.List == "" || legacy.Operation == "" || legacy.Version == "" {
		return nil
	}

	cmd := &MemoryCommand{
		List:      legacy.List,
		Operation: legacy.Operation,
		Version:   legacy.Version,
		Keep:      legacy.Keep,
	}

	switch legacy.Operation {
	case "replace":
		cmd.Operation = "rep"
		cmd.OldItem = legacy.Old
		cmd.Item = legacy.New
	case "add":
		cmd.Item = legacy.Item
	case "delete":
		cmd.Operation = "del"
		cmd.Item = legacy.Item
	case "reset":
		cmd.Operation = "rst"
	}

	return cmd
}
