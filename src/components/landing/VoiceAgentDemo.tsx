import React, { useState, useCallback, memo, Suspense, lazy } from 'react';
import { motion } from 'framer-motion';
import { Mic, Phone, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load the actual voice agent to handle SDK loading
const VoiceAgentCore = lazy(() => import('./VoiceAgentCore').then(m => ({ default: m.VoiceAgentCore })));

function VoiceAgentFallback() {
  return (
    <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
      <div className="flex items-center justify-center gap-2 mb-6">
        <Skeleton className="w-3 h-3 rounded-full" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="flex items-center justify-center mb-8">
        <Skeleton className="w-32 h-32 rounded-full" />
      </div>
      <div className="flex justify-center">
        <Skeleton className="h-11 w-44" />
      </div>
    </div>
  );
}

export const VoiceAgentDemo = memo(function VoiceAgentDemo() {
  return (
    <section className="py-24 bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
            Talk to Our AI Field Assistant
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Experience real-time voice conversations with our AI assistant trained on HVAC equipment documentation. 
            Get instant answers about troubleshooting, specifications, and more.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="max-w-md mx-auto"
        >
          <Suspense fallback={<VoiceAgentFallback />}>
            <VoiceAgentCore />
          </Suspense>
        </motion.div>
      </div>
    </section>
  );
});
