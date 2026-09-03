import { LegacyCleanerRetirement } from "../../components/legacy-cleaner-retirement";

export const metadata = { title: "Feature moved to the local analyzer", robots: { index: false, follow: true } };

export default function CleanerMigrationPage() { return <LegacyCleanerRetirement locale="en" />; }
