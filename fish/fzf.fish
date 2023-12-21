set -gx FZF_DEFAULT_COMMAND 'fd --type f'
set -gx FZF_DEFAULT_OPTS '--reverse --inline-info \--bind \'ctrl-y:execute-silent(readlink -f {} | cat {} | pbcopy)+abort\' \--header \'Press CTRL-Y to copy file content into clipboard\''