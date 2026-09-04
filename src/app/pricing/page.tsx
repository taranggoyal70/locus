import { selfServeOpen } from "@/lib/admission";
import { PricingContent } from "@/components/PricingContent";

/**
 * A server shell over a client body.
 *
 * The body needs `useState` for the access form, and the heading needs
 * LOCUS_SELF_SERVE, which is not a NEXT_PUBLIC_ variable and therefore reads as
 * undefined inside a client bundle. Left as one client page, the heading would
 * have silently rendered "Agent Runs are invite-gated" forever, including on a
 * fully open deployment - wrong with no error anywhere to say so.
 */
export default function PricingPage() {
  return <PricingContent selfServeOpen={selfServeOpen()} />;
}
