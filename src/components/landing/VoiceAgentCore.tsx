import React, { useState, useCallback, memo } from 'react';
import { useConversation } from '@elevenlabs/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Phone, PhoneOff, Volume2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const VoiceAgentCore = memo(function VoiceAgentCore() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const conversation = useConversation({
    onConnect: () => {
      console.log('Connected to ElevenLabs agent');
      setErrorMessage(null);
    },
    onDisconnect: () => {
      console.log('Disconnected from ElevenLabs agent');
    },
    onMessage: (message) => {
      console.log('Message from agent:', message);
    },
    onError: (error) => {
      console.error('Conversation error:', error);
      setErrorMessage('Connection error. Please try again.');
      toast.error('Voice agent connection error');
    },
  });

  const startConversation = useCallback(async () => {
    setIsConnecting(true);
    setErrorMessage(null);

    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get token from edge function
      const { data, error } = await supabase.functions.invoke('elevenlabs-conversation-token');

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to get conversation token');
      }

      if (!data?.token) {
        throw new Error('No token received from server');
      }

      // Start the conversation with WebRTC
      await conversation.startSession({
        conversationToken: data.token,
        connectionType: 'webrtc',
      });
    } catch (error) {
      console.error('Failed to start conversation:', error);
      const message = error instanceof Error ? error.message : 'Failed to connect';
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsConnecting(false);
    }
  }, [conversation]);

  const stopConversation = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  const isConnected = conversation.status === 'connected';
  const isSpeaking = conversation.isSpeaking;

  return (
    <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
      {/* Status indicator */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <div 
          className={`w-3 h-3 rounded-full ${
            isConnected 
              ? isSpeaking 
                ? 'bg-primary animate-pulse' 
                : 'bg-green-500' 
              : 'bg-muted-foreground'
          }`} 
        />
        <span className="text-sm text-muted-foreground">
          {isConnected 
            ? isSpeaking 
              ? 'AI is speaking...' 
              : 'Listening...'
            : 'Ready to connect'}
        </span>
      </div>

      {/* Voice visualization */}
      <div className="flex items-center justify-center mb-8">
        <div className={`relative w-32 h-32 rounded-full flex items-center justify-center ${
          isConnected 
            ? 'bg-primary/10' 
            : 'bg-muted'
        }`}>
          <AnimatePresence mode="wait">
            {isConnected ? (
              <motion.div
                key="connected"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="relative"
              >
                {/* Pulse rings when speaking */}
                {isSpeaking && (
                  <>
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-primary"
                      animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-primary"
                      animate={{ scale: [1, 1.8, 1], opacity: [0.3, 0, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                    />
                  </>
                )}
                <Volume2 className="w-12 h-12 text-primary" />
              </motion.div>
            ) : (
              <motion.div
                key="disconnected"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Mic className="w-12 h-12 text-muted-foreground" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Error message */}
      {errorMessage && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-destructive text-center mb-4"
        >
          {errorMessage}
        </motion.p>
      )}

      {/* Action button */}
      <div className="flex justify-center">
        {isConnected ? (
          <Button
            variant="destructive"
            size="lg"
            onClick={stopConversation}
            className="gap-2"
          >
            <PhoneOff className="w-5 h-5" />
            End Conversation
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={startConversation}
            disabled={isConnecting}
            className="gap-2"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Phone className="w-5 h-5" />
                Start Conversation
              </>
            )}
          </Button>
        )}
      </div>

      {/* Instructions */}
      <p className="text-xs text-muted-foreground text-center mt-6">
        Click to start, then speak naturally. Ask about HVAC troubleshooting, 
        equipment specs, or maintenance procedures.
      </p>
    </div>
  );
});
