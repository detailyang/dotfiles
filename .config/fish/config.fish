for file in ~/.config/fish/conf.d/*.fish
	source $file
end

for file in ~/.fish/*.fish
	source $file
end
