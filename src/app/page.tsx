/**
 * Cutting-edge marketing landing page for FrameVault with immersive hero,
 * interactive features, and smooth scroll animations.
 */

import Link from "next/link";
import { Clapperboard, Wand2, Sparkles, Film, Heart, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Interactive feature showcases with hover animations and modern design.
 */
const featureSections = [
  {
    icon: Film,
    gradient: "from-accent-primary to-accent-secondary",
    eyebrow: "Cinematic Collections",
    title: "Curate Your Vision",
    description:
      "Transform your movie discoveries into beautiful, themed collections that tell your unique story through cinema.",
    highlights: [
      "Rich editorial notes and descriptions",
      "Drag-and-drop organization",
      "Unlimited creativity with Plus & Pro",
    ],
    visual: "🎬",
  },
  {
    icon: Sparkles,
    gradient: "from-accent-secondary to-accent-tertiary",
    eyebrow: "Smart Discovery",
    title: "AI-Powered Recommendations",
    description:
      "Let our intelligent system learn your taste and suggest films you'll love, powered by your viewing history.",
    highlights: [
      "Personalized smart picks",
      "Taste profile analysis",
      "Discover hidden gems",
    ],
    visual: "✨",
  },
  {
    icon: Share2,
    gradient: "from-accent-tertiary to-accent-primary",
    eyebrow: "Social Showcases",
    title: "Share Your Collections",
    description:
      "Publish stunning, responsive collection pages that showcase your cinematic taste to the world.",
    highlights: [
      "Beautiful public showcases",
      "SEO-optimized sharing",
      "Real-time updates",
    ],
    visual: "🌟",
  },
];

/**
 * Snapshot view of pricing tiers used both on the homepage and standalone pricing page.
 */
const pricingSnapshot = [
  {
    name: "Free",
    price: "$0",
    highlight: "5 collections, forever",
  },
  {
    name: "Plus",
    price: "$4.99",
    highlight: "Unlimited shelves + customization",
  },
  {
    name: "Pro",
    price: "$9.99",
    highlight: "For collaborators and power users",
  },
];

/**
 * Cutting-edge landing page with immersive animations and modern design.
 */
export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Animated Background Layers */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background-secondary to-background animate-float" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent-primary/10 rounded-full blur-3xl animate-glow" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent-secondary/10 rounded-full blur-3xl animate-glow" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-accent-tertiary/5 rounded-full blur-2xl animate-float" style={{ animationDelay: '1s' }} />
      </div>

      {/* Navigation */}
      <nav className="relative z-50 flex items-center justify-between p-6 lg:p-8">
        <Link href="/" className="text-2xl font-bold text-gradient hover:scale-105 transition-transform">
          FrameVault
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/pricing" className="text-text-secondary hover:text-text-primary transition-colors">
            Pricing
          </Link>
          <Button asChild variant="glass" size="sm">
            <Link href="/auth/sign-in">Sign in</Link>
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative px-6 lg:px-8 py-20 lg:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="text-center space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full animate-float">
              <Wand2 className="w-4 h-4 text-accent-primary" />
              <span className="text-sm font-medium text-text-secondary">Next-Gen Movie Curation</span>
            </div>

            {/* Headline */}
            <div className="space-y-4">
              <h1 className="text-gradient leading-tight">
                Curate Your
                <span className="block">Cinematic Universe</span>
              </h1>
              <p className="text-lead max-w-3xl mx-auto">
                Transform your movie discoveries into stunning collections. Share your taste,
                discover hidden gems, and build your personal film library with cutting-edge design.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/auth/sign-in"
                className="inline-flex h-14 px-8 text-base font-semibold items-center justify-center gap-2 rounded-xl font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/50 disabled:pointer-events-none disabled:opacity-50 relative overflow-hidden bg-gradient-to-r from-accent-primary via-accent-secondary to-accent-tertiary text-white hover:!text-[#0a0a0f] shadow-[0_4px_20px_rgba(139,92,246,0.3)] hover:shadow-[0_8px_32px_rgba(139,92,246,0.4)] hover:scale-105 active:scale-95 before:absolute before:inset-0 before:bg-white/10 before:opacity-0 hover:before:opacity-100 before:transition-opacity cursor-pointer"
              >
                Start Curating Free
              </Link>
              <Button asChild variant="outline" size="lg">
                <Link href="/pricing">Explore Plans</Link>
              </Button>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-text-tertiary pt-8">
              <div className="flex items-center gap-2">
                <Clapperboard className="w-4 h-4 text-accent-secondary" />
                <span>TMDB Powered</span>
              </div>
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-accent-tertiary" />
                <span>AI Recommendations</span>
              </div>
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-accent-primary" />
                <span>Public Sharing</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative px-6 lg:px-8 py-20 lg:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-gradient">Experience Cinema Like Never Before</h2>
            <p className="text-lead max-w-2xl mx-auto">
              From smart discovery to beautiful showcases, FrameVault reimagines how you interact with movies.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {featureSections.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <article
                  key={feature.title}
                  className="group glass-card p-8 rounded-3xl hover:scale-105 transition-all duration-500 cursor-pointer"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className={`inline-flex p-3 rounded-2xl bg-gradient-to-r ${feature.gradient} mb-6`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-label text-accent-primary mb-2">{feature.eyebrow}</p>
                      <h3 className="text-xl font-semibold text-text-primary group-hover:text-gradient transition-all">
                        {feature.title}
                      </h3>
                    </div>

                    <p className="text-text-secondary leading-relaxed">{feature.description}</p>

                    <ul className="space-y-2">
                      {feature.highlights.map((highlight, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm text-text-tertiary">
                          <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${feature.gradient}`} />
                          {highlight}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="absolute top-4 right-4 text-2xl opacity-10 group-hover:opacity-20 transition-opacity">
                    {feature.visual}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="relative px-6 lg:px-8 py-20 lg:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="glass-card rounded-3xl p-12 lg:p-16">
            <div className="text-center space-y-8">
              <div>
                <h2 className="text-gradient mb-4">Start Free, Scale Your Collection</h2>
                <p className="text-lead max-w-2xl mx-auto">
                  Begin with 5 collections, upgrade to unlimited creativity with Plus, or go Pro for AI-powered discovery.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                {pricingSnapshot.map((tier, index) => (
                  <div
                    key={tier.name}
                    className={`glass p-6 rounded-2xl text-center hover:scale-105 transition-all duration-300 ${
                      tier.name === 'Plus' ? 'ring-2 ring-accent-primary/50' : ''
                    }`}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <h3 className="text-label mb-2">{tier.name}</h3>
                    <div className="text-3xl font-bold text-text-primary mb-2">{tier.price}</div>
                    <p className="text-sm text-text-tertiary">{tier.highlight}</p>
                  </div>
                ))}
              </div>

              <Link
                href="/pricing"
                className="inline-flex h-14 px-8 text-base font-semibold items-center justify-center gap-2 rounded-xl font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/50 disabled:pointer-events-none disabled:opacity-50 relative overflow-hidden bg-gradient-to-r from-accent-secondary via-accent-tertiary to-accent-primary text-white hover:!text-[#0a0a0f] shadow-[0_4px_20px_rgba(6,182,212,0.3)] hover:shadow-[0_8px_32px_rgba(6,182,212,0.4)] hover:scale-105 active:scale-95 before:absolute before:inset-0 before:bg-white/10 before:opacity-0 hover:before:opacity-100 before:transition-opacity"
              >
                View All Features
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
