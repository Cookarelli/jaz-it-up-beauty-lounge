# Isolated browser testing with no extra cloud service

The `browser` job in GitHub Quality uses local Supabase containers and a production Next.js server on an ephemeral standard Linux runner. It needs no Supabase access token, hosted project, production credentials, paid add-on or outbound provider. The existing public repository’s standard runners are used; no larger runner or paid Actions service is selected. Private forks must remain within their included allowance and keep paid overage disabled.

The 11 historical migration files are **unchanged**. They are replayed only into an empty disposable database. No command in this workflow links to, pushes to, resets or modifies the existing salon project. Public booking is enabled only on the loopback test server; the salon and Vercel preview booking gates stay off. Messaging, indexing and payments remain off everywhere in these tests.

## Mac Mini / local Docker-compatible runtime

For a persistent manual walkthrough with fictional customers, see [Local practice](LOCAL_PRACTICE.md). The commands below are for disposable automated test runs.

Use an already available free Docker-compatible runtime. Do not purchase a runtime, hosted database or runner. This Codex Mac currently has no Docker daemon; run the workflow in GitHub Actions instead unless a suitable local runtime is available.

From a clean checkout with `npm ci` completed:

```sh
mkdir -p .e2e
npx --yes supabase@2.121.0 start > .e2e/start.log 2>&1
npx --yes supabase@2.121.0 status -o json > .e2e/status.json
node scripts/prepare-e2e.mjs
npx playwright install chromium
npm run test:e2e
# Removes only the local jaz-isolated-e2e containers/data. Do not substitute a hosted command.
npx --yes supabase@2.121.0 stop --no-backup
```

Use a **fresh disposable stack** each run. The provisioning script rejects a non-loopback Supabase URL and a database already containing customers. It creates owner and outsider identities with a fresh random password, stores local credentials in ignored `.e2e/environment.json` with owner-only file permissions and never prints them. The test server similarly refuses non-loopback origins, binds only to `127.0.0.1:3100` and refuses to reuse another server. Never copy these test credentials or flags into Vercel or the salon environment. Delete `.e2e` after testing; never upload its files or the startup log.

The browser suite exercises the actual app, Auth, PostgREST, RLS and database at phone/tablet sizes. It verifies the stored reservation, capability-protected receipt, idempotent retry, conflicting booking, unauthorized access, owner schedule changes and cancellation. The SQL suites independently cover concurrency, buffers, service approval and both DST transitions. No test login bypass or fixture API exists in the product.

This evidence does not replace hosted acceptance, owner approval, screen-reader review, backup recovery testing, delivery verification or future Stripe sandbox testing. See [VERIFICATION](../VERIFICATION.md) for which checks actually ran.

References: [Supabase local CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), [Playwright test server](https://playwright.dev/docs/test-webserver).
