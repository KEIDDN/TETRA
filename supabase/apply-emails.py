"""Turns on TETRA's own email sender and the branded templates in Supabase.

Supabase only lets a project change its emails once it sends through its own
SMTP server. Run once with the sender's details:

  SUPABASE_TOKEN=sbp_... SMTP_HOST=smtp.example.com SMTP_PORT=587 \
  SMTP_USER=... SMTP_PASS=... SENDER_EMAIL=hello@example.com \
  python3 supabase/apply-emails.py
"""
import json
import os
import pathlib
import urllib.request

PROJECT = 'netecknmyvwnkagucxma'
HERE = pathlib.Path(__file__).parent / 'templates'
env = os.environ

body = {
    'smtp_host': env['SMTP_HOST'],
    'smtp_port': env.get('SMTP_PORT', '587'),
    'smtp_user': env['SMTP_USER'],
    'smtp_pass': env['SMTP_PASS'],
    'smtp_admin_email': env['SENDER_EMAIL'],
    'smtp_sender_name': env.get('SENDER_NAME', 'TETRA by OXIA Labs'),
    'rate_limit_email_sent': int(env.get('EMAILS_PER_HOUR', '60')),
    'mailer_subjects_confirmation': 'Confirm your email for TETRA',
    'mailer_templates_confirmation_content': (HERE / 'confirmation.html').read_text(),
    'mailer_subjects_recovery': 'Reset your TETRA password',
    'mailer_templates_recovery_content': (HERE / 'recovery.html').read_text(),
    'mailer_subjects_magic_link': 'Your TETRA sign-in link',
    'mailer_templates_magic_link_content': (HERE / 'magic_link.html').read_text(),
    'mailer_subjects_email_change': 'Confirm your new email for TETRA',
    'mailer_templates_email_change_content': (HERE / 'email_change.html').read_text(),
}

request = urllib.request.Request(
    f'https://api.supabase.com/v1/projects/{PROJECT}/config/auth',
    data=json.dumps(body).encode(),
    method='PATCH',
    headers={'Authorization': f"Bearer {env['SUPABASE_TOKEN']}", 'Content-Type': 'application/json'},
)
with urllib.request.urlopen(request) as response:
    result = json.load(response)
print('Sender:', result.get('smtp_admin_email'), '·', result.get('smtp_host'))
print('Templates applied. Emails per hour:', result.get('rate_limit_email_sent'))
