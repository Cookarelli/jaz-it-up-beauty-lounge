# Supabase backup and migration record

Completed October 14, 2026 for project `fwxothhjxtvuupyeqsri` (Jaz It Up, OptAImal LLC). Source migration files came from repository commit `b4d92ff724840958fe632d9100362cd64e36e3ad`. This records database maintenance, not production launch or hosted booking acceptance.

## Backup evidence

- Export started at **2026-10-14 20:22:24 UTC** (3:22:24 PM America/Chicago), before either migration.
- PostgreSQL 17.11 client tools connected through the project's session pooler with `sslmode=verify-full` and the CA certificate linked by the authenticated Supabase dashboard. Credentials were supplied through process environment, never command arguments, Git or chat output. The temporary local database-password file was cleared afterward.
- Supabase CLI 2.121.0's generated export filters produced roles, application schema, data including Auth identities, and separate migration-history schema/data files. A complete PostgreSQL custom-format database archive and its object list were also exported. The raw archive is supplemental and requires operator review for managed-schema restoration.
- All **57 table row counts** in the custom archive matched live counts before and after export. The backup includes the one Auth user, one owner membership, 23 services, 15 variants and nine prior migration records. There were zero appointments, customers, Storage buckets or Storage objects. Storage object bytes therefore required no separate export.
- The package was encrypted using OpenSSL AES-256-CBC with PBKDF2 (600,000 iterations) and a generated random recovery passphrase kept separately outside Git. Decryption reproduced the original archive exactly and every included file matched its SHA-256 manifest. Temporary unencrypted exports were removed after verification.
- Encrypted artifact: `fwxothhjxtvuupyeqsri-before-migrations-20261014T202224Z.tar.gz.enc` (168,816 bytes), delivered separately from the repository. SHA-256: `a82dae2087e065118444dfd7f46c774915401a7996b34fe4cdb3aaf823029943`.
- **Not yet verified:** an off-machine backup copy or full restoration into an isolated Supabase project. Preserve the recovery passphrase separately in a password manager. Auth/provider configuration, API keys, custom-role passwords and Vercel/domain settings require separate protected records. The Free plan currently provides no managed automatic backups.

## Applied migrations

1. `20261014184518_communications_and_optional_deposits.sql`
2. `20261014193528_launch_safety_and_api_limits.sql`

The dry run listed exactly those two files with no seeds or roles to replay. `supabase db push --skip-vault` applied the repository files in order. Supabase migration history now contains all **11** canonical versions, and the post-apply dry run returned `upToDate: true` with no pending migrations. No migration repair, reset or historical seed replay was performed. The complete migration sequence had already passed disposable PostgreSQL 17 CI before this live maintenance.

## Post-migration checks

- All **27 public tables** have RLS enabled.
- No public table grants anonymous INSERT, UPDATE or DELETE. Anonymous clients cannot SELECT customers or booking requests.
- All **11 checked booking, payment, notification and rate-limit RPCs** reject execution privileges for both anonymous and authenticated client roles; their intended service role access remains configured by the migrations.
- Before/after content digests matched for 16 unchanged tables covering salons, locations, staff, memberships, stylists, profiles, catalog, hours, availability, exceptions, time blocks, customers and holds.
- One Auth account and one owner membership remain; there are no customer or appointment records. No synthetic bookings or real messages/charges were created during maintenance.
- Payment policy remains `none` with `payments_enabled=false`. Email, SMS and reminders are disabled; payment readiness is empty. Public booking and deployment settings were not activated or changed.
- The security advisor still reports [leaked-password protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Three [RLS-without-policy informational findings](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) cover intentionally service-only tables: holds, provider events and API rate limits. No permissive client policies were added.

Next: preserve the encrypted artifact off-machine and its recovery passphrase separately; complete an isolated restore drill and protected preview acceptance. Retain the remaining launch gates in [LAUNCH_CHECKLIST.md](../LAUNCH_CHECKLIST.md).
