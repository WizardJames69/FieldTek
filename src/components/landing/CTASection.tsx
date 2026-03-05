import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

interface CTASectionProps {
  onJoinWaitlist?: () => void;
}

export function CTASection({ onJoinWaitlist }: CTASectionProps) {
  return (
    <section className="landing-section-dark py-16 md:py-24 lg:py-32">
      <div className="mx-auto max-w-4xl px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.15] mb-4">
            Ready to eliminate callbacks?
          </h2>
          <p className="text-lg text-zinc-400 mb-10 max-w-2xl mx-auto">
            Join the contractors who are using AI to guide installs, protect warranties,
            and build documentation that holds up to any inspection.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
            <Button
              asChild
              size="lg"
              className="bg-orange-500 hover:bg-orange-600 text-white text-lg px-8 py-6 border-0 hover:shadow-[0_0_20px_rgba(249,115,22,0.2)] transition-shadow"
            >
              <Link to="/auth">
                Get Early Access
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="text-lg px-8 py-6 border-zinc-700 text-zinc-300 hover:text-white hover:bg-white/5 hover:border-zinc-600"
              onClick={onJoinWaitlist}
            >
              Join Waitlist
            </Button>
          </div>

          <p className="text-sm text-zinc-500">
            No credit card required. Setup in under 10 minutes.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
