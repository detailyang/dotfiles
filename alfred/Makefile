  
# Background color
GREEN  				:= $(shell tput -Txterm setaf 2)
YELLOW 				:= $(shell tput -Txterm setaf 3)
BLUE 				:= $(shell tput -Txterm setaf 4)
MAGENTA             := $(shell tput -Txterm setaf 5)
WHITE  				:= $(shell tput -Txterm setaf 7)
RESET  				:= $(shell tput -Txterm sgr0)
TARGET_MAX_CHAR_NUM := 20
PADDING             := $(shell printf '%-24s' "")

## Show help
help:
	@echo ''
	@echo 'Usage:'
	@echo '  ${YELLOW}make${RESET} ${GREEN}<target>${RESET} ${MAGENTA}[variable=value]${RESET}'
	@echo ''
	@echo 'Targets:'
	@awk '/^[a-zA-Z\-\_0-9]+:/ { \
		helpMessage = match(lastLine, /^## (.*)/); \
		if (helpMessage) { \
			helpCommand = substr($$1, 0, index($$1, ":")-1); \
			helpMessage = substr(lastLine, RSTART + 3, RLENGTH); \
			gsub(/;;/,"\n${PADDING}${MAGENTA}>variable: ${RESET}", helpMessage); \
			printf "  ${YELLOW}%-$(TARGET_MAX_CHAR_NUM)s${RESET} ${GREEN}%s${RESET}\n", helpCommand, helpMessage; \
		} \
	} \
	{ lastLine = $$0 }' $(MAKEFILE_LIST)	


MKFILE_PATH := $(abspath $(lastword $(MAKEFILE_LIST)))
MKFILE_DIR  := $(dir $(MKFILE_PATH))

.PHONY: all
## Building all plugin
all: ip ts ec errno hex tz

.PHONY: fmt
## Format *.go
fmt: 
	go fmt ./...
	
.PHONY: ip
## Building ip plugin
ip:
	go build -o ~/.alfred/ip ip/*.go

.PHONY: ts
## Building ts plugin
ts:
	go build -o ~/.alfred/ts ts/*.go

.PHONY: ec
## Building ec plugin
ec:
	go build -o ~/.alfred/ec ec/*.go

.PHONY: errno
## Building errno plugin
errno:
	go build -o ~/.alfred/errno errno/*.go

.PHONY: hex
## Building hex plugin
hex:
	go build -o ~/.alfred/hex hex/*.go


.PHONY:tz 
## Building tz plugin
tz:
	go build -o ~/.alfred/tz tz/*.go