import { SolutionsHome, solutionsMetadata } from "../../components/solution-pages";

export const metadata = solutionsMetadata("en");

export default function Page() {
  return <SolutionsHome locale="en" />;
}
