package main

import (
	"fmt"
	"strconv"

	aw "github.com/deanishe/awgo"
)

func main() {
	wf := aw.New()
	args := wf.Args()

	if len(args) == 0 {
		wf.FatalError(fmt.Errorf("请输入一个数字"))
	}

	input := args[0]

	num, err := strconv.Atoi(input)
	if err != nil {
		wf.FatalError(fmt.Errorf("输入不是一个数字：%s", input))
	}

	wf.NewItem(fmt.Sprintf("原始数字：%d", num)).
		Subtitle(fmt.Sprintf("10进制：%d, 16进制：%X, 2进制：%b, 8进制：%o", num, num, num, num)).
		Copytext(fmt.Sprintf("%d", num))

	wf.NewItem(fmt.Sprintf("10进制：%d", num)).
		Subtitle(fmt.Sprintf("16进制：%X, 2进制：%b, 8进制：%o", num, num, num)).
		Copytext(fmt.Sprintf("%d", num))

	wf.NewItem(fmt.Sprintf("16进制：%X", num)).
		Subtitle(fmt.Sprintf("10进制：%d, 2进制：%b, 8进制：%o", num, num, num)).
		Copytext(fmt.Sprintf("%X", num))

	wf.NewItem(fmt.Sprintf("2进制：%b", num)).
		Subtitle(fmt.Sprintf("10进制：%d, 16进制：%X, 8进制：%o", num, num, num)).
		Copytext(fmt.Sprintf("%b", num))

	wf.NewItem(fmt.Sprintf("8进制：%o", num)).
		Subtitle(fmt.Sprintf("10进制：%d, 16进制：%X, 2进制：%b", num, num, num)).
		Copytext(fmt.Sprintf("%o", num))

	wf.SendFeedback()
}
