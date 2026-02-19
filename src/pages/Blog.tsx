import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { format } from "date-fns";
import { Calendar, Clock, ArrowRight, Filter } from "lucide-react";
import { blogPosts, blogCategories, type BlogCategory } from "@/data/blogPosts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export default function Blog() {
  const [selectedCategory, setSelectedCategory] = useState<BlogCategory | 'all'>('all');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const filteredPosts = selectedCategory === 'all' 
    ? blogPosts 
    : blogPosts.filter(post => post.category === selectedCategory);

  const sortedPosts = [...filteredPosts].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return (
    <>
      <Helmet>
        <title>FieldTek Blog | HVAC Tips, Warranty Management & Field Service Insights</title>
        <meta 
          name="description" 
          content="Expert insights for field service professionals. Discover HVAC maintenance tips, warranty management strategies, and best practices to grow your business." 
        />
        <meta name="keywords" content="HVAC tips, warranty management, field service, technician training, dispatching, maintenance" />
        <link rel="canonical" href="https://fieldtek.ai/blog" />
        
        {/* Open Graph */}
        <meta property="og:title" content="FieldTek Blog | Field Service Industry Insights" />
        <meta property="og:description" content="Expert insights for field service professionals. HVAC tips, warranty management, and best practices." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://fieldtek.ai/blog" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="FieldTek Blog | Field Service Industry Insights" />
        <meta name="twitter:description" content="Expert insights for field service professionals. HVAC tips, warranty management, and best practices." />
        
        {/* JSON-LD Schema */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Blog",
            "name": "FieldTek Blog",
            "description": "Expert insights for field service professionals",
            "url": "https://fieldtek.ai/blog",
            "publisher": {
              "@type": "Organization",
              "name": "FieldTek",
              "url": "https://fieldtek.ai"
            },
            "blogPost": blogPosts.map(post => ({
              "@type": "BlogPosting",
              "headline": post.title,
              "description": post.excerpt,
              "datePublished": post.publishedAt,
              "author": {
                "@type": "Organization",
                "name": post.author
              },
              "url": `https://fieldtek.ai/blog/${post.slug}`
            }))
          })}
        </script>
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />
        
        {/* Hero Section */}
        <section className="py-16 md:py-24 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <Badge variant="secondary" className="mb-4">
                Industry Insights
              </Badge>
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                The FieldTek Blog
              </h1>
              <p className="text-lg text-muted-foreground">
                Expert tips and best practices for HVAC contractors, warranty management, 
                and field service operations.
              </p>
            </div>
          </div>
        </section>

        {/* Category Filter */}
        <section className="py-8 border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <Button
                variant={selectedCategory === 'all' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedCategory('all')}
                className="shrink-0"
              >
                All Posts
              </Button>
              {blogCategories.map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                  className="shrink-0"
                >
                  {category.label}
                </Button>
              ))}
            </div>
          </div>
        </section>

        {/* Posts Grid */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            {sortedPosts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No posts found in this category.</p>
              </div>
            ) : (
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {sortedPosts.map((post, index) => (
                  <Card 
                    key={post.id} 
                    className={cn(
                      "group hover:shadow-lg transition-shadow duration-300",
                      index === 0 && selectedCategory === 'all' && "md:col-span-2 lg:col-span-2"
                    )}
                  >
                    <CardHeader>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                          {post.categoryLabel}
                        </Badge>
                      </div>
                      <CardTitle className="line-clamp-2 group-hover:text-primary transition-colors">
                        <Link to={`/blog/${post.slug}`}>
                          {post.title}
                        </Link>
                      </CardTitle>
                      <CardDescription className={cn(
                        "line-clamp-3",
                        index === 0 && selectedCategory === 'all' && "line-clamp-4"
                      )}>
                        {post.excerpt}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {format(new Date(post.publishedAt), 'MMM d, yyyy')}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {post.readingTime} min read
                          </span>
                        </div>
                        <Link 
                          to={`/blog/${post.slug}`}
                          className="text-primary hover:underline inline-flex items-center gap-1 text-sm font-medium"
                        >
                          Read more
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-primary text-primary-foreground">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Ready to Transform Your Field Service Operations?
            </h2>
            <p className="text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
              Put these best practices into action with FieldTek's all-in-one field service management platform.
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
