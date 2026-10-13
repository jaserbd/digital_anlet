import { createContext, useContext, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthenticatedUserDto } from '@anlet/shared';
import { ApiError } from '../api/client';
import { authApi } from '../api/authApi';

export const ME_QUERY_KEY = ['auth', 'me'];

async function fetchMe(): Promise<AuthenticatedUserDto | null> {
  try {
    return await authApi.me();
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      return null;
    }
    throw err;
  }
}

interface AuthContextValue {
  user: AuthenticatedUserDto | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  // Switches to another organization/role (MULTI_ORG_PLAN.md). Clears every cached query
  // first — much cached data is keyed only by questionnaire code (e.g. "my response to IP FM"),
  // so nothing from the previous organization may be shown under the new one.
  switchContext: (membershipId: string | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const meQuery = useQuery({ queryKey: ME_QUERY_KEY, queryFn: fetchMe });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.login(email, password),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY }),
  });

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => queryClient.setQueryData(ME_QUERY_KEY, null),
  });

  const value: AuthContextValue = {
    user: meQuery.data ?? null,
    isLoading: meQuery.isLoading,
    login: async (email, password) => {
      await loginMutation.mutateAsync({ email, password });
    },
    logout: async () => {
      await logoutMutation.mutateAsync();
    },
    switchContext: async (membershipId) => {
      try {
        await authApi.switchContext(membershipId);
      } finally {
        // Always re-sync with the server, even if the request errored: the session cookie may
        // already have changed, and the screen must never show a different organization than
        // the one the server is acting in. Everything else cached belonged to the previous
        // context and is dropped. The current user is *reset* rather than removed: removing it
        // (queryClient.clear()) detached the mounted useQuery above from the cache, so the
        // refetched user never reached the screen — the app kept the old role/organization
        // while the server already acted in the new one (Home stuck on "Loading…", 403s).
        queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== ME_QUERY_KEY[0] });
        await queryClient.resetQueries({ queryKey: ME_QUERY_KEY });
      }
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
