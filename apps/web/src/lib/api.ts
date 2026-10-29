/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { supabase } from "./supabase";

import type { AppRouter } from "@diffusionstudio/api-contract";

/** Upstream's hosted API client. PlusMotion has no such service, so calls through it fail until the generation
 * features that use it are moved onto provider adapters. */
export const api = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${import.meta.env.VITE_API_URL ?? ""}/api/v2/trpc`,
      async headers() {
        const session = await supabase?.auth.getSession();
        const token = session?.data.session?.access_token;
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});
