#!/usr/bin/env python3
"""Fetch HackerNews top 10 stories with title and URL."""
import urllib.request
import json

BASE = "https://hacker-news.firebaseio.com/v0"

def fetch(url):
    with urllib.request.urlopen(url) as r:
        return json.loads(r.read())

def main():
    top_ids = fetch(f"{BASE}/topstories.json")[:10]
    stories = []
    for sid in top_ids:
        item = fetch(f"{BASE}/item/{sid}.json")
        stories.append({
            "title": item.get("title", ""),
            "url": item.get("url", f"https://news.ycombinator.com/item?id={sid}"),
            "score": item.get("score", 0),
            "comments": item.get("descendants", 0),
        })
    print(json.dumps(stories, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
