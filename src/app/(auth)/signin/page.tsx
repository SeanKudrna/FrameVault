import { redirect } from "next/navigation";

/**
 * Maintains backward compatibility for `/signin` by redirecting to the canonical route.
 */
export default function LegacySignInRedirect() {
  redirect("/auth/sign-in");
}
