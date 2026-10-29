import { useSyncExternalStore } from 'react';
import { getAccount } from './account';
import { desktop, detectOs, installed } from './platform';
import { getSettings } from './settings';
import { supabase } from './supabase';

/** Where reports land as email. */
export const FEEDBACK_EMAIL = 'oxialabs.audio@gmail.com';

export type ReportKind = 'bug' | 'visual' | 'idea' | 'other';

export interface Report {
  kind: ReportKind;
  message: string;
  steps: string;
  contact: string;
  includeDetails: boolean;
}

const KIND_NAMES: Record<ReportKind, string> = { bug: 'Bug', visual: 'Visual glitch', idea: 'Idea', other: 'Other' };

/** What helps us reproduce it: never anything personal beyond what the player types. */
export function diagnostics(): Record<string, string> {
  const s = getSettings();
  return {
    version: __APP_VERSION__,
    platform: desktop ? `Desktop app (${desktop.platform})` : installed() ? 'Installed web app' : 'Browser',
    os: detectOs(),
    browser: navigator.userAgent,
    screen: `${screen.width}×${screen.height} @${devicePixelRatio}x · window ${innerWidth}×${innerHeight}`,
    skin: s.appearance.skin,
    experience: s.experience ? 'on' : 'off (Focus)',
    account: getAccount().mode,
    language: navigator.language,
    time: new Date().toISOString(),
  };
}

/**
 * Sends a report two ways: into the database (kept for us to read) and as an
 * email to the studio. It counts as sent if either gets through.
 */
export async function sendReport(report: Report): Promise<string | null> {
  const details = report.includeDetails ? diagnostics() : { version: __APP_VERSION__ };
  const stored = supabase
    ? supabase
        .from('bug_reports')
        .insert({
          kind: report.kind,
          message: report.message.trim(),
          steps: report.steps.trim() || null,
          contact: report.contact.trim() || null,
          version: __APP_VERSION__,
          details,
        })
        .then(({ error }) => !error)
    : Promise.resolve(false);

  const lines = [
    report.message.trim(),
    report.steps.trim() && `\nSteps to reproduce:\n${report.steps.trim()}`,
    `\n— ${Object.entries(details)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n')}`,
  ].filter(Boolean);
  const mailed = fetch(`https://formsubmit.co/ajax/${FEEDBACK_EMAIL}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      _subject: `TETRA ${__APP_VERSION__} · ${KIND_NAMES[report.kind]}: ${report.message.trim().slice(0, 60)}`,
      _template: 'box',
      _captcha: 'false',
      ...(report.contact.trim() ? { email: report.contact.trim() } : {}),
      Type: KIND_NAMES[report.kind],
      Report: lines.join('\n'),
    }),
  })
    .then((r) => r.ok)
    .catch(() => false);

  const [db, mail] = await Promise.all([stored, mailed]);
  return db || mail ? null : `Couldn't send it. Check your connection, or email us at ${FEEDBACK_EMAIL}.`;
}

// ── The report window, openable from anywhere ─────────────────

let open = false;
const listeners = new Set<() => void>();
function set(next: boolean): void {
  open = next;
  listeners.forEach((l) => l());
}
export const openBugReport = () => set(true);
export const closeBugReport = () => set(false);
export function useBugReportOpen(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => open,
  );
}
