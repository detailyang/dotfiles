defaults write com.microsoft.VSCode ApplePressAndHoldEnabled -bool false              2>&1 &> /dev/null # For VS Code
defaults write com.microsoft.VSCodeInsiders ApplePressAndHoldEnabled -bool false      2>&1 &> /dev/null # For VS Code Insider
defaults write com.visualstudio.code.oss ApplePressAndHoldEnabled -bool false         2>&1 &> /dev/null # For VS Codium
defaults write com.microsoft.VSCodeExploration ApplePressAndHoldEnabled -bool false   2>&1 &> /dev/null # For VS Codium Exploration users
defaults delete -g ApplePressAndHoldEnabled                                           2>&1 &> /dev/null # If necessary, reset global default
