import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}

const nonce = Date.now();
const email = `clutch-flow-${nonce}@example.com`;
const password = `Clutch!${nonce}`;
const fullName = `Clutch Flow ${nonce}`;
const ticketCode = `FLOW-${String(nonce).slice(-8)}`;
const teamCode = `T${String(nonce).slice(-4)}`;

const supabase = createClient(url, anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function fail(message, error) {
  console.error(message);
  if (error) {
    console.error(error.message ?? error);
  }
  process.exit(1);
}

console.log("Creating test user...");
const signUpResult = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: { full_name: fullName },
  },
});

if (signUpResult.error) {
  fail("Signup failed.", signUpResult.error);
}

const user = signUpResult.data.user;
const session = signUpResult.data.session;

if (!user) {
  fail("Signup did not return a user object.");
}

console.log(`User created: ${user.id}`);

if (!session) {
  console.error("Signup succeeded, but no session was issued.");
  console.error("Your Supabase project likely requires email confirmation before sign-in.");
  console.error("Automated write verification cannot continue until confirmations are disabled or a confirmed test account is used.");
  process.exit(2);
}

const authed = createClient(url, anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  global: {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  },
});

console.log("Checking live table access...");
const [betsProbe, bankrollProbe, watchlistProbe] = await Promise.all([
  authed.from("bets").select("id", { count: "exact", head: true }),
  authed.from("bankroll_snapshots").select("id", { count: "exact", head: true }),
  authed.from("watchlist_teams").select("id", { count: "exact", head: true }),
]);

for (const probe of [betsProbe, bankrollProbe, watchlistProbe]) {
  if (probe.error) {
    fail("Schema probe failed. Run the latest supabase/schema.sql in your Supabase project.", probe.error);
  }
}

console.log("Inserting test bet...");
const betInsert = await authed.from("bets").insert({
  user_id: user.id,
  ticket_code: ticketCode,
  placed_at: new Date().toISOString(),
  sport: "NBA",
  market: "Lakers ML",
  odds_american: 135,
  stake: 25,
  to_win: 33.75,
  book: "DraftKings",
  status: "pending",
  result: 0,
});

if (betInsert.error) {
  fail("Bet insert failed.", betInsert.error);
}

console.log("Inserting test watchlist team...");
const watchlistInsert = await authed.from("watchlist_teams").insert({
  user_id: user.id,
  code: teamCode,
  league: "NBA",
  name: "Flow Test Team",
  record: "0-0",
  form: ["win", "loss", "win"],
  reliability: 61,
});

if (watchlistInsert.error) {
  fail("Watchlist insert failed.", watchlistInsert.error);
}

console.log("Reading back inserted records...");
const [betRead, watchlistRead, dashboardBets, dashboardBankroll, dashboardWatchlist] = await Promise.all([
  authed.from("bets").select("ticket_code,market,status").eq("user_id", user.id).eq("ticket_code", ticketCode).single(),
  authed.from("watchlist_teams").select("code,name,reliability").eq("user_id", user.id).eq("code", teamCode).single(),
  authed.from("bets").select("id,ticket_code,placed_at,sport,market,odds_american,stake,to_win,book,status,result").eq("user_id", user.id),
  authed.from("bankroll_snapshots").select("id,snapshot_date,value").eq("user_id", user.id),
  authed.from("watchlist_teams").select("id,code,league,name,record,form,reliability").eq("user_id", user.id),
]);

for (const result of [betRead, watchlistRead, dashboardBets, dashboardBankroll, dashboardWatchlist]) {
  if (result.error) {
    fail("Read-back verification failed.", result.error);
  }
}

console.log("Cleaning up inserted rows...");
await Promise.all([
  authed.from("bets").delete().eq("user_id", user.id).eq("ticket_code", ticketCode),
  authed.from("watchlist_teams").delete().eq("user_id", user.id).eq("code", teamCode),
]);

console.log("Flow verified successfully.");
console.log(`Signup: ok (${email})`);
console.log(`Bet create/read: ok (${betRead.data.ticket_code})`);
console.log(`Watchlist create/read: ok (${watchlistRead.data.code})`);
console.log(`Dashboard query shape: bets=${dashboardBets.data.length}, bankroll=${dashboardBankroll.data.length}, watchlist=${dashboardWatchlist.data.length}`);
