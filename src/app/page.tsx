import Link from "next/link";
import LandingNavbar from "@/components/layout/LandingNavbar";
import { LuArrowRight, LuBrain, LuUsers, LuZap, LuCheck } from "react-icons/lu";
import { FaLinkedinIn } from "react-icons/fa";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <LandingNavbar />

      {/* ── Hero ── */}
      <section className="relative flex min-h-screen items-center overflow-hidden pt-16">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(20,184,166,0.12),transparent_55%)]" />

        <div className="relative mx-auto w-full max-w-7xl px-6 py-24 text-center">
          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-4 py-1.5 text-sm text-teal-300">
            <LuZap className="h-3.5 w-3.5" />
            AI-Powered Lead Generation &amp; LinkedIn Automation
          </div>

          {/* Headline */}
          <h1 className="text-5xl font-bold leading-tight tracking-tight md:text-6xl lg:text-7xl">
            The AI Platform for
            <br />
            <span className="bg-gradient-to-r from-teal-400 to-blue-400 bg-clip-text text-transparent">
              B2B Growth
            </span>{" "}
            &amp; Outreach
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
            Find your ideal prospects with AI-powered lead sourcing, then turn them into customers
            with automated LinkedIn content and outreach — all in one platform.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/register"
              className="flex items-center gap-2 rounded-xl bg-teal-400 px-6 py-3.5 text-base font-semibold text-slate-900 transition-colors hover:bg-teal-300"
            >
              Start Free Trial <LuArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#products"
              className="flex items-center gap-2 rounded-xl border border-slate-700 px-6 py-3.5 text-base font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
            >
              See Products
            </a>
          </div>

          <p className="mt-6 text-sm text-slate-600">No credit card required · Free 14-day trial</p>

          {/* App mockup */}
          <div className="relative mx-auto mt-16 max-w-4xl">
            <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-blue-900/20">
              {/* Window chrome */}
              <div className="flex items-center gap-2 border-b border-slate-700 bg-slate-800 px-4 py-3">
                <div className="h-3 w-3 rounded-full bg-red-500/60" />
                <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
                <div className="h-3 w-3 rounded-full bg-green-500/60" />
                <span className="ml-4 text-xs text-slate-500">
                  app.relay.io — LinkedIn Autopilot
                </span>
              </div>

              <div className="p-6">
                {/* Stat cards */}
                <div className="mb-6 grid grid-cols-3 gap-4">
                  {[
                    { label: "Posts Published", value: "47" },
                    { label: "Total Reach", value: "12.4k" },
                    { label: "Approval Rate", value: "94%" },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-xl bg-slate-800 p-4">
                      <p className="text-xs text-slate-500">{stat.label}</p>
                      <p className="mt-1 text-2xl font-bold text-white">{stat.value}</p>
                    </div>
                  ))}
                </div>

                {/* Chart */}
                <div className="flex h-28 items-end gap-1 rounded-xl bg-slate-800 px-4 py-3">
                  {[22, 38, 30, 55, 44, 68, 62, 80, 74, 88, 82, 100].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm bg-gradient-to-t from-teal-500 to-blue-400 opacity-75"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>

                {/* Post preview cards */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[
                    { title: "AI-Generated Post", sub: "Ready for review" },
                    { title: "Scheduled for Tomorrow", sub: "Approved ✓" },
                  ].map((card) => (
                    <div
                      key={card.title}
                      className="flex items-center gap-3 rounded-xl bg-slate-800 p-3"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-400/20">
                        <FaLinkedinIn className="h-4 w-4 text-teal-400" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-white">{card.title}</p>
                        <p className="text-xs text-slate-500">{card.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Products ── */}
      <section id="products" className="bg-slate-950 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold md:text-4xl">
              Everything you need to{" "}
              <span className="bg-gradient-to-r from-teal-400 to-blue-400 bg-clip-text text-transparent">
                grow on LinkedIn
              </span>
            </h2>
            <p className="mt-4 text-slate-400">Two powerful products, one intelligent platform</p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* LinkedIn Autopilot */}
            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-8 transition-colors hover:border-teal-400/50">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-400/10">
                <LuBrain className="h-6 w-6 text-teal-400" />
              </div>
              <h3 className="mb-3 text-xl font-bold">LinkedIn Autopilot</h3>
              <p className="mb-6 text-sm leading-relaxed text-slate-400">
                AI-powered content generation and scheduling. Turn your knowledge base into engaging
                LinkedIn posts that get approved and published automatically.
              </p>
              <ul className="mb-8 space-y-2.5">
                {[
                  "AI post generation from your knowledge base",
                  "Review & approval workflow",
                  "Image generation & upload",
                  "Scheduled publishing",
                ].map((feat) => (
                  <li key={feat} className="flex items-center gap-2 text-sm text-slate-300">
                    <LuCheck className="h-4 w-4 shrink-0 text-teal-400" />
                    {feat}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 text-sm font-medium text-teal-400 transition-colors hover:text-teal-300"
              >
                Get started <LuArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Leads */}
            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-8 transition-colors hover:border-blue-400/50">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-400/10">
                <LuUsers className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="mb-3 text-xl font-bold">Leads</h3>
              <p className="mb-6 text-sm leading-relaxed text-slate-400">
                Find and manage your ideal prospects with AI-powered lead sourcing. Build targeted
                pipelines and automate your outreach campaigns.
              </p>
              <ul className="mb-8 space-y-2.5">
                {[
                  "AI-powered lead sourcing",
                  "Prospect pipeline management",
                  "Automated outreach sequences",
                  "Analytics & reporting",
                ].map((feat) => (
                  <li key={feat} className="flex items-center gap-2 text-sm text-slate-300">
                    <LuCheck className="h-4 w-4 shrink-0 text-blue-400" />
                    {feat}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 text-sm font-medium text-blue-400 transition-colors hover:text-blue-300"
              >
                Get started <LuArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="border-y border-slate-800 bg-slate-900 py-14">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid grid-cols-2 gap-8 text-center md:grid-cols-4">
            {[
              { value: "2,500+", label: "Companies" },
              { value: "50k+", label: "Posts generated" },
              { value: "94%", label: "Avg. approval rate" },
              { value: "3.2x", label: "Engagement lift" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-3xl font-bold text-white">{s.value}</p>
                <p className="mt-1 text-sm text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-gradient-to-b from-slate-950 to-slate-900 py-24">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-3xl font-bold md:text-4xl">Ready to grow your business with AI?</h2>
          <p className="mt-4 text-slate-400">
            Join thousands of teams using Relay to find leads and grow their LinkedIn presence on
            autopilot.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/register"
              className="flex items-center gap-2 rounded-xl bg-teal-400 px-6 py-3.5 text-base font-semibold text-slate-900 transition-colors hover:bg-teal-300"
            >
              Start Free Trial <LuArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="text-sm text-slate-400 transition-colors hover:text-white"
            >
              Already have an account? Sign in →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-800 bg-slate-950 py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-start justify-between gap-10 md:flex-row md:items-center">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-400">
                  <span className="text-xs font-bold text-white">R</span>
                </div>
                <span className="font-bold text-white">Relay</span>
              </div>
              <p className="text-xs text-slate-500">AI-powered LinkedIn automation platform</p>
            </div>

            <div className="flex flex-wrap gap-10 text-sm">
              <div>
                <p className="mb-3 font-medium text-white">Products</p>
                <div className="space-y-2">
                  <Link
                    href="/register"
                    className="block text-slate-400 transition-colors hover:text-white"
                  >
                    LinkedIn Autopilot
                  </Link>
                  <Link
                    href="/register"
                    className="block text-slate-400 transition-colors hover:text-white"
                  >
                    Leads
                  </Link>
                </div>
              </div>
              <div>
                <p className="mb-3 font-medium text-white">Account</p>
                <div className="space-y-2">
                  <Link
                    href="/login"
                    className="block text-slate-400 transition-colors hover:text-white"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/register"
                    className="block text-slate-400 transition-colors hover:text-white"
                  >
                    Free Trial
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 border-t border-slate-800 pt-8 text-center text-xs text-slate-600">
            © 2025 Relay. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
