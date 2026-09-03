"use client";

import { useEffect, useState } from "react";
import { Github, Star } from "lucide-react";

const repository = "kaimeow1114-netizen/dupespace-duplicate-file-cleaner";

export function GitHubStars({ locale = "zh-TW", live = true }: { locale?: "zh-TW" | "en"; live?: boolean }) {
  const [stars, setStars] = useState<number | null>(null);
  useEffect(() => {
    if (!live) return;
    fetch(`https://api.github.com/repos/${repository}`, { headers: { accept: "application/vnd.github+json" } })
      .then((response) => response.ok ? response.json() : null)
      .then((value: unknown) => {
        if (value && typeof value === "object" && "stargazers_count" in value && typeof value.stargazers_count === "number") setStars(value.stargazers_count);
      })
      .catch(() => undefined);
  }, [live]);
  return <a className="github-stars" href={`https://github.com/${repository}`} aria-label={locale === "en" ? "View DUPESPACE on GitHub" : "在 GitHub 查看 DUPESPACE"}><Github size={15} aria-hidden="true" /><b>GitHub</b>{stars !== null && <em><Star size={11} aria-hidden="true" />{stars.toLocaleString()}</em>}</a>;
}
