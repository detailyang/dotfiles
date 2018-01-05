for file in ~/.config/fish/conf.d/*.fish
	source $file
end

for file in ~/.fish/*.fish
	source $file
end

set -x PATH ~/.cargo/bin $PATH
set -x PATH ~/.go/bin $PATH
