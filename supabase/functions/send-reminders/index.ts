// Supabase Edge Function: sends daily workout reminders (web push + optional Resend email).
// Invoked every 15 min by pg_cron. Deploy with: supabase functions deploy send-reminders --no-verify-jwt
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, RESEND_API_KEY, CRON_SECRET
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const env = (k: string) => Deno.env.get(k) ?? "";
webpush.setVapidDetails(env("VAPID_SUBJECT") || "mailto:no-reply@coachsalimheyaime.com", env("VAPID_PUBLIC_KEY"), env("VAPID_PRIVATE_KEY"));
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
const WINDOW_MIN = 15;

function localParts(tz: string, d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: (+p.hour % 24) * 60 + +p.minute };
}

// ---- Reminder copy: edit all reminder text here. Keyed by the user's current streak. ----
const BTN = (label: string) => `<p><a href="https://app.coachsalimheyaime.com" style="display:inline-block;background:#FFC700;color:#000;padding:14px 22px;border-radius:10px;font-weight:bold;text-decoration:none">${label}</a></p>`;
const wrap = (h: string, p: string, btn: string) => `<div style="font-family:Arial,sans-serif;background:#000;color:#fff;padding:28px;border-top:6px solid #FFC700">
<h1 style="color:#FFC700;margin:0 0 8px;text-transform:uppercase">${h}</h1>
<p style="font-size:16px;line-height:1.5">${p}</p>${BTN(btn)}
<p style="color:#999;font-size:12px">Coach Salim · coachsalimheyaime.com<br>Turn off email reminders anytime in the app under the ⏰ button.</p></div>`;
type Txt = string | ((streak: number) => string);
type Copy = { pushTitle: Txt; pushBody: Txt; emailSubject: Txt; emailHtml: Txt };
export const REMINDER_COPY: { day1: Copy; comeback: Copy[]; day2: Copy; day3: Copy; generic: Copy } = {
  // streak 0 and no completed workouts ever: day 1
  day1: {
    pushTitle: "Day 1 starts now 💪",
    pushBody: "Just 7 minutes. Press play and let's move — Coach Salim",
    emailSubject: "Your first 7 minutes are waiting",
    emailHtml: wrap("Day 1 starts now", "Just 7 minutes. No gym, no gear, no excuses. Press play and let's move.<br><br>— Coach Salim", "Start Day 1"),
  },
  // Worked out before, streak 0. Sent only on comeback days (see COMEBACK_DAYS).
  // Every-other-day phase rotates by comeback send count (mod 4); weekly phase always uses the 4th.
  comeback: [
    {
      pushTitle: "Welcome back 👋",
      pushBody: "Missed a day? No problem. 7 minutes today and your streak starts again — Coach Salim",
      emailSubject: "Let's pick it back up today",
      emailHtml: wrap("Welcome back 👋", "Missed a day? That's life, and it doesn't erase the work you've already put in. No guilt, no catching up. Just 7 minutes today and your streak starts again.<br><br>— Coach Salim", "Pick it back up"),
    },
    {
      pushTitle: "Your 7 minutes are still here ⏱️",
      pushBody: "No pressure, no catching up. Just today's workout. I'll be right there with you.",
      emailSubject: "Just 7 minutes today",
      emailHtml: wrap("Your 7 minutes are still here ⏱️", "No pressure and nothing to make up. Just today's workout, one move at a time. Press play and I'll be right there with you.<br><br>— Coach Salim", "Start today's 7 minutes"),
    },
    {
      pushTitle: "Small wins count 💪",
      pushBody: "Something is always better than nothing. Press play, even if it's just a few minutes.",
      emailSubject: "Something is always better than nothing",
      emailHtml: wrap("Small wins count 💪", "You don't have to be perfect to make progress. Something is always better than nothing, so press play, even if it's just a few minutes. Every small win adds up.<br><br>— Coach Salim", "Press play"),
    },
    {
      pushTitle: "Ready when you are 💛",
      pushBody: "Whenever you're ready, your next workout is one tap away. — Coach Salim",
      emailSubject: "Ready when you are",
      emailHtml: wrap("Ready when you are 💛", "Life gets busy, and that's okay. Whenever you're ready, your next workout is one tap away. I'll be here, no judgment, just 7 minutes and a fresh start.<br><br>— Coach Salim", "I'm ready"),
    },
  ],
  // streak 1: worked out yesterday
  day2: {
    pushTitle: "Day 2 — keep it going 🔥",
    pushBody: "You showed up yesterday. Do it again today and you're one day from a 3-day streak.",
    emailSubject: "Day 2: don't break the chain",
    emailHtml: wrap("Day 2: keep it going 🔥", "You showed up yesterday. Do it again today and you're one day from a 3-day streak. Seven minutes. Let's go.<br><br>— Coach Salim", "Start today's workout"),
  },
  // streak 2: today unlocks the first 3-day streak
  day3: {
    pushTitle: "Day 3 — your first streak is today 🏆",
    pushBody: "Two days down. Finish today's 7 minutes and unlock your 3-day streak!",
    emailSubject: "Today you hit your first 3-day streak",
    emailHtml: wrap("Day 3: your first streak is today 🏆", "Two days down. Finish today's 7 minutes and unlock your 3-day streak. You've already done the hard part. Let's finish it.<br><br>— Coach Salim", "Unlock my streak"),
  },
  // streak 3+
  generic: {
    pushTitle: "Time to move 💪",
    pushBody: (s) => `🔥 ${s}-day streak on the line. 7 minutes keeps it alive.`,
    emailSubject: (s) => `🔥 Keep your ${s}-day streak alive`,
    emailHtml: (s) => wrap("Time to move", `Your 7-minute workout is ready. You're on a <b style="color:#FFC700">${s}-day streak</b>. Keep it alive.<br><br>— Coach Salim`, "Start today's workout"),
  },
};
// Days since last workout (d) on which a comeback reminder goes out; after 42, stop until they work out again.
export const COMEBACK_BIWEEKLY_DAYS = [2, 4, 6, 8, 10, 12, 14];
export const COMEBACK_WEEKLY_DAYS = [21, 28, 35, 42];
const v = (t: Txt, streak: number) => (typeof t === "function" ? t(streak) : t);
function render(c: Copy, streak: number) {
  return { pushTitle: v(c.pushTitle, streak), pushBody: v(c.pushBody, streak), emailSubject: v(c.emailSubject, streak), emailHtml: v(c.emailHtml, streak) };
}
function dayDiff(from: string, to: string) {
  return Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86400000);
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== env("CRON_SECRET")) return new Response("forbidden", { status: 403 });
  const { data: prefs, error } = await db.from("workout_prefs").select("*").not("slot", "is", null);
  if (error) return new Response(error.message, { status: 500 });
  let pushed = 0, mailed = 0;
  for (const p of prefs ?? []) {
    if (!p.push_enabled && !p.email_enabled) continue;
    let lp; try { lp = localParts(p.timezone); } catch { lp = localParts("UTC"); }
    const [h, m] = String(p.local_time).split(":").map(Number);
    const target = h * 60 + m;
    if (lp.minutes < target || lp.minutes >= target + WINDOW_MIN) continue;
    if (p.last_sent_date === lp.date) continue;
    // Skip if they already worked out today.
    const { count } = await db.from("day_logs").select("*", { count: "exact", head: true }).eq("user_id", p.user_id).eq("calendar_date", lp.date);
    if (count && count > 0) continue;
    // Once-per-day guard, atomic: only the invocation that flips last_sent_date to today proceeds.
    const { data: claimed } = await db.from("workout_prefs").update({ last_sent_date: lp.date }).eq("user_id", p.user_id)
      .or(`last_sent_date.is.null,last_sent_date.neq.${lp.date}`).select("user_id");
    if (!claimed || claimed.length === 0) continue;
    const { data: st } = await db.from("streaks").select("current_streak,last_workout_date").eq("user_id", p.user_id).maybeSingle();
    // Last workout date: newest of the app's day_logs and the synced streak row (either may lag).
    const { data: lastLog } = await db.from("day_logs").select("calendar_date").eq("user_id", p.user_id).lt("calendar_date", lp.date).order("calendar_date", { ascending: false }).limit(1).maybeSingle();
    const last = [lastLog?.calendar_date, st?.last_workout_date].filter((x): x is string => !!x && x < lp.date).sort().pop() ?? null;
    let copy: ReturnType<typeof render>;
    if (!last) {
      copy = render(REMINDER_COPY.day1, 0); // never worked out: Day 1, daily
    } else {
      const d = dayDiff(last, lp.date);
      if (d === 1) {
        // Worked out yesterday: stored streak is fresh (at least 1).
        const streak = Math.max(1, st?.last_workout_date === last ? st?.current_streak ?? 1 : 1);
        copy = render(streak === 1 ? REMINDER_COPY.day2 : streak === 2 ? REMINDER_COPY.day3 : REMINDER_COPY.generic, streak);
      } else {
        // Streak is 0 with history: comeback schedule only.
        const weekly = COMEBACK_WEEKLY_DAYS.includes(d);
        if (!weekly && !COMEBACK_BIWEEKLY_DAYS.includes(d)) continue; // no reminder today (or schedule finished after d=42)
        const sends = p.comeback_anchor === last ? p.comeback_sends ?? 0 : 0; // reset count after each new workout
        copy = render(REMINDER_COPY.comeback[weekly ? 3 : sends % 4], 0);
        await db.from("workout_prefs").update({ comeback_anchor: last, comeback_sends: sends + 1 }).eq("user_id", p.user_id);
      }
    }
    let delivered = false;
    if (p.push_enabled) {
      const { data: subs } = await db.from("push_subscriptions").select("*").eq("user_id", p.user_id);
      for (const s of subs ?? []) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title: copy.pushTitle, body: copy.pushBody, url: "/" }), { TTL: 3600 });
          pushed++; delivered = true;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    }
    if (p.email_enabled) {
      const { data: u } = await db.auth.admin.getUserById(p.user_id);
      const to = u?.user?.email;
      if (to) {
        const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: "Coach Salim <no-reply@coachsalimheyaime.com>", to, subject: copy.emailSubject, html: copy.emailHtml }) });
        if (r.ok) mailed++;
      }
    }
    void delivered;
  }
  return Response.json({ ok: true, pushed, mailed });
});
