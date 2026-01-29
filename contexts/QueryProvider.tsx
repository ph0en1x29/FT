/**
 * React Query Provider
 * 
 * Provides caching, deduplication, and background refetching for API calls.
 * This dramatically reduces redundant API calls across components.
 */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a client with sensible defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 30 seconds
      staleTime: 30 * 1000,
      
      // Keep data in cache for 5 minutes
      gcTime: 5 * 60 * 1000,
      
      // Retry failed requests once
      retry: 1,
      
      // Don't refetch on window focus by default (can be noisy)
      refetchOnWindowFocus: false,
      
      // Refetch when reconnecting
      refetchOnReconnect: true,
    },
  },
});

interface QueryProviderProps {
  children: React.ReactNode;
}

export const QueryProvider: React.FC<QueryProviderProps> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

// Export the client for use in prefetching
export { queryClient };

export default QueryProvider;
