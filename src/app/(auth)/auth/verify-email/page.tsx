import Link from "next/link";

type VerifyEmailPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const params = searchParams ? await searchParams : {};
  const rawEmail = Array.isArray(params.email) ? params.email[0] : params.email;
  let emailLabel = rawEmail ?? null;

  if (emailLabel) {
    try {
      emailLabel = decodeURIComponent(emailLabel);
    } catch {
      // If decoding fails, fall back to the raw value so we still render something useful.
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#030712]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(78,70,229,0.35),_transparent_60%)]" />
      <div className="absolute inset-y-0 left-0 -z-10 w-1/2 bg-[radial-gradient(circle_at_bottom_left,_rgba(6,182,212,0.28),_transparent_70%)]" />

      <div className="w-full max-w-md rounded-3xl border border-slate-800/70 bg-slate-950/70 p-8 text-center shadow-xl backdrop-blur">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-50">Check your inbox</h1>
          <p className="text-sm text-slate-400">
            {emailLabel ? (
              <>
                We sent a verification link to <span className="text-slate-100">{emailLabel}</span>.
              </>
            ) : (
              "We sent a verification link to your email address."
            )}
          </p>
          <p className="text-sm text-slate-400">
            Confirm the message to activate your account, then return here to sign in.
          </p>
        </div>

        <Link
          href="/auth/sign-in"
          className="mt-8 inline-flex w-full items-center justify-center rounded-xl border border-indigo-500/60 bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-200 transition hover:bg-indigo-500/20"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
