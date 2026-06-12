import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// VAPID public key - this should match the private key in the edge function
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

export interface PushNotificationState {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission | 'unsupported';
  isLoading: boolean;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// The Workbox service worker (registered at startup in main.tsx, scope '/',
// push handlers imported from sw-push.js) is the single registration this hook
// uses. navigator.serviceWorker.ready never settles when no SW registers
// (blocked, unsupported, registration failed), so cap the wait instead of
// hanging subscribe/unsubscribe forever.
async function getReadyRegistration(timeoutMs = 5000): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration('/');
    if (existing?.active) return existing;
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
  } catch (e) {
    console.error('Error getting service worker registration:', e);
    return null;
  }
}

export function usePushNotifications() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isSubscribed: false,
    permission: 'unsupported',
    isLoading: true,
  });

  // Check if push is supported
  const isSupported = typeof window !== 'undefined' && 
    'serviceWorker' in navigator && 
    'PushManager' in window &&
    'Notification' in window;

  // Check current subscription status
  const { data: existingSubscription, isLoading: isCheckingSubscription } = useQuery({
    queryKey: ['push-subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      
      return data;
    },
    enabled: !!user?.id && isSupported,
  });

  // Update state when data changes
  useEffect(() => {
    const updateState = async () => {
      if (!isSupported) {
        setState({
          isSupported: false,
          isSubscribed: false,
          permission: 'unsupported',
          isLoading: false,
        });
        return;
      }

      const permission = Notification.permission;
      
      // Check if we have an active subscription in the browser
      let browserSubscribed = false;
      try {
        const registration = await getReadyRegistration();
        const subscription = await (registration as any)?.pushManager?.getSubscription();
        browserSubscribed = !!subscription;
      } catch (e) {
        console.error('Error checking push subscription:', e);
      }

      setState({
        isSupported: true,
        isSubscribed: browserSubscribed && !!existingSubscription,
        permission,
        isLoading: isCheckingSubscription,
      });
    };

    updateState();
  }, [isSupported, existingSubscription, isCheckingSubscription]);

  // Subscribe to push notifications
  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !tenant?.id) {
        throw new Error('User or tenant not found');
      }

      if (!VAPID_PUBLIC_KEY) {
        throw new Error('VAPID public key not configured');
      }

      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      // The Workbox SW is registered at app startup (main.tsx)
      const registration = await getReadyRegistration();
      if (!registration) {
        throw new Error('Service worker not ready — reload the app and try again');
      }

      // Subscribe to push
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const subscription = await (registration as any).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });

      const subscriptionJson = subscription.toJSON();
      
      // Save to database
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          tenant_id: tenant.id,
          endpoint: subscriptionJson.endpoint!,
          p256dh_key: subscriptionJson.keys!.p256dh,
          auth_key: subscriptionJson.keys!.auth,
          user_agent: navigator.userAgent,
        }, {
          onConflict: 'user_id,endpoint'
        });

      if (error) throw error;

      return subscription;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['push-subscription'] });
      toast.success('Push notifications enabled');
    },
    onError: (error: Error) => {
      console.error('Failed to subscribe:', error);
      toast.error(error.message || 'Failed to enable push notifications');
    },
  });

  // Unsubscribe from push notifications
  const unsubscribeMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('User not found');

      // Unsubscribe from browser (skip silently if no SW registration is available)
      try {
        const registration = await getReadyRegistration();
        const subscription = await (registration as any)?.pushManager?.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
        }
      } catch (e) {
        console.error('Error unsubscribing from browser:', e);
      }

      // Remove from database
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['push-subscription'] });
      toast.success('Push notifications disabled');
    },
    onError: (error: Error) => {
      console.error('Failed to unsubscribe:', error);
      toast.error('Failed to disable push notifications');
    },
  });

  return {
    ...state,
    subscribe: subscribeMutation.mutate,
    unsubscribe: unsubscribeMutation.mutate,
    isSubscribing: subscribeMutation.isPending,
    isUnsubscribing: unsubscribeMutation.isPending,
  };
}
