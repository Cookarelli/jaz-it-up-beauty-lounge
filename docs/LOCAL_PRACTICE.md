# Practice on the Mac Mini — no cloud service required

This uses a separate local Colima profile and disposable Supabase database. The application is copied into ignored `.practice/app` without `.env` files, cloud credentials or real customer data. The 11 historical migrations are copied unchanged and applied only when creating this empty local database. Nothing links to or migrates the hosted Supabase project.

No account, subscription, domain or paid add-on is needed. Colima is MIT licensed. Downloads require an internet connection and several GB of disk space. Plan on leaving a Terminal window open while practicing.

## 1. Install the free local runtime

In Terminal on your Mac Mini:

```sh
brew install colima docker
colima start --profile jaz-practice --cpu 2 --memory 4 --disk 30
```

Use the `jaz-practice` profile so the launcher can verify the Docker context. The commands use the Docker CLI with Colima, not a Docker Desktop subscription. If Homebrew says permission denied or command not found, stop and share that error; do not change ownership of system folders or use `sudo brew`.

## 2. Open the repository and prepare a practice copy

Use your existing repository checkout. If you need a checkout on the Mac Mini:

```sh
mkdir -p "$HOME/Projects"
cd "$HOME/Projects"
git clone https://github.com/Cookarelli/jaz-it-up-beauty-lounge.git
cd jaz-it-up-beauty-lounge
```

For an existing checkout, open its folder in Terminal and inspect `git status` before updating; preserve local changes. Node 22.9+ or 24 is required. From the repository folder:

```sh
npm ci
npm run practice:setup
```

The first setup downloads container images and app dependencies. Progress logs are inside ignored `.practice/` and may contain local keys; do not paste or publish the full logs. The setup generates a strong random password, provisions a local owner through real Supabase Auth, and creates Alex Sample and Jamie Sample with fictional `example.invalid` email addresses. Two sample Eyebrow appointments appear on the next Tuesday at least seven days away. Their exact date is in the login file.

Existing practice records are preserved when starting again. Do not run the automated E2E stack at the same time; it uses the same local ports.

## 3. Start and sign in

```sh
npm run practice:start
```

Wait for Next.js to say it is ready. Keep that Terminal open.

- Customer booking: <http://127.0.0.1:3100/book>
- Delia's practice dashboard: <http://127.0.0.1:3100/admin>
- Local login: `owner@example.invalid`
- Password: open `.practice/admin-login.txt` privately in your editor. The launcher never prints it. Do not send it in chat or use it on the hosted site.

The app binds only to `127.0.0.1`; the launcher verifies that local database container ports also use loopback. It refuses a remote Docker context, non-local URLs, linked Supabase projects and `.env` files inside the copied app. It removes inherited provider credentials and forces all messaging, SMS, payments and indexing switches off at every start. No tunnels or public network listeners are needed.

The existing `PUBLIC_BOOKING_ENABLED` flag is true **only in this private local copy** so the actual guest booking route can be exercised. Hosted flags stay false. The local server is not a public launch.

## 4. Try a short walkthrough

1. On `/book`, choose Eyebrow ($10, 15 minutes). Choose a future Tuesday–Friday or Saturday. Use `Taylor Practice`, `taylor.practice@example.invalid` and `+15555550103`.
2. Reserve a time and check the saved confirmation details. No email, text or charge should occur.
3. Sign into `/admin` in a second tab. Open Upcoming bookings or the calendar on that date and find Taylor Practice.
4. Open the appointment, reschedule it, then cancel it using the confirmation prompt. Try a manual phone booking or walk-in using fictional details.
5. In schedule management, add a time block and verify that interval disappears from the customer availability list. Remove it afterward.
6. Confirm Tuesday–Friday 9 AM–7 PM, Saturday 9 AM–3 PM, Sunday/Monday closed, Central Time, with no automatic lunch break. Configured service buffers still must fit before closing.
7. Inspect services. Adult cut variant prices and other unapproved menu details remain owner-review items; use an approved service for your first booking.

Use only fictional information. Changes are saved only in the local practice database and do not synchronize to the salon.

## 5. Stop and resume

Press Control-C in the app Terminal, then from the repository folder:

```sh
npm run practice:stop
colima stop --profile jaz-practice
```

Practice records are preserved. To resume:

```sh
colima start --profile jaz-practice
npm run practice:start
```

Do not use `supabase db push`, `supabase link`, `supabase db reset --linked` or a cloud database password. There is deliberately no automatic deletion/reset command. Ask for a targeted reset of the practice stack if you want to erase its fictional records.

## Validation limits

The existing real Supabase browser suite passed in disposable CI containers. The new launcher has automated safety checks, but the Colima setup and manual practice session must also be verified on the Mac Mini after its runtime is installed. A successful build alone is not evidence of a running local database or a successful booking.

Sources: [Colima installation](https://colima.run/docs/installation/), [Colima profiles](https://colima.run/docs/profiles/), [Supabase local development](https://supabase.com/docs/guides/local-development).
