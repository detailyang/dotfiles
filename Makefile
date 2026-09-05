.PHONY: help check check-dotfiles check-pi

## Show help
help:
	@printf 'Usage: make <target>\n\n'
	@awk '/^## / { help = substr($$0, 4); next } \
		help && /^[a-zA-Z0-9_-]+:/ { sub(/:$$/, "", $$1); printf "  %-20s %s\n", $$1, help } \
		{ help = "" }' $(MAKEFILE_LIST)

## Run repository validation
check: check-dotfiles check-pi

## Run dotfiles and installer validation
check-dotfiles:
	./tests/validate.sh

## Run Pi type checks and tests
check-pi:
	npm --prefix pi run check
