package main

import (
	"fmt"
	"time"

	aw "github.com/deanishe/awgo"
)

func main() {
	wf := aw.New()

	// 获取当前时间
	now := time.Now()

	// 中国
	cnLoc, _ := time.LoadLocation("Asia/Shanghai")
	cnTime := now.In(cnLoc)

	// 华尔街
	nyLoc, _ := time.LoadLocation("America/New_York")
	nyTime := now.In(nyLoc)

	// 纽约
	wsLoc, _ := time.LoadLocation("America/Los_Angeles")
	wsTime := now.In(wsLoc)

	// 伦敦
	lnLoc, _ := time.LoadLocation("Europe/London")
	lnTime := now.In(lnLoc)

	// 添加当前时间
	wf.NewItem(fmt.Sprintf("当前时间: %s", now.Format("2006-01-02 15:04:05"))).Copytext(now.Format("2006-01-02 15:04:05"))

	// 添加中国时间
	wf.NewItem(fmt.Sprintf("中国时间: %s", cnTime.Format("2006-01-02 15:04:05"))).Copytext(cnTime.Format("2006-01-02 15:04:05"))

	// 添加华尔街时间
	wf.NewItem(fmt.Sprintf("华尔街时间: %s", nyTime.Format("2006-01-02 15:04:05"))).Copytext(nyTime.Format("2006-01-02 15:04:05"))

	// 添加纽约时间
	wf.NewItem(fmt.Sprintf("纽约时间: %s", wsTime.Format("2006-01-02 15:04:05"))).Copytext(wsTime.Format("2006-01-02 15:04:05"))

	// 添加伦敦时间
	wf.NewItem(fmt.Sprintf("伦敦时间: %s", lnTime.Format("2006-01-02 15:04:05"))).Copytext(lnTime.Format("2006-01-02 15:04:05"))

	wf.SendFeedback()
}
