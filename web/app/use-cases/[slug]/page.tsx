import { notFound } from "next/navigation";
import { findUseCase } from "../../../lib/use-cases";
import { caseMetadata, UseCaseArticlePage } from "../../components/use-case-pages";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const item = findUseCase((await params).slug, "zh-TW");
  if (!item) notFound();
  return caseMetadata(item, "zh-TW");
}

export default async function Page({ params }: Props) {
  const item = findUseCase((await params).slug, "zh-TW");
  if (!item) notFound();
  return <UseCaseArticlePage item={item} locale="zh-TW" />;
}
