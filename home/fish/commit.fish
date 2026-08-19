function commit
    env HTTPS_PROXY=http://127.0.0.1:7890 HTTP_PROXY=http://127.0.0.1:7890 pi --provider google-ai-studio --model gemini-flash-latest -p "/commit" $argv
end
