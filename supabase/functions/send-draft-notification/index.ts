/**
 * send-draft-notification — Supabase Edge Function
 *
 * Triggered by a Supabase Database Webhook on draft_picks INSERT.
 * Determines the next player in snake draft order and sends them an SMS
 * via Twilio to let them know it's their turn.
 *
 * Setup:
 *  1. Deploy: npx supabase functions deploy send-draft-notification --project-ref <ref>
 *  2. Set secrets: npx supabase secrets set TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_PHONE_NUMBER=+1...
 *  3. In Supabase Dashboard → Database → Webhooks → Create:
 *       Table: draft_picks | Event: INSERT | URL: <function URL>
 *       Header: Authorization: Bearer <service_role_key>
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!;
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!;
const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER')!;

// The public-facing URL players will tap to reach their draft room.
// Falls back to localhost for local dev — set APP_URL secret in production.
const APP_URL = Deno.env.get('APP_URL') ?? 'http://localhost:5173';

// ---------------------------------------------------------------------------
// Snake draft: given pickNumber (1-indexed) and participantCount, return the
// 1-indexed position in draft_order that should pick next.
// ---------------------------------------------------------------------------
function getPositionForPickNumber(pickNumber: number, participantCount: number): number {
  const zeroIdx = pickNumber - 1;
  const round = Math.floor(zeroIdx / participantCount); // 0-indexed round
  const positionInRound = zeroIdx % participantCount;
  const isEvenRound = round % 2 === 1; // round 0 = odd (1→N), round 1 = even (N→1)
  if (isEvenRound) {
    return participantCount - positionInRound; // reverse
  }
  return positionInRound + 1; // forward
}

// ---------------------------------------------------------------------------
// Send SMS via Twilio REST API (no SDK — plain fetch works in Deno Edge)
// ---------------------------------------------------------------------------
async function sendSMS(to: string, body: string): Promise<void> {
  const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: TWILIO_PHONE_NUMBER,
        To: to,
        Body: body,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio error ${res.status}: ${text}`);
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  // Supabase webhooks send POST with JSON body
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let payload: { record?: Record<string, unknown> };
  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // Supabase webhook payload shape: { type: "INSERT", table: "draft_picks", record: {...}, ... }
  const record = payload.record;
  if (!record) {
    return new Response('No record in payload', { status: 400 });
  }

  const competitionId = record['competition_id'] as string;
  if (!competitionId) {
    return new Response('Missing competition_id', { status: 400 });
  }

  // Use service-role key so we can read user_profiles (RLS bypassed server-side)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // 1. Get draft order for this competition
    const { data: draftOrder, error: orderError } = await supabase
      .from('draft_order')
      .select('user_id, position')
      .eq('competition_id', competitionId)
      .order('position', { ascending: true });

    if (orderError) throw new Error(`draft_order query: ${orderError.message}`);
    if (!draftOrder || draftOrder.length === 0) {
      return new Response('No draft order found', { status: 200 });
    }

    const participantCount = draftOrder.length;
    const totalPicks = participantCount * 3; // 3 rounds

    // 2. Get all picks so far to determine how many have been made
    const { data: picks, error: picksError } = await supabase
      .from('draft_picks')
      .select('pick_number')
      .eq('competition_id', competitionId)
      .order('pick_number', { ascending: true });

    if (picksError) throw new Error(`draft_picks query: ${picksError.message}`);

    const picksMade = picks?.length ?? 0;
    const nextPickNumber = picksMade + 1;

    // 3. Check if draft is complete
    if (nextPickNumber > totalPicks) {
      // Draft is done — notify all participants
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('phone_number')
        .in('id', draftOrder.map((d) => d.user_id));

      const link = `${APP_URL}/competitions/${competitionId}`;
      const message = `🏁 Golf Colors: Your draft is complete! Check out your team and the competition leaderboard.\n👉 ${link}`;

      await Promise.allSettled(
        (profiles ?? [])
          .filter((p) => p.phone_number)
          .map((p) => sendSMS(p.phone_number!, message))
      );

      return new Response('Draft complete notifications sent', { status: 200 });
    }

    // 4. Determine which position picks next
    const nextPosition = getPositionForPickNumber(nextPickNumber, participantCount);
    const nextEntry = draftOrder.find((d) => d.position === nextPosition);
    if (!nextEntry) {
      return new Response('Could not determine next picker', { status: 200 });
    }

    const nextUserId = nextEntry.user_id;

    // 5. Look up their phone number
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('phone_number, display_name')
      .eq('id', nextUserId)
      .single();

    if (profileError) throw new Error(`user_profiles query: ${profileError.message}`);

    if (!profile?.phone_number) {
      // No phone on file — nothing to do
      return new Response('Next player has no phone number — skipping', { status: 200 });
    }

    // 6. Calculate round number for the message
    const round = Math.ceil(nextPickNumber / participantCount);
    const link = `${APP_URL}/competitions/${competitionId}`;
    const name = profile.display_name ?? 'there';
    const message =
      `⛳ Golf Colors: Hey ${name}, it's your turn to pick! ` +
      `Round ${round}, Pick ${nextPickNumber}.\n👉 ${link}`;

    // 7. Send the SMS
    await sendSMS(profile.phone_number, message);

    return new Response('Notification sent', { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('send-draft-notification error:', message);
    // Return 200 so Supabase doesn't retry indefinitely on unexpected errors
    return new Response(`Error: ${message}`, { status: 200 });
  }
});
