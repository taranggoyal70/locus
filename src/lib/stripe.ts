import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function stripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  _stripe = new Stripe(key, { apiVersion: "2026-06-24.dahlia" });
  return _stripe;
}

export const PLANS = {
  free: { name: "Free", priceId: null },
  pro: { name: "Pro", priceId: process.env.STRIPE_PRO_PRICE_ID ?? "" },
} as const;
