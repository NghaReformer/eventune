/**
 * Stripe Webhook Handler
 * Supabase Edge Function
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

// Verify Stripe webhook signature
async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const elements = signature.split(",").reduce(
    (acc, item) => {
      const [key, value] = item.split("=");
      if (key && value) {
        if (!acc[key]) acc[key] = [];
        acc[key].push(value);
      }
      return acc;
    },
    {} as Record<string, string[]>
  );

  const timestamp = elements["t"]?.[0];
  const signatures = elements["v1"] ?? [];

  if (!timestamp || signatures.length === 0) {
    return false;
  }

  // Check timestamp tolerance (2 minutes for production security)
  const timestampNum = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  const tolerance = 120; // 2 minutes

  // Only accept past timestamps within tolerance (reject future timestamps)
  if (timestampNum > now) {
    console.warn('Webhook from future rejected', { timestamp: timestampNum, now });
    return false;
  }

  if ((now - timestampNum) > tolerance) {
    console.warn('Webhook timestamp too old', { timestamp: timestampNum, now, age: now - timestampNum });
    return false;
  }

  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const expectedSig = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison
  for (const providedSig of signatures) {
    if (providedSig.length === expectedSig.length) {
      let match = true;
      for (let i = 0; i < providedSig.length; i++) {
        if (providedSig[i] !== expectedSig[i]) match = false;
      }
      if (match) return true;
    }
  }

  return false;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const signature = req.headers.get("stripe-signature");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!signature || !webhookSecret) {
      return new Response(
        JSON.stringify({ error: "Missing signature or webhook secret" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.text();

    // Verify signature
    const isValid = await verifyStripeSignature(body, signature, webhookSecret);
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const event = JSON.parse(body);

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Log the event
    const idempotencyKey = `stripe:${event.type}:${event.id}`;

    // Check for duplicate
    const { data: existingEvent } = await supabase
      .from("payment_events")
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .single();

    if (existingEvent) {
      return new Response(
        JSON.stringify({ received: true, duplicate: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process based on event type
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const orderId = session.metadata?.orderId || session.client_reference_id;

        if (!orderId) {
          console.error("No order ID in session metadata");
          break;
        }

        // Validate amount
        const paidAmount = session.amount_total / 100;
        const { data: order } = await supabase
          .from("orders")
          .select("amount_expected, currency")
          .eq("id", orderId)
          .single();

        if (!order) {
          console.error("Order not found:", orderId);
          break;
        }

        // Allow small tolerance for currency conversion (1% for USD)
        const tolerance = order.currency === "USD" ? 0.01 : 0;
        if (Math.abs(order.amount_expected - paidAmount) > order.amount_expected * tolerance) {
          console.error("Amount mismatch:", { expected: order.amount_expected, got: paidAmount });

          // Log security event
          await supabase.from("security_events").insert({
            event_type: "payment_amount_mismatch",
            severity: "high",
            data: {
              description: `Stripe amount mismatch for order ${orderId}`,
              expected: order.amount_expected,
              actual: paidAmount,
              sessionId: session.id
            },
          });
          break;
        }

        // Update order
        await supabase
          .from("orders")
          .update({
            status: "paid",
            payment_status: "completed",
            payment_reference: session.payment_intent,
            payment_provider: "stripe",
            payment_method: "card",
            amount_paid: paidAmount,
            paid_at: new Date().toISOString(),
            stripe_payment_intent: session.payment_intent,
            stripe_checkout_session: session.id,
          })
          .eq("id", orderId);

        // Log event
        await supabase.from("payment_events").insert({
          order_id: orderId,
          provider: "stripe",
          event_type: event.type,
          provider_reference: session.payment_intent,
          amount: paidAmount,
          currency: session.currency?.toUpperCase(),
          raw_payload: event.data.object,
        });

        break;
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object;
        const orderId = intent.metadata?.orderId;

        if (orderId) {
          await supabase
            .from("orders")
            .update({ payment_status: "failed" })
            .eq("id", orderId);

          await supabase.from("payment_events").insert({
            order_id: orderId,
            provider: "stripe",
            event_type: event.type,
            provider_reference: intent.id,
            failure_reason: intent.last_payment_error?.message,
            raw_payload: event.data.object,
          });
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object;
        const orderId = charge.metadata?.orderId;

        if (orderId) {
          const refundStatus = charge.refunded ? "refunded" : "partially_refunded";
          const refundAmount = charge.amount_refunded / 100;

          await supabase
            .from("orders")
            .update({
              payment_status: refundStatus,
              refund_status: refundStatus === "refunded" ? "processed" : "approved",
              refund_amount: refundAmount,
              refunded_at: new Date().toISOString(),
            })
            .eq("id", orderId);

          await supabase.from("payment_events").insert({
            order_id: orderId,
            provider: "stripe",
            event_type: event.type,
            provider_reference: charge.id,
            amount: refundAmount,
            currency: charge.currency?.toUpperCase(),
            raw_payload: event.data.object,
          });
        }
        break;
      }

      default:
        console.log("Unhandled event type:", event.type);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Webhook processing failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
