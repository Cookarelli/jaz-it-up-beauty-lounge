import "server-only";
import { launch, onlineBookingReady } from "./launch";
import { privilegedClient } from "./supabase";
import { rateKey, logServerFailure } from "./http-safety";
export type ApiScope =
  "bookings" | "availability" | "status" | "cancel" | "preferences";
export async function apiGuard(
  req: Request,
  scope: ApiScope,
  requiresBooking = false,
) {
  if (requiresBooking && !onlineBookingReady)
    return Response.json(
      {
        error: "Online booking is not available yet. Please contact the salon.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  try {
    if (!launch.BOOKING_RATE_LIMIT_SECRET)
      throw Error("Limiter not configured");
    const key = rateKey(
      req,
      launch.BOOKING_RATE_LIMIT_SECRET,
      process.env.VERCEL === "1",
    );
    const { data, error } = await privilegedClient().rpc("consume_api_limit", {
      p_scope: scope,
      p_key: key,
    });
    if (error) throw Error("Limiter unavailable");
    if (data !== true)
      return Response.json(
        { error: "Too many requests. Please wait before trying again." },
        {
          status: 429,
          headers: { "Retry-After": "60", "Cache-Control": "no-store" },
        },
      );
    return null;
  } catch {
    const reference = logServerFailure("api_guard_unavailable");
    return Response.json(
      { error: "This service is temporarily unavailable.", reference },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
