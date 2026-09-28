import { notFound } from "next/navigation";
import { findUseCase } from "../../../../lib/use-cases";
import { caseMetadata, UseCaseArticlePage } from "../../../components/use-case-pages";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const item = findUseCase((await params).slug, "en");
  if (!item) notFound();
  return caseMetadata(item, "en");
}

export default async function Page({ params }: Props) {
  const item = findUseCase((await params).slug, "en");
  if (!item) notFound();
  return <UseCaseArticlePage item={item} locale="en" />;
}
