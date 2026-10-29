/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import {
  createContext,
  createResource,
  createSignal,
  onMount,
  useContext,
  type Accessor,
  type JSX,
} from 'solid-js';
import type { Session, User } from '@supabase/supabase-js';

import { accountService, type LicenceView } from './plusmotion-account';
import { assert } from '@/utils';

type OAuthProvider = 'google' | 'apple' | 'github';
// The editor's old dashboard views still type plans with the upstream names; they are replaced in the rebrand pass.
type Plan = import('@diffusionstudio/api-contract').Plan;
const PLAN_MAP: Record<LicenceView['plan'], Plan> = { free: 'free', pro: 'pro', team: 'max', owner: 'max' };

// PlusMotion: this context keeps the shape the editor already consumes, but is backed by the AccountService seam
// (context/plusmotion-account.ts) instead of a third-party auth and credit service.
type AuthContextValue = {
  session: Accessor<Session | null>;
  user: Accessor<User | null>;
  isAuthenticated: Accessor<boolean>;
  isLoading: Accessor<boolean>;
  plan: Accessor<Plan>;
  licence: Accessor<LicenceView | null>;
  remainingCredits: Accessor<number>;
  creditLimit: Accessor<number>;
  nextCreditReset: Accessor<Date | null>;
  isSubscribed: Accessor<boolean>;
  hasBillingAccount: Accessor<boolean>;
  productUpdatesEnabled: Accessor<boolean>;
  marketingAnnouncementsEnabled: Accessor<boolean>;
  signInWithOAuth: (provider: OAuthProvider) => Promise<void>;
  signInWithOtp: (email: string) => Promise<{ error: string | null }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ error: string | null }>;
  refreshSession: () => Promise<void>;
  refreshAccount: () => void;
};

const AuthContext = createContext<AuthContextValue>();
const NOT_AVAILABLE = 'This sign-in method is not available in PlusMotion.';

export function AuthProvider(props: { children: JSX.Element }) {
  const [isLoading, setIsLoading] = createSignal(true);
  const [state, { refetch }] = createResource(() => accountService.current());
  onMount(() => { void state.latest; });
  const settled = () => { if (!state.loading && isLoading()) setIsLoading(false); return !isLoading(); };

  const user = (): User | null => {
    const u = state.latest?.user;
    if (!u) return null;
    return { id: u.id, email: u.email, app_metadata: {}, user_metadata: { full_name: u.displayName }, aud: 'plusmotion', created_at: '', identities: [] } as User;
  };
  const session = (): Session | null => {
    const u = user();
    return u ? ({ access_token: '', refresh_token: '', expires_in: 0, token_type: 'bearer', user: u } as Session) : null;
  };
  const licence = () => state.latest?.licence ?? null;
  const entitled = () => ['owner', 'valid', 'grace'].includes(licence()?.state ?? '');

  const ctx: AuthContextValue = {
    session,
    user,
    isAuthenticated: () => !!state.latest?.user,
    isLoading: () => !settled() || isLoading(),
    plan: () => PLAN_MAP[licence()?.plan ?? 'free'],
    licence,
    remainingCredits: () => 0,
    creditLimit: () => 0,
    nextCreditReset: () => null,
    isSubscribed: () => entitled() && licence()?.plan !== 'free',
    hasBillingAccount: () => false,
    productUpdatesEnabled: () => false,
    marketingAnnouncementsEnabled: () => false,
    signInWithOAuth: async () => { /* not offered */ },
    signInWithOtp: async () => ({ error: NOT_AVAILABLE }),
    signInWithPassword: async (email, password) => { const r = await accountService.signIn(email, password); await refetch(); return r; },
    signOut: async () => { await accountService.signOut(); await refetch(); },
    deleteAccount: async () => ({ error: 'Account deletion is handled by the PlusMotion account service, which is not configured in this build.' }),
    refreshSession: async () => { await refetch(); },
    refreshAccount: () => { void refetch(); },
  };

  return <AuthContext.Provider value={ctx}>{props.children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  assert(ctx, 'useAuth must be used within AuthProvider');
  return ctx;
}
