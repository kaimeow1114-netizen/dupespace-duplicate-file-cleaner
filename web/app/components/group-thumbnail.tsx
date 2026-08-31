"use client";

import { FileImage, FileText, FileVideo, ImageOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { thumbnailQueue, thumbnailSource } from "../../lib/thumbnails";
import { cleanerTranslator, type CleanerLocale } from "../../lib/cleaner-i18n";

export function GroupThumbnail({ url, proof, id, name, video = false, document = false, locale = "zh-TW" }: { url: string | null; proof?: string; id?: string; name: string; video?: boolean; document?: boolean; locale?: CleanerLocale }) {
  const t = cleanerTranslator(locale);
  const holder = useRef<HTMLSpanElement>(null);
  const source = thumbnailSource(url);
  const [visible, setVisible] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const element = holder.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "80px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible || !source || failed) return;
    let active = true;
    let blobUrl: string | null = null;
    const controller = new AbortController();
    const cancel = thumbnailQueue.enqueue((done) => {
      const timer = setTimeout(() => controller.abort(), 12_000);
      void (async () => {
        try {
          if (!proof || !id) { setImageUrl(source); return; }
          const response = await fetch("/api/google/thumbnail", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ id, proof }), cache: "no-store", signal: controller.signal,
          });
          if (!response.ok) throw new Error("Thumbnail unavailable");
          const blob = await response.blob();
          if (blob.size > 1_048_576 || !["image/jpeg", "image/png", "image/webp"].includes(blob.type)) throw new Error("Invalid thumbnail");
          if (active) { blobUrl = URL.createObjectURL(blob); setImageUrl(blobUrl); }
        } catch { if (active) setFailed(true); }
        finally { clearTimeout(timer); done(); }
      })();
    });
    return () => {
      active = false; controller.abort(); cancel();
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      setImageUrl(null);
    };
  }, [source, visible, failed, proof, id]);
  return <span ref={holder} className={`group-thumbnail ${video ? "is-video" : ""}`} title={failed || !source ? t("Google 目前未提供可用縮圖；仍可開啟檔案查看") : `${name} ${t("縮圖")}`}>
    {visible && imageUrl && !failed ? <img src={imageUrl} alt={`${name} ${t("縮圖")}`} width={240} height={180} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> /* eslint-disable-line @next/next/no-img-element */
      : failed ? <ImageOff size={24} aria-hidden="true" /> : video ? <FileVideo size={25} aria-hidden="true" /> : document ? <FileText size={25} aria-hidden="true" /> : <FileImage size={25} aria-hidden="true" />}
    {video && <span className="thumbnail-video-mark"><FileVideo size={13} aria-hidden="true" /><span className="sr-only">{t("影片縮圖，不自動播放")}</span></span>}
  </span>;
}
