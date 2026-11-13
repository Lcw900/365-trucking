# Supabase connection setup

The frontend uses the project's public publishable key. Never add service_role keys or database passwords to dist/.

1. Open your Supabase project → SQL Editor → New query. Paste and run `supabase/setup.sql`.
2. Open Authentication → URL Configuration. Set Site URL to `http://127.0.0.1:5173/`. Add `http://127.0.0.1:5173/**` and, if you use localhost, `http://localhost:5173/**` to Redirect URLs. Use your real HTTPS domain when deploying.
3. Under Authentication → Providers → Email, enable email/password sign-in and keep email confirmation enabled. For production email delivery, configure your own SMTP provider.
4. Sign up through the app and confirm your email. Customer sign-up: `/#/signup`; driver sign-up: `/#/driver/signup`. Driver accounts start pending. Sign-in and password reset use Supabase Auth.
5. To create your first admin, sign up and confirm an account, then run the following in SQL Editor with your own email. Never expose admin assignment through a public sign-up form:

```sql
update public.profiles set role='admin',status='active'
where id=(select id from auth.users where email='YOUR-ADMIN-EMAIL');
```

Sign out and sign in at `/#/admin/login` afterward.

To approve a real driver account during this initial integration:

```sql
update public.profiles set status='approved'
where id='DRIVER-USER-UUID' and role='driver';
```

## Scope of this integration

Real Supabase sign-up, email confirmation, sign-in, session refresh, sign-out and password recovery are connected. Portal navigation checks the server-owned profile role/status. Row-level security protects the new profiles table and private storage buckets. Users cannot make themselves admins by changing their sign-up metadata.

Driver verification files and their reviews are now stored privately in Supabase; see DOCUMENTS.md. Existing delivery, payment, customer/driver profile forms, avatars and other admin management screens remain local demo features. Local account removal/payment controls do not modify Supabase accounts. Existing local demo data is shared by the browser, not separated into real user accounts. Signing in does not turn that demo data into production data.

The public key cannot run migrations or assign admins, so the project owner must complete the SQL steps. No real users, emails or payments were created during connection testing.

Rebuild auth client after source changes: `npm run build:auth`. The SDK is bundled locally; runtime does not rely on a third-party CDN.
