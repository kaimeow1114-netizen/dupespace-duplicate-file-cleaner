import { casesMetadata, UseCasesHome } from "../../components/use-case-pages";

export const metadata = casesMetadata("en");

export default function Page() {
  return <UseCasesHome locale="en" />;
}
