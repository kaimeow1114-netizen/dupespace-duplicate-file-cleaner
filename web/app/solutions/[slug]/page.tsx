import { notFound } from "next/navigation";
import { findSolution } from "../../../lib/solutions";
import { SolutionArticlePage, solutionMetadata } from "../../components/solution-pages";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const solution = findSolution((await params).slug, "zh-TW");
  if (!solution) notFound();
  return solutionMetadata(solution, "zh-TW");
}

export default async function Page({ params }: Props) {
  const solution = findSolution((await params).slug, "zh-TW");
  if (!solution) notFound();
  return <SolutionArticlePage solution={solution} locale="zh-TW" />;
}
