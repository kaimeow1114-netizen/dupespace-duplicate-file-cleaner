import { notFound } from "next/navigation";
import { findGuide } from "../../../lib/guides";
import { GuideArticle, guideMetadata } from "../../components/guide-article";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  const guide = findGuide((await params).slug, "zh-TW");
  if (!guide) notFound();
  return guideMetadata(guide, "zh-TW");
}
export default async function Page({ params }: Props) {
  const guide = findGuide((await params).slug, "zh-TW");
  if (!guide) notFound();
  return <GuideArticle guide={guide} locale="zh-TW" />;
}
