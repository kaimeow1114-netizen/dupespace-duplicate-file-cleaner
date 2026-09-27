import { SolutionsHome, solutionsMetadata } from "../components/solution-pages";

export const metadata = solutionsMetadata("zh-TW");

export default function Page() {
  return <SolutionsHome locale="zh-TW" />;
}
