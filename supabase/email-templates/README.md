# 365 Trucking confirmation email

Prepared template: confirm-signup.html
Subject: Confirm your email | 365 Trucking
Status: prepared locally; not yet saved in the hosted Supabase Auth settings.

Apply to your own project (after configuring a supported email provider):
1. Open https://supabase.com/dashboard/project/YOUR_PROJECT_REF/auth/templates and sign in.
2. In the Confirm signup template, set the subject above and replace the HTML body with confirm-signup.html.
3. Keep all three {{ .ConfirmationURL }} variables intact. They preserve Supabase's verification and redirect flow.
4. Save and use the dashboard preview. A real test email should only be sent to a recipient explicitly chosen by the project owner.

Sender identity:
The HTML template changes the message appearance, not the From address. To send as 365 Trucking from a company-domain address, configure custom SMTP in Supabase Authentication → Email/SMTP settings with your chosen email provider. Use sender name 365 Trucking and a verified address on a domain you control. Domain verification records are supplied by that provider. The project’s public frontend key cannot change these settings.

Design:
Red #dc2626 button/accent, white content/footer, dark #111827 heading/brand, gray #475569 body, Poppins heading and Inter body with Arial/Helvetica fallbacks for email clients that do not load web fonts. Inline table layout supports common email clients. The text wordmark stays visible when remote images are blocked. No localhost-hosted image, personal greeting, tracking pixel or marketing subscription is required.

The HTML template is a source artifact. A preview page and real verification tokens are not included in this repository.

Dashboard verification on 2026-11-12: the project is on the Free plan and template subject/source editing is disabled while using the default email service. The dashboard explicitly requires custom SMTP, with an alternative paid Pro upgrade. No template was saved and no billing, sending configuration or security setting was changed. After connecting the project owner's email provider, apply the prepared subject/body above.
