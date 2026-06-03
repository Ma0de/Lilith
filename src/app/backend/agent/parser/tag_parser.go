package parser

import (
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
	Expression  string
}

func ParseTagOutput(content string) *ParsedOutput {
	result := &ParsedOutput{EchoContent: content, Commands: []MemoryCommand{}}

	expRe := regexp.MustCompile(`«E»(.*?)«/E»`)
	if m := expRe.FindStringSubmatch(content); len(m) > 1 {
		result.Expression = strings.TrimSpace(m[1])
		result.EchoContent = strings.Replace(result.EchoContent, m[0], "", 1)
	}

	cmdRe := regexp.MustCompile(`«M»(.*?)«/M»`)
	for _, m := range cmdRe.FindAllStringSubmatch(content, -1) {
		if cmd := parseCommand(m[1]); cmd != nil {
			result.Commands = append(result.Commands, *cmd)
			result.EchoContent = strings.Replace(result.EchoContent, m[0], "", 1)
		}
	}

	echoRe := regexp.MustCompile(`<echo>(.*?)</echo>`)
	if m := echoRe.FindStringSubmatch(result.EchoContent); len(m) > 1 {
		result.EchoContent = m[1]
	} else {
		result.EchoContent = strings.TrimSpace(result.EchoContent)
	}

	return result
}

func parseCommand(cmdStr string) *MemoryCommand {
	data := map[string]string{}
	for _, p := range strings.Fields(cmdStr) {
		kv := strings.SplitN(p, ":", 2)
		if len(kv) == 2 {
			data[kv[0]] = kv[1]
		}
	}

	if data["l"] == "" || data["a"] == "" || data["v"] == "" {
		return nil
	}

	cmd := &MemoryCommand{
		List:      data["l"],
		Operation: data["a"],
		Version:   data["v"],
	}

	switch cmd.Operation {
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

	return cmd
}
