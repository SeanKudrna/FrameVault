import { redirect } from "next/navigation";

/**
 * Legacy `/sign-in` alias that forwards traffic to `/auth/sign-in`.
 */
export default function SignInAliasPage() {
  redirect("/auth/sign-in");
}
