# TETRA roadmap

What's next, roughly in order. Done items move to the patch notes (`apps/web/src/lib/patchNotes.ts`).

## Next

- **Sign in with Google** (on hold: email-only for now). The button is already built and appears by itself once the provider is on in Supabase. Needs a Google Cloud OAuth client (Web) with the redirect URI `https://netecknmyvwnkagucxma.supabase.co/auth/v1/callback`, then its Client ID and Secret in Supabase → Authentication → Providers → Google.
- **Sign in with Apple.** Same, once there is an Apple Developer account (Services ID + Sign in with Apple key).
- **Branded emails (to do: Miki).** The templates are ready in `supabase/templates` (TETRA / OXIA design). Pick a sender (Resend with an OXIA Labs domain is best; Brevo or a Gmail app password work without one), then run `supabase/apply-emails.py` with its details. That also lifts the free plan's limit of a few emails an hour.

## Later

- **Leaderboards.** The `scores` table is ready; needs the screen and server-side checks against cheating.
- **Touch controls** for phones and tablets.
- **Signed apps.** Apple Developer ID and a Windows code-signing certificate: no more first-open warnings, and macOS updates install themselves.
- **Daily and weekly challenges**, with their own achievements.
- **Multiplayer.**
