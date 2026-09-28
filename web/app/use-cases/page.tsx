import { casesMetadata, UseCasesHome } from "../components/use-case-pages";

export const metadata = casesMetadata("zh-TW");

export default function Page() {
  return <UseCasesHome locale="zh-TW" />;
}
