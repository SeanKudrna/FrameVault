import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function SignInPage() {
  const supabase = await getSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();

  if (userData?.user) {
    redirect("/app");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#030712]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(78,70,229,0.35),_transparent_60%)]" />
      <div className="absolute inset-y-0 left-0 -z-10 w-1/2 bg-[radial-gradient(circle_at_bottom_left,_rgba(6,182,212,0.28),_transparent_70%)]" />
      <SignInForm />
    </div>
  );
}
