import type { Metadata } from "next";
import { LegacyCleanerRetirement } from "../components/legacy-cleaner-retirement";

export const metadata: Metadata = { title: "功能已移至本機分析器", robots: { index: false, follow: true } };

export default function CleanerMigrationPage() { return <LegacyCleanerRetirement />; }
