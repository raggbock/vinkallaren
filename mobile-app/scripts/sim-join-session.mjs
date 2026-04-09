#!/usr/bin/env node
/**
 * Simulate guests joining a tasting session.
 *
 * Usage:
 *   node scripts/sim-join-session.mjs <join-code> [guest-count]
 *
 * Creates anonymous Supabase users with Swedish names,
 * sets their display_name, and joins the given session.
 * Outputs a JSON file with user credentials for sim-taste-wines.mjs.
 */

import { supabase } from "./lib/supabase-client.mjs";

const GUEST_NAMES = [
  "Anna", "Erik", "Maja", "Lars", "Sofia", "Nils",
  "Karin", "Oskar", "Linnéa", "Gustav", "Astrid", "Hugo",
  "Elsa", "Axel", "Freja", "Emil", "Saga", "Viktor",
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function pickRandom(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

const joinCode = process.argv[2];
const guestCount = Math.min(parseInt(process.argv[3] || "5", 10), GUEST_NAMES.length);

if (!joinCode) {
  console.error("Usage: node scripts/sim-join-session.mjs <join-code> [guest-count]");
  process.exit(1);
}

const names = pickRandom(GUEST_NAMES, guestCount);
const guests = [];

console.log(`\n🍷 Simulerar ${guestCount} gäster som går med i provning ${joinCode}\n`);

for (const name of names) {
  // Create anonymous user
  const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
  if (authError) {
    console.error(`  ✗ Kunde inte skapa gäst: ${authError.message}`);
    continue;
  }

  const userId = authData.user.id;
  const accessToken = authData.session.access_token;
  const refreshToken = authData.session.refresh_token;

  // Set display name + avatar color
  const hue = ((Math.abs(userId.split("").reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0)) % 60) + 330) % 360;
  const avatarColor = `hsl(${hue}, 45%, 35%)`;

  await supabase
    .from("profiles")
    .update({ display_name: name, avatar_color: avatarColor })
    .eq("id", userId);

  // Join the session via RPC
  const { data: session, error: joinError } = await supabase.rpc("join_session_by_code", {
    code: joinCode.toUpperCase(),
  });

  if (joinError || session?.error) {
    console.error(`  ✗ ${name} kunde inte gå med: ${joinError?.message || session?.error}`);
    continue;
  }

  guests.push({ userId, name, accessToken, refreshToken, sessionId: session.id });
  console.log(`  ✓ ${name} gick med (${userId.slice(0, 8)}…)`);

  // Stagger joins 1-3 seconds apart
  const delay = 1000 + Math.random() * 2000;
  await sleep(delay);
}

// Save credentials for the tasting script
const outPath = `sim-guests-${joinCode}.json`;
const fs = await import("node:fs");
fs.writeFileSync(outPath, JSON.stringify(guests, null, 2));

console.log(`\n✅ ${guests.length} gäster anslutna. Sparade credentials till ${outPath}`);
console.log(`   Kör: node scripts/sim-taste-wines.mjs ${outPath}\n`);
