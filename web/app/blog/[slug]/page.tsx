import { notFound } from "next/navigation";
import { findBlogArticle } from "../../../lib/blog";
import { BlogArticlePage, blogArticleMetadata } from "../../components/blog-article";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const article = findBlogArticle((await params).slug, "zh-TW");
  if (!article) notFound();
  return blogArticleMetadata(article, "zh-TW");
}

export default async function Page({ params }: Props) {
  const article = findBlogArticle((await params).slug, "zh-TW");
  if (!article) notFound();
  return <BlogArticlePage article={article} locale="zh-TW" />;
}
