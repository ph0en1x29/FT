import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseService';
import type { Job, JobRequest, User } from '../types';
import type { AppNotification } from './notificationHandlers';

interface ChannelCallbacks {
  onNotification: (notification: AppNotification) => void;
  onJobUpdate?: (job: Job) => void;
  onRequestUpdate?: (request: JobRequest) => void;
  onStatusChange: (connected: boolean) => void;
}

export const setupRealtimeChannel = (
  currentUser: User,
  callbacks: ChannelCallbacks
): RealtimeChannel => {
  const channelName = `fieldpro-notifications-${currentUser.user_id}`;
  const channel = supabase.channel(channelName);

  // Subscribe to notifications for this user
  channel.on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${currentUser.user_id}`,
    },
    (payload) => {
      callbacks.onNotification(payload.new as AppNotification);
    }
  );

  // Subscribe to job updates for technicians (when their assigned jobs change)
  if (currentUser.role === 'technician') {
    // Job status/assignment changes
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'jobs',
        filter: `assigned_technician_id=eq.${currentUser.user_id}`,
      },
      (payload) => {
        callbacks.onJobUpdate?.(payload.new as Job);
      }
    );

    // Job request status changes (for requests the technician made)
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'job_requests',
        filter: `requested_by=eq.${currentUser.user_id}`,
      },
      (payload) => {
        callbacks.onRequestUpdate?.(payload.new as JobRequest);
      }
    );

    // Listen for new job assignments (INSERT on jobs where assigned to this tech)
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'jobs',
        filter: `assigned_technician_id=eq.${currentUser.user_id}`,
      },
      (payload) => {
        callbacks.onJobUpdate?.(payload.new as Job);
      }
    );
  }

  // Subscribe to job_requests for admins/supervisors (new requests from technicians)
  if (currentUser.role === 'admin' || currentUser.role === 'supervisor') {
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'job_requests',
      },
      (payload) => {
        callbacks.onRequestUpdate?.(payload.new as JobRequest);
      }
    );

    // Also listen for request status changes (in case another admin handles it)
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'job_requests',
      },
      (payload) => {
        callbacks.onRequestUpdate?.(payload.new as JobRequest);
      }
    );
  }

  // Subscribe and track connection status
  channel.subscribe((status, _error) => {
    if (status === 'SUBSCRIBED') {
      callbacks.onStatusChange(true);
    } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      callbacks.onStatusChange(false);
    }
  });

  return channel;
};

export const removeChannel = (channel: RealtimeChannel) => {
  supabase.removeChannel(channel);
};
