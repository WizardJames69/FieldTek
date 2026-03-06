import { useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { format } from "date-fns";
import { Calendar, Clock, ArrowLeft, Tag, FlaskConical } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getBlogPostBySlug, getRecentPosts, blogCategories } from "@/data/blogPosts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const post = slug ? getBlogPostBySlug(slug) : undefined;
  const recentPosts = getRecentPosts(3).filter(p => p.slug !== slug);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (!post) {
    return (
      <div className="min-h-screen bg-[#08090A] dark-blog">
        <Navbar />
        <div className="container mx-auto px-4 py-24 text-center pt-32">
          <h1 className="text-2xl font-bold mb-4 text-white">Post Not Found</h1>
          <p className="text-zinc-500 mb-8">
            The blog post you're looking for doesn't exist.
          </p>
          <Button asChild className="bg-orange-500 hover:bg-orange-600 text-white">
            <Link to="/blog">Back to Blog</Link>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  const categoryInfo = blogCategories.find(c => c.id === post.category);

  return (
    <>
      <Helmet>
        <title>{post.metaTitle}</title>
        <meta name="description" content={post.metaDescription} />
        <meta name="keywords" content={post.keywords.join(', ')} />
        <link rel="canonical" href={`https://fieldtek.ai/blog/${post.slug}`} />
        
        {/* Open Graph */}
        <meta property="og:title" content={post.metaTitle} />
        <meta property="og:description" content={post.metaDescription} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={`https://fieldtek.ai/blog/${post.slug}`} />
        <meta property="article:published_time" content={post.publishedAt} />
        <meta property="article:section" content={post.categoryLabel} />
        {post.keywords.map(keyword => (
          <meta key={keyword} property="article:tag" content={keyword} />
        ))}
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={post.metaTitle} />
        <meta name="twitter:description" content={post.metaDescription} />
        
        {/* JSON-LD Schema */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "headline": post.title,
            "description": post.excerpt,
            "datePublished": post.publishedAt,
            "author": {
              "@type": "Organization",
              "name": post.author,
              "url": "https://fieldtek.ai"
            },
            "publisher": {
              "@type": "Organization",
              "name": "FieldTek",
              "url": "https://fieldtek.ai"
            },
            "mainEntityOfPage": {
              "@type": "WebPage",
              "@id": `https://fieldtek.ai/blog/${post.slug}`
            },
            "keywords": post.keywords.join(", "),
            "articleSection": post.categoryLabel
          })}
        </script>
      </Helmet>

      <div className="min-h-screen bg-[#08090A] dark-blog">
        <Navbar />

        {/* Article Header */}
        <article>
          <header className="pt-24 pb-12 md:pt-32 md:pb-16">
            <div className="container mx-auto px-4">
              <div className="max-w-3xl mx-auto">
                <button
                  className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-6"
                  onClick={() => navigate('/blog')}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Blog
                </button>

                <Badge variant="secondary" className="mb-4 bg-orange-500/10 text-orange-500 border-0">
                  {post.categoryLabel}
                </Badge>

                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 leading-tight text-white">
                  {post.title}
                </h1>

                <p className="text-lg text-zinc-400 mb-6">
                  {post.excerpt}
                </p>

                <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(post.publishedAt), 'MMMM d, yyyy')}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    {post.readingTime} min read
                  </span>
                  <span>By {post.author}</span>
                </div>
              </div>
            </div>
          </header>

          {/* Article Content */}
          <div className="py-12 md:py-16">
            <div className="container mx-auto px-4">
              <div className="max-w-3xl mx-auto">
                <div className="blog-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
                </div>

                {/* Beta CTA Banner */}
                <div className="mt-12 p-6 bg-orange-500/5 border border-orange-500/20 rounded-xl">
                  <div className="flex items-center gap-3 mb-3">
                    <FlaskConical className="h-5 w-5 text-orange-500" />
                    <span className="font-semibold text-white">Join Our Beta Program</span>
                  </div>
                  <p className="text-zinc-400 mb-4">
                    Get 50% off your first year as a Founding Member. Limited to 10 companies.
                  </p>
                  <Button asChild className="bg-orange-500 hover:bg-orange-600 text-white">
                    <Link to="/#beta-program">Apply for Beta Access</Link>
                  </Button>
                </div>

                {/* Tags */}
                <div className="mt-12 pt-8 border-t border-white/[0.06]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag className="h-4 w-4 text-zinc-500" />
                    {post.keywords.map(keyword => (
                      <Badge key={keyword} variant="outline" className="border-white/[0.1] text-zinc-400">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </article>

        <div className="border-t border-white/[0.06]" />

        {/* Related Posts */}
        {recentPosts.length > 0 && (
          <section className="py-12 md:py-16">
            <div className="container mx-auto px-4">
              <h2 className="text-2xl font-bold mb-8 text-center text-white">
                More from the Blog
              </h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
                {recentPosts.slice(0, 3).map(relatedPost => (
                  <div key={relatedPost.id} className="group bg-[#111214] border border-white/[0.06] rounded-xl p-6 hover:border-white/[0.12] transition-colors">
                    <div className="mb-4">
                      <Badge variant="outline" className="w-fit text-xs mb-3 border-white/[0.1] text-zinc-400">
                        {relatedPost.categoryLabel}
                      </Badge>
                      <h3 className="text-lg font-semibold text-white line-clamp-2 group-hover:text-orange-500 transition-colors">
                        <Link to={`/blog/${relatedPost.slug}`}>
                          {relatedPost.title}
                        </Link>
                      </h3>
                    </div>
                    <div>
                      <p className="text-sm text-zinc-400 line-clamp-2 mb-4">
                        {relatedPost.excerpt}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-zinc-500">
                        <span>{format(new Date(relatedPost.publishedAt), 'MMM d, yyyy')}</span>
                        <span>·</span>
                        <span>{relatedPost.readingTime} min read</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CTA Section */}
        <section className="py-16 border-t border-white/[0.06]">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4 text-white">
              Put These Insights Into Practice
            </h2>
            <p className="text-zinc-400 mb-8 max-w-2xl mx-auto">
              See how FieldTek can help you implement these best practices with our all-in-one field service platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-orange-500 hover:bg-orange-600 text-white cta-glow">
                <Link to="/demo-sandbox">Try Interactive Demo</Link>
              </Button>
              <Button asChild size="lg" className="bg-transparent border border-white/[0.1] text-white hover:bg-white/5">
                <Link to="/#beta-program">Apply for Beta Access</Link>
              </Button>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </>
  );
}
