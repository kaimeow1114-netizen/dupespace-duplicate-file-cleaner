import { notFound } from "next/navigation";
import { findSolution } from "../../../../lib/solutions";
import { SolutionArticlePage, solutionMetadata } from "../../../components/solution-pages";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const solution = findSolution((await params).slug, "en");
  if (!solution) notFound();
  return solutionMetadata(solution, "en");
}

export default async function Page({ params }: Props) {
  const solution = findSolution((await params).slug, "en");
  if (!solution) notFound();
  return <SolutionArticlePage solution={solution} locale="en" />;
}
