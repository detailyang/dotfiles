#!/bin/bash
# feedly-daily.sh — 每日 Feedly 阅读自动化
# Usage: feedly-daily.sh [--mark-read] [--limit N]

set -euo pipefail

MARK_READ=false
LIMIT=20
OUTPUT_DIR="${HOME}/feedly"
DATE=$(date +%Y-%m-%d)
RANDOM_SUFFIX=$(printf "%04d" $((RANDOM % 10000)))
REPORT="${OUTPUT_DIR}/${DATE}-${RANDOM_SUFFIX}.md"

while [[ $# -gt 0 ]]; do
  case $1 in
    --mark-read) MARK_READ=true; shift ;;
    --limit)     LIMIT="$2"; shift 2 ;;
    *)           echo "Unknown option: $1"; exit 1 ;;
  esac
done

mkdir -p "$OUTPUT_DIR"

echo "==> Opening Feedly Today..."
agent-browser open "https://feedly.com/i/my/me" > /dev/null
sleep 2

# 检查是否跳转到登录页
URL=$(agent-browser eval --stdin 2>/dev/null <<'CHECK' || true
document.location.href
CHECK
)
if echo "$URL" | grep -q "login\|signin\|auth" 2>/dev/null; then
  echo "ERROR: 登录已过期，请重新登录 Feedly 后再试。"
  exit 1
fi

echo "==> Extracting articles (limit: $LIMIT)..."
ARTICLES=$(cat <<JS | agent-browser eval --stdin
const result = [];
let count = 0;
document.querySelectorAll('article').forEach(article => {
  if (count >= ${LIMIT}) return;
  const titleLink = article.querySelector('a[href^="https://"]:not([href*="feedly.com"])');
  const sourceLink = article.querySelector('a[href*="/subscription/"]');
  if (titleLink && !result.find(a => a.url === titleLink.href)) {
    result.push({
      index: ++count,
      title: titleLink.textContent.trim().substring(0, 100),
      url: titleLink.href,
      source: sourceLink?.textContent?.trim() || ''
    });
  }
});
JSON.stringify(result);
JS
)

COUNT=$(echo "$ARTICLES" | jq 'length' 2>/dev/null || echo 0)
echo "    Found: $COUNT articles"

if [ "$COUNT" -eq 0 ]; then
  echo "    No articles found, skipping."
  exit 0
fi

# 标记已读
if [ "$MARK_READ" = true ]; then
  echo "==> Marking as read..."
  sleep 1
  SNAPSHOT=$(agent-browser snapshot 2>/dev/null || true)
  BTN=$(echo "$SNAPSHOT" | grep -o 'ref=e[0-9]*[^"]*"[^"]*Mark as read' 2>/dev/null | head -1 | grep -o 'e[0-9]*' || true)
  if [ -n "$BTN" ]; then
    agent-browser click "@$BTN" > /dev/null 2>&1 && echo "    Marked as read." || echo "    Click may have succeeded (Feedly refreshes page)."
    sleep 2
  else
    echo "    WARNING: Mark as read button not found, skipping mark step."
  fi
fi

# 生成报告
echo "==> Writing report: $REPORT"
{
  echo "# Feedly Daily - ${DATE}"
  echo ""
  echo "## 文章列表"
  echo ""
  echo "$ARTICLES" | jq -r '.[] | "\(.index). [\(.title)](\(.url))\(if .source != "" then " — \(.source)" else "" end)"'
  echo ""
  echo "## 中文摘要"
  echo ""
  # 预生成带链接的文章骨架，AI 只需填充摘要
  echo "$ARTICLES" | jq -r '.[] | "### \(.index). [\(.title)](\(.url))\n\n<!-- AI 填充：获取成功则写中文摘要，失败则标注 ⚠️ 内容不可访问 -->\n"'
  echo "---"
  echo "生成时间：$(date '+%H:%M')"
} > "$REPORT"

echo "==> Done: $REPORT"
