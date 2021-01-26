package main

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	aw "github.com/deanishe/awgo"
)

type Flag struct {
	name string
	mask uint64
}

var flags = []Flag{
	{"___GFP_DMA", 0x01},
	{"___GFP_HIGHMEM", 0x02},
	{"___GFP_DMA32", 0x04},
	{"___GFP_MOVABLE", 0x08},
	{"___GFP_WAIT", 0x10},
	{"___GFP_HIGH", 0x20},
	{"___GFP_IO", 0x40},
	{"___GFP_FS", 0x80},
	{"___GFP_COLD", 0x100},
	{"___GFP_NOWARN", 0x200},
	{"___GFP_REPEAT", 0x400},
	{"___GFP_NOFAIL", 0x800},
	{"___GFP_NORETRY", 0x1000},
	{"___GFP_MEMALLOC", 0x2000},
	{"___GFP_COMP", 0x4000},
	{"___GFP_ZERO", 0x8000},
	{"___GFP_NOMEMALLOC", 0x10000},
	{"___GFP_HARDWALL", 0x20000},
	{"___GFP_THISNODE", 0x40000},
	{"___GFP_RECLAIMABLE", 0x80000},
	{"___GFP_NOTRACK", 0x200000},
	{"___GFP_NO_KSWAPD", 0x400000},
	{"___GFP_OTHER_NODE", 0x800000},
	{"___GFP_WRITE", 0x1000000},
}

var (
	workflow *aw.Workflow
)

func run() {
	if len(os.Args) < 2 {
		panic("must input arguments")
	}
	input := os.Args[1]

	n, err := strconv.ParseUint(strings.Replace(strings.Replace(input, "0x", "", 0), "0X", "", 0), 16, 64)
	if err != nil {
		workflow.NewItem(fmt.Sprintf("error: %w", err))
		workflow.SendFeedback()
		return
	}

	if n&0x00 == 0 {
		workflow.NewItem("___GFP_NORMAL")
	}

	for _, r := range flags {
		if n&r.mask > 0 {
			workflow.NewItem(r.name)
		}
	}
	// Send results to Alfred
	workflow.SendFeedback()
}

func main() {
	workflow = aw.New()
	workflow.Run(run)
}
