"use client";
import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { LuEye, LuEyeOff } from "react-icons/lu";
import { FaLinkedinIn } from "react-icons/fa";
import { authService } from "@/service/authService";
import { useAuth } from "@/context/AuthContext";
import { loginSchema } from "@/lib/validations/authSchema";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import { LoginResponse } from "@/types/Auth";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const loginMutation = useMutation({
    mutationFn: (data: { email: string; password: string }) => authService().login(data),
    onSuccess: (data: LoginResponse) => {
      login(data);
      toast.success("Welcome back!");
      router.replace("/linkedin-autopilot");
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error));
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const errs = result.error.flatten().fieldErrors;
      setFieldErrors({ email: errs.email?.[0], password: errs.password?.[0] });
      return;
    }
    setFieldErrors({});
    loginMutation.mutate(result.data);
  };

  return (
    <div className="flex min-h-screen">
      {/* ── Left panel — form ── */}
      <div className="flex w-full flex-col justify-between bg-white px-8 py-8 md:w-[42%] lg:px-14">
        {/* Top row: back + logo */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-slate-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-400">
              <span className="text-sm font-bold text-white">R</span>
            </div>
            <span className="font-bold text-slate-900">Relay</span>
          </Link>
        </div>

        {/* Form — vertically centred */}
        <div className="mx-auto w-full max-w-sm py-12">
          <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
          <p className="mt-1.5 text-sm text-slate-500">Sign in to your Relay account</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                Work email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              />
              {fieldErrors.email && (
                <p className="mt-1.5 text-xs text-red-500">{fieldErrors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <LuEyeOff className="h-4 w-4" /> : <LuEye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1.5 text-xs text-red-500">{fieldErrors.password}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loginMutation.isPending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium text-teal-600 hover:underline">
              Get started free
            </Link>
          </p>
        </div>

        {/* Bottom legal */}
        <p className="text-center text-xs text-slate-400">
          By using Relay, you are agreeing to our{" "}
          <span className="underline underline-offset-2 cursor-pointer">Terms of Service</span> and{" "}
          <span className="underline underline-offset-2 cursor-pointer">Privacy Policy</span>.
        </p>
      </div>

      {/* ── Right panel — visual ── */}
      <div className="relative hidden flex-col overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 md:flex md:w-[58%]">
        {/* Subtle glow */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(20,184,166,0.15),transparent_60%)]" />

        <div className="relative flex h-full flex-col justify-between p-10 lg:p-14">
          {/* Testimonial card */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <div className="mb-3 flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} className="h-4 w-4 fill-teal-400" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <p className="text-sm leading-relaxed text-slate-200">
              &ldquo;I&apos;ve used every single LinkedIn automation tool under the sun. Nothing is
              safer and nothing is more effective than Relay. The AI writes posts that actually
              sound like me.&rdquo;
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-400 text-sm font-bold text-slate-900">
                T
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Taufiqul Islam</p>
                <p className="text-xs text-slate-400">CEO @ Precious Memories</p>
              </div>
            </div>
          </div>

          {/* Dashboard mockup */}
          <div className="mt-6 flex-1">
            <div className="h-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 shadow-2xl">
              {/* Chrome bar */}
              <div className="flex items-center gap-2 border-b border-white/10 bg-slate-800/80 px-4 py-3">
                <div className="h-2.5 w-2.5 rounded-full bg-red-400/60" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/60" />
                <div className="h-2.5 w-2.5 rounded-full bg-green-400/60" />
                <span className="ml-3 flex items-center gap-1.5 text-xs text-slate-500">
                  <div className="flex h-4 w-4 items-center justify-center rounded bg-teal-400">
                    <span className="text-[9px] font-bold text-white">R</span>
                  </div>
                  Relay Dashboard
                </span>
              </div>

              <div className="p-5">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { label: "Posts Published", value: "47", up: true },
                    { label: "Reach", value: "12.4k", up: true },
                    { label: "Approval Rate", value: "94%", up: false },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl bg-slate-800/80 p-3">
                      <p className="text-xs text-slate-500">{s.label}</p>
                      <p className="mt-1 text-xl font-bold text-white">{s.value}</p>
                      <p className="mt-0.5 text-xs text-teal-400">↑ +18%</p>
                    </div>
                  ))}
                </div>

                {/* Chart */}
                <div className="mb-4 flex h-24 items-end gap-1 rounded-xl bg-slate-800/80 px-3 py-2">
                  {[18, 32, 26, 52, 40, 66, 58, 78, 70, 86, 80, 100].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm bg-gradient-to-t from-teal-500 to-blue-400 opacity-70"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>

                {/* Post rows */}
                {[
                  {
                    text: "5 AI-powered tips for LinkedIn growth...",
                    status: "Approved",
                    color: "text-teal-400",
                  },
                  {
                    text: "How we generated 3x ROI from content...",
                    status: "Scheduled",
                    color: "text-blue-400",
                  },
                  {
                    text: "The future of B2B marketing is here...",
                    status: "Draft",
                    color: "text-slate-400",
                  },
                ].map((post) => (
                  <div
                    key={post.text}
                    className="mb-2 flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FaLinkedinIn className="h-3 w-3 shrink-0 text-teal-400" />
                      <span className="truncate text-xs text-slate-300">{post.text}</span>
                    </div>
                    <span className={`ml-3 shrink-0 text-xs font-medium ${post.color}`}>
                      {post.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom fade */}
          <div className="mt-6 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>
      </div>
    </div>
  );
}
