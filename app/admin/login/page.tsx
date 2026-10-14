import { Intro } from "@/components/site";
import { configured } from "@/lib/env";
import { login } from "./actions";
export const metadata = {
  title: "Salon login",
  robots: { index: false, follow: false },
};
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <section className="narrow">
      <Intro eyebrow="JUST FOR THE SALON" title="Welcome back, Delia.">
        Sign in to manage the lounge.
      </Intro>
      {configured ? (
        <form action={login}>
          {error && (
            <p role="alert">
              We couldn’t sign you in. Check your details and try again.
            </p>
          )}
          <label>
            Email
            <input required type="email" name="email" autoComplete="username" />
          </label>
          <label>
            Password
            <input
              required
              type="password"
              name="password"
              autoComplete="current-password"
              minLength={8}
            />
          </label>
          <button>Sign in</button>
        </form>
      ) : (
        <p className="notice">
          Admin access is unavailable until Supabase is configured. This area
          contains no sample client records.
        </p>
      )}
    </section>
  );
}
