import { headers } from "next/headers";

export async function AdPanel() {
  const nonce = (await headers()).get("x-dupespace-nonce") ?? undefined;
  return (
    <script
      async
      nonce={nonce}
      crossOrigin="anonymous"
      src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7998471640181666"
    />
  );
}
