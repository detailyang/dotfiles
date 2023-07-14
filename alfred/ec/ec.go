package main

import (
	"encoding/base64"
	"fmt"
	"net/url"
	"strings"

	aw "github.com/deanishe/awgo"
)

func main() {
	wf := aw.New()
	args := wf.Args()

	if len(args) == 0 {
		return
	}

	input := args[0]

	wf.NewItem("URL 编码").
		Subtitle(fmt.Sprintf("编码结果：%s", url.QueryEscape(input))).
		Copytext(url.QueryEscape(input))

	wf.NewItem("URL 解码").
		Subtitle(fmt.Sprintf("解码结果：%s", decodeURL(input))).
		Copytext(decodeURL(input))

	wf.NewItem("Base64 编码").
		Subtitle(fmt.Sprintf("编码结果：%s", base64.StdEncoding.EncodeToString([]byte(input)))).
		Copytext(base64.StdEncoding.EncodeToString([]byte(input)))

	wf.NewItem("Base64 解码").
		Subtitle(fmt.Sprintf("解码结果：%s", decodeBase64(input))).
		Copytext(decodeBase64(input))

	wf.NewItem("小写").
		Subtitle(fmt.Sprintf("转换结果：%s", strings.ToLower(input))).
		Copytext(strings.ToLower(input))

	wf.NewItem("大写").
		Subtitle(fmt.Sprintf("转换结果：%s", strings.ToUpper(input))).
		Copytext(strings.ToUpper(input))

	wf.SendFeedback()
}

func decodeURL(input string) string {
	decoded, err := url.QueryUnescape(input)
	if err != nil {
		return fmt.Sprintf("解码失败：%s", err)
	}
	return decoded
}

func decodeBase64(input string) string {
	decoded, err := base64.StdEncoding.DecodeString(input)
	if err != nil {
		return fmt.Sprintf("解码失败：%s", err)
	}
	return string(decoded)
}
