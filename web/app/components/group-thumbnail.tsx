"use client";

import { FileImage, FileVideo, ImageOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { thumbnailQueue, thumbnailSource } from "../../lib/thumbnails";

export function GroupThumbnail({ url, name, video = false }: { url: string | null; name: string; video?: boolean }) {
  const holder = useRef<HTMLSpanElement>(null);
  const source = thumbnailSource(url);
  const [visible, setVisible] = useState(false);
  const [permitted, setPermitted] = useState(false);
  const [failed, setFailed] = useState(false);
  const release = useRef<(() => void) | null>(null);

  useEffect(() => {
    const element = holder.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "80px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !source || failed) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cancel = thumbnailQueue.enqueue((done) => {
      release.current = () => { clearTimeout(timer); done(); release.current = null; };
      setPermitted(true);
      timer = setTimeout(() => { setFailed(true); release.current?.(); }, 10_000);
    });
    return () => { clearTimeout(timer); release.current = null; setPermitted(false); cancel(); };
  }, [source, visible, failed]);

  return <span ref={holder} className={`group-thumbnail ${video ? "is-video" : ""}`} title={failed || !source ? "此檔案目前沒有可顯示的縮圖" : `${name} 縮圖`}>
    {visible && permitted && source && !failed ? <img src={source} alt={`${name} 小縮圖`} width={96} height={72} loading="lazy" decoding="async" referrerPolicy="no-referrer" onLoad={() => release.current?.()} onError={() => { setFailed(true); release.current?.(); }} /> /* eslint-disable-line @next/next/no-img-element */
      : failed ? <ImageOff size={24} aria-hidden="true" /> : video ? <FileVideo size={25} aria-hidden="true" /> : <FileImage size={25} aria-hidden="true" />}
    {video && <span className="thumbnail-video-mark"><FileVideo size={13} aria-hidden="true" /><span className="sr-only">影片縮圖，不自動播放</span></span>}
  </span>;
}
