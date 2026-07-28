"use client";
import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { LuEye, LuEyeOff, LuCheck } from "react-icons/lu";
import { FaLinkedinIn } from "react-icons/fa";
import { authService } from "@/service/authService";
import { useAuth } from "@/context/AuthContext";
import { registerSchema } from "@/lib/validations/authSchema";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import { LoginResponse } from "@/types/Auth";

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    username?: string;
    password?: string;
  }>({});

  const registerMutation = useMutation({
    mutationFn: (data: { email: string; username: string; password: string }) =>
      authService().register(data),
    onSuccess: (data: LoginResponse) => {
      login(data);
      toast.success("Account created!");
      router.replace("/linkedin-autopilot");
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error));
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const result = registerSchema.safeParse({ email, username, password });
    if (!result.success) {
      const errs = result.error.flatten().fieldErrors;
      setFieldErrors({
        email: errs.email?.[0],
        username: errs.username?.[0],
        password: errs.password?.[0],
      });
      return;
    }
    setFieldErrors({});
    registerMutation.mutate(result.data);
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
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500">
              <span className="text-sm font-bold text-white">R</span>
            </div>
            <span className="font-bold text-slate-900">Relay</span>
          </Link>
        </div>

        {/* Form — vertically centred */}
        <div className="mx-auto w-full max-w-sm py-12">
          <h1 className="text-2xl font-bold text-slate-900">Get started in 2 minutes</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Create your free Relay account. No credit card required.
          </p>

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
                className="w-full rounded-lg border border-slate-200 bg-[#E9ECF5] px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              />
              {fieldErrors.email && (
                <p className="mt-1.5 text-xs text-red-500">{fieldErrors.email}</p>
              )}
            </div>

            {/* Username */}
            <div>
              <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-slate-700">
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                placeholder="yourname"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-[#E9ECF5] px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              />
              {fieldErrors.username && (
                <p className="mt-1.5 text-xs text-red-500">{fieldErrors.username}</p>
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
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-[#E9ECF5] px-3.5 py-2.5 pr-10 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
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
              disabled={registerMutation.isPending}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {registerMutation.isPending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Creating account...
                </>
              ) : (
                "Create account"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-teal-600 hover:underline">
              Log in
            </Link>
          </p>
        </div>

        {/* Bottom legal */}
        <p className="text-center text-xs text-slate-400">
          By using Relay, you are agreeing to our{" "}
          <span className="cursor-pointer underline underline-offset-2">Terms of Service</span> and{" "}
          <span className="cursor-pointer underline underline-offset-2">Privacy Policy</span>.
        </p>
      </div>

      {/* ── Partition ── */}
      <div className="hidden w-px bg-slate-200 md:block" />

      {/* ── Right panel — visual ── */}
      <div className="relative hidden flex-col overflow-hidden bg-[#E9ECF5] md:flex md:flex-1">
        <div className="relative flex h-full flex-col justify-between p-10 lg:p-14">
          {/* Testimonial card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} className="h-4 w-4 fill-teal-500" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <p className="text-sm leading-relaxed text-slate-600">
              &ldquo;I&apos;ve used every single LinkedIn automation tool under the sun. Nothing is
              safer and nothing is more effective than Relay. The AI writes posts that actually
              sound like me.&rdquo;
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-500 text-sm font-bold text-white">
                T
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Taufiqul Islam</p>
                <p className="text-xs text-slate-400">CEO @ Precious Memories</p>
              </div>
            </div>
          </div>

          {/* What you get */}
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="mb-4 text-sm font-semibold text-slate-700">What you get for free</p>
            <ul className="space-y-3">
              {[
                "AI post generation from your knowledge base",
                "Review & approval workflow",
                "Image generation & upload",
                "Scheduled publishing",
                "Analytics & engagement tracking",
              ].map((feat) => (
                <li key={feat} className="flex items-center gap-2.5 text-sm text-slate-600">
                  <LuCheck className="h-4 w-4 shrink-0 text-teal-500" />
                  {feat}
                </li>
              ))}
            </ul>
          </div>

          {/* Dashboard mockup */}
          <div className="mt-5 flex-1">
            <div className="h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
                <div className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
                <div className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
                <span className="ml-3 flex items-center gap-1.5 text-xs text-slate-400">
                  <div className="flex h-4 w-4 items-center justify-center rounded bg-teal-500">
                    <span className="text-[9px] font-bold text-white">R</span>
                  </div>
                  Relay Dashboard
                </span>
              </div>

              <div className="bg-[#E9ECF5] p-4">
                <div className="mb-3 grid grid-cols-3 gap-2">
                  {[
                    { label: "Posts Published", value: "47", delta: "↑ +18%" },
                    { label: "Reach", value: "12.4k", delta: "↑ +32%" },
                    { label: "Approval Rate", value: "94%", delta: "↑ +6%" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl bg-white p-3 shadow-sm">
                      <p className="text-xs text-slate-500">{s.label}</p>
                      <p className="mt-1 text-lg font-bold text-slate-900">{s.value}</p>
                      <p className="mt-0.5 text-xs font-medium text-teal-600">{s.delta}</p>
                    </div>
                  ))}
                </div>

                <div className="mb-3 flex h-16 items-end gap-1 rounded-xl bg-white px-3 py-2 shadow-sm">
                  {[18, 32, 26, 52, 40, 66, 58, 78, 70, 86, 80, 100].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm bg-gradient-to-t from-teal-500 to-blue-400 opacity-80"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>

                {[
                  {
                    text: "5 AI-powered tips for LinkedIn growth...",
                    status: "Approved",
                    color: "text-teal-600",
                  },
                  {
                    text: "How we generated 3x ROI from content...",
                    status: "Scheduled",
                    color: "text-blue-600",
                  },
                ].map((post) => (
                  <div
                    key={post.text}
                    className="mb-2 flex items-center justify-between rounded-lg bg-white px-3 py-2 shadow-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <FaLinkedinIn className="h-3 w-3 shrink-0 text-teal-500" />
                      <span className="truncate text-xs text-slate-600">{post.text}</span>
                    </div>
                    <span className={`ml-3 shrink-0 text-xs font-medium ${post.color}`}>
                      {post.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
