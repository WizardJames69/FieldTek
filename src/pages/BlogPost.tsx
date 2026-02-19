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
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-24 text-center">
          <h1 className="text-2xl font-bold mb-4">Post Not Found</h1>
          <p className="text-muted-foreground mb-8">
            The blog post you're looking for doesn't exist.
          </p>
          <Button asChild>
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

      <div className="min-h-screen bg-background">
        <Navbar />
        
        {/* Article Header */}
        <article>
          <header className="py-12 md:py-20 bg-muted/30">
            <div className="container mx-auto px-4">
              <div className="max-w-3xl mx-auto">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="mb-6"
                  onClick={() => navigate('/blog')}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Blog
                </Button>
                
                <Badge variant="secondary" className="mb-4">
                  {post.categoryLabel}
                </Badge>
                
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 leading-tight">
                  {post.title}
                </h1>
                
                <p className="text-lg text-muted-foreground mb-6">
                  {post.excerpt}
                </p>
                
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
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
                <div className="mt-12 p-6 bg-primary/5 border border-primary/20 rounded-xl">
                  <div className="flex items-center gap-3 mb-3">
                    <FlaskConical className="h-5 w-5 text-primary" />
                    <span className="font-semibold text-foreground">Join Our Beta Program</span>
                  </div>
                  <p className="text-muted-foreground mb-4">
                    Get 50% off your first year as a Founding Member. Limited to 10 companies.
                  </p>
                  <Button asChild>
                    <Link to="/#beta-program">Apply for Beta Access</Link>
                  </Button>
                </div>

                {/* Tags */}
                <div className="mt-12 pt-8 border-t border-border">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    {post.keywords.map(keyword => (
                      <Badge key={keyword} variant="outline">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </article>

        <Separator />

        {/* Related Posts */}
        {recentPosts.length > 0 && (
          <section className="py-12 md:py-16">
            <div className="container mx-auto px-4">
              <h2 className="text-2xl font-bold mb-8 text-center">
                More from the Blog
              </h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
                {recentPosts.slice(0, 3).map(relatedPost => (
                  <Card key={relatedPost.id} className="group hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <Badge variant="outline" className="w-fit text-xs mb-2">
                        {relatedPost.categoryLabel}
                      </Badge>
                      <CardTitle className="line-clamp-2 group-hover:text-primary transition-colors">
                        <Link to={`/blog/${relatedPost.slug}`}>
                          {relatedPost.title}
                        </Link>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        {relatedPost.excerpt}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{format(new Date(relatedPost.publishedAt), 'MMM d, yyyy')}</span>
                        <span>·</span>
                        <span>{relatedPost.readingTime} min read</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CTA Section */}
        <section className="py-16 bg-primary text-primary-foreground">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Put These Insights Into Practice
            </h2>
            <p className="text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
              See how FieldTek can help you implement these best practices with our all-in-one field service platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" variant="secondary">
                <Link to="/demo-sandbox">Try Interactive Demo</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10">
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
