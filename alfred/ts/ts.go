package main

import (
	"fmt"
	"strconv"
	"time"

	aw "github.com/deanishe/awgo"
)

// Workflow is the main API
var wf *aw.Workflow

func init() {
	// Create a new Workflow using default settings.
	// Critical settings are provided by Alfred via environment variables,
	// so this *will* die in flames if not run in an Alfred-like environment.
	wf = aw.New()
}

func currentTimestamp() {
	now := time.Now()
	unix := now.Unix()
	ms := now.UnixNano() / int64(time.Millisecond)
	us := now.UnixNano() / int64(time.Microsecond)
	ns := now.UnixNano()
	wf.NewItem(fmt.Sprintf("当前时间戳（秒）：%d", unix)).
		Subtitle(fmt.Sprintf("本地时间：%s", now.Format(time.RFC3339))).
		Copytext(fmt.Sprintf("%d", unix))

	wf.NewItem(fmt.Sprintf("当前时间戳（毫秒）：%d", ms)).
		Subtitle(fmt.Sprintf("本地时间：%s", now.Format(time.RFC3339Nano))).
		Copytext(fmt.Sprintf("%d", ms))

	wf.NewItem(fmt.Sprintf("当前时间戳（微秒）：%d", us)).
		Subtitle(fmt.Sprintf("本地时间：%s", now.Format(time.RFC3339Nano))).
		Copytext(fmt.Sprintf("%d", us))

	wf.NewItem(fmt.Sprintf("当前时间戳（纳秒）：%d", ns)).
		Subtitle(fmt.Sprintf("本地时间：%s", now.Format(time.RFC3339Nano))).
		Copytext(fmt.Sprintf("%d", ns))

	wf.SendFeedback()
}

func parseTimestamp(input string) {
	var t time.Time

	if len(input) == 10 {
		sec, err := strconv.ParseInt(input, 10, 64)
		if err != nil {
			wf.FatalError(err)
		}
		t = time.Unix(sec, 0)
	} else if len(input) == 13 {
		ms, err := strconv.ParseInt(input, 10, 64)
		if err != nil {
			wf.FatalError(err)
		}
		t = time.Unix(ms/1000, (ms%1000)*int64(time.Millisecond))
	} else {
		wf.FatalError(fmt.Errorf("无效的时间戳格式：%s", input))
	}

	local := t.Local()
	utc := t.UTC()

	wf.NewItem("本地时间").
		Subtitle(local.Format(time.RFC3339)).
		Arg(local.Format(time.RFC3339)).
		Valid(true)

	wf.NewItem("UTC 时间").
		Subtitle(utc.Format(time.RFC3339)).
		Arg(utc.Format(time.RFC3339)).
		Valid(true)
	wf.SendFeedback()
}

func main() {
	args := wf.Args()
	if len(args) == 0 {
		currentTimestamp()
	} else {
		parseTimestamp(args[0])
	}
}
