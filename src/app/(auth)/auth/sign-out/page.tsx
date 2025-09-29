/**
 * Sign-out page that ensures clean session termination and redirects to home.
 * This page runs server-side to guarantee proper cleanup.
 */

import { redirect } from "next/navigation";

export default function SignOutPage() {
  // This page will run on the server and immediately redirect to home
  // The middleware will handle any remaining auth state
  redirect("/");
}
