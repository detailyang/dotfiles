defaults write com.microsoft.VSCode ApplePressAndHoldEnabled -bool false              # For VS Code
defaults write com.microsoft.VSCodeInsiders ApplePressAndHoldEnabled -bool false      # For VS Code Insider
defaults write com.visualstudio.code.oss ApplePressAndHoldEnabled -bool false         # For VS Codium
defaults write com.microsoft.VSCodeExploration ApplePressAndHoldEnabled -bool false   # For VS Codium Exploration users
defaults delete -g ApplePressAndHoldEnabled                                           # If necessary, reset global default