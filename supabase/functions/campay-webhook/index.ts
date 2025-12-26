/**
 * CamPay Webhook Handler
 * Supabase Edge Function
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Verify CamPay webhook signature
async function verifyCamPaySignature(
  data: { reference: string; amount: number; status: string },
  signature: string,
  secret: string
): Promise<boolean> {
  const message = `${data.reference}${data.amount}${data.status}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  const expectedSig = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison
  if (signature.length !== expectedSig.length) return false;
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  }
  return result === 0;
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
    const webhookSecret = Deno.env.get("CAMPAY_WEBHOOK_SECRET");

    if (!webhookSecret) {
      return new Response(
        JSON.stringify({ error: "Missing webhook secret" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.text();
    let data: {
      reference: string;
      status: "SUCCESSFUL" | "FAILED";
      amount: number;
      currency: string;
      code: string;
      operator: string;
      operator_reference?: string;
      signature: string;
      external_reference?: string;
    };

    try {
      data = JSON.parse(body);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify signature
    const isValid = await verifyCamPaySignature(
      { reference: data.reference, amount: data.amount, status: data.status },
      data.signature,
      webhookSecret
    );

    if (!isValid) {
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // The external_reference is our order ID
    const orderId = data.external_reference;

    // Validate order ID format (UUID)
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!orderId || !UUID_REGEX.test(orderId)) {
      console.error("Invalid or missing order ID:", orderId);
      return new Response(
        JSON.stringify({ error: "Invalid order ID format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create idempotency key
    const idempotencyKey = `campay:${data.status.toLowerCase()}:${data.reference}`;

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

    // Get order to validate amount and verify provider
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("amount_expected, currency, payment_provider")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      console.error("Order not found:", orderId, orderError);
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify this is a CamPay order (if provider already set)
    if (order.payment_provider && order.payment_provider !== "campay") {
      console.error("Provider mismatch:", { expected: "campay", got: order.payment_provider });
      await supabase.from("security_events").insert({
        event_type: "webhook_provider_mismatch",
        severity: "high",
        data: {
          description: `CamPay webhook for ${order.payment_provider} order`,
          orderId,
          reference: data.reference,
        },
      });
      return new Response(
        JSON.stringify({ error: "Provider mismatch" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate amount (XAF has no decimals, exact match required)
    if (order.amount_expected !== data.amount) {
      console.error("Amount mismatch:", { expected: order.amount_expected, got: data.amount });

      // Log security event
      await supabase.from("security_events").insert({
        event_type: "payment_amount_mismatch",
        severity: "high",
        data: {
          description: `CamPay amount mismatch for order ${orderId}`,
          expected: order.amount_expected,
          actual: data.amount,
          reference: data.reference,
        },
      });

      return new Response(
        JSON.stringify({ error: "Amount mismatch" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine payment method
    const paymentMethod = data.operator.toLowerCase().includes("mtn")
      ? "mtn_momo"
      : "orange_money";

    // Process based on status
    if (data.status === "SUCCESSFUL") {
      // Update order
      await supabase
        .from("orders")
        .update({
          status: "paid",
          payment_status: "completed",
          payment_reference: data.operator_reference || data.reference,
          payment_provider: "campay",
          payment_method: paymentMethod,
          amount_paid: data.amount,
          paid_at: new Date().toISOString(),
          campay_reference: data.reference,
          campay_operator: data.operator,
        })
        .eq("id", orderId);
    } else if (data.status === "FAILED") {
      await supabase
        .from("orders")
        .update({ payment_status: "failed" })
        .eq("id", orderId);
    }

    // Log event
    await supabase.from("payment_events").insert({
      order_id: orderId,
      provider: "campay",
      event_type: `payment.${data.status.toLowerCase()}`,
      provider_reference: data.reference,
      amount: data.amount,
      currency: data.currency,
      raw_payload: data,
    });

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
