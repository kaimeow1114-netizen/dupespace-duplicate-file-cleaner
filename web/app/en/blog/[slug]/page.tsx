import { notFound } from "next/navigation";
import { findBlogArticle } from "../../../../lib/blog";
import { BlogArticlePage, blogArticleMetadata } from "../../../components/blog-article";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const article = findBlogArticle((await params).slug, "en");
  if (!article) notFound();
  return blogArticleMetadata(article, "en");
}

export default async function Page({ params }: Props) {
  const article = findBlogArticle((await params).slug, "en");
  if (!article) notFound();
  return <BlogArticlePage article={article} locale="en" />;
}
