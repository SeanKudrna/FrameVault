/**
 * Stripe client factory. Lazily initialises the SDK using the configured secret
 * key so server actions and route handlers can process billing flows without
 * repeatedly constructing a new client.
 */

import Stripe from "stripe";
import { getServerEnv } from "@/env";

let stripeClient: Stripe | null = null;

/**
 * Returns a configured Stripe instance. Throws when billing environment
 * variables are missing to surface misconfiguration early during requests.
 */
export function getStripeClient() {
  if (stripeClient) return stripeClient;
  const { STRIPE_SECRET_KEY } = getServerEnv();
  if (!STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  stripeClient = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2024-06-20",
    appInfo: {
      name: "FrameVault",
    },
  });

  return stripeClient;
}
