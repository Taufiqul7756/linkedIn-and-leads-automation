import Link from "next/link";
import LandingNavbar from "@/components/layout/LandingNavbar";
import {
  LuArrowRight,
  LuBrain,
  LuUsers,
  LuZap,
  LuCheck,
  LuShield,
  LuTrendingUp,
} from "react-icons/lu";
import { FaLinkedinIn } from "react-icons/fa";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#E9ECF5] text-slate-800">
      <LandingNavbar />

      {/* ── Hero ── */}
      <section className="relative flex min-h-screen items-center overflow-hidden pt-16">
        {/* Subtle gradient orb */}
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-gradient-to-br from-teal-300/20 via-blue-300/15 to-transparent blur-3xl" />

        <div className="relative mx-auto w-full max-w-7xl px-6 py-24 text-center">
          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-teal-400/40 bg-teal-50 px-4 py-1.5 text-sm font-medium text-teal-700">
            <LuZap className="h-3.5 w-3.5" />
            AI-Powered Lead Generation &amp; LinkedIn Automation
          </div>

          {/* Headline */}
          <h1 className="text-5xl font-bold leading-tight tracking-tight text-slate-900 md:text-6xl lg:text-7xl">
            The AI Platform for
            <br />
            <span className="bg-gradient-to-r from-teal-500 to-blue-500 bg-clip-text text-transparent">
              B2B Growth
            </span>{" "}
            &amp; Outreach
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-500">
            Find your ideal prospects with AI-powered lead sourcing, then turn them into customers
            with automated LinkedIn content and outreach — all in one platform.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/register"
              className="flex items-center gap-2 rounded-xl bg-teal-500 px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-teal-600"
            >
              Start Free Trial <LuArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#products"
              className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-base font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-400 hover:text-slate-900"
            >
              See Products
            </a>
          </div>

          <p className="mt-6 text-sm text-slate-400">No credit card required · Free 14-day trial</p>

          {/* App mockup */}
          <div className="relative mx-auto mt-16 max-w-4xl">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/40">
              {/* Window chrome */}
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
                <div className="h-3 w-3 rounded-full bg-red-400/70" />
                <div className="h-3 w-3 rounded-full bg-yellow-400/70" />
                <div className="h-3 w-3 rounded-full bg-green-400/70" />
                <span className="ml-4 text-xs text-slate-400">
                  app.relay.io — LinkedIn Autopilot
                </span>
              </div>

              <div className="bg-[#E9ECF5] p-6">
                {/* Stat cards */}
                <div className="mb-6 grid grid-cols-3 gap-4">
                  {[
                    { label: "Posts Published", value: "47", delta: "+18%" },
                    { label: "Total Reach", value: "12.4k", delta: "+32%" },
                    { label: "Approval Rate", value: "94%", delta: "+6%" },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-xl bg-white p-4 shadow-sm">
                      <p className="text-xs text-slate-500">{stat.label}</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">{stat.value}</p>
                      <p className="mt-0.5 text-xs font-medium text-teal-600">{stat.delta}</p>
                    </div>
                  ))}
                </div>

                {/* Chart */}
                <div className="flex h-28 items-end gap-1 rounded-xl bg-white px-4 py-3 shadow-sm">
                  {[22, 38, 30, 55, 44, 68, 62, 80, 74, 88, 82, 100].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm bg-gradient-to-t from-teal-500 to-blue-400 opacity-80"
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
                      className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50">
                        <FaLinkedinIn className="h-4 w-4 text-teal-500" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-800">{card.title}</p>
                        <p className="text-xs text-slate-400">{card.sub}</p>
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
      <section id="products" className="bg-[#E9ECF5] py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
              Everything you need to{" "}
              <span className="bg-gradient-to-r from-teal-500 to-blue-500 bg-clip-text text-transparent">
                grow on LinkedIn
              </span>
            </h2>
            <p className="mt-4 text-slate-500">Two powerful products, one intelligent platform</p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* LinkedIn Autopilot */}
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50">
                <LuBrain className="h-6 w-6 text-teal-500" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-slate-900">LinkedIn Autopilot</h3>
              <p className="mb-6 text-sm leading-relaxed text-slate-500">
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
                  <li key={feat} className="flex items-center gap-2 text-sm text-slate-700">
                    <LuCheck className="h-4 w-4 shrink-0 text-teal-500" />
                    {feat}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 text-sm font-medium text-teal-600 transition-colors hover:text-teal-700"
              >
                Get started <LuArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Leads */}
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                <LuUsers className="h-6 w-6 text-blue-500" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-slate-900">Leads</h3>
              <p className="mb-6 text-sm leading-relaxed text-slate-500">
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
                  <li key={feat} className="flex items-center gap-2 text-sm text-slate-700">
                    <LuCheck className="h-4 w-4 shrink-0 text-blue-500" />
                    {feat}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
              >
                Get started <LuArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="border-y border-slate-200 bg-white py-14">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid grid-cols-2 gap-8 text-center md:grid-cols-4">
            {[
              { value: "2,500+", label: "Companies" },
              { value: "50k+", label: "Posts generated" },
              { value: "94%", label: "Avg. approval rate" },
              { value: "3.2x", label: "Engagement lift" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-3xl font-bold text-slate-900">{s.value}</p>
                <p className="mt-1 text-sm text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why Relay ── */}
      <section className="bg-[#E9ECF5] py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
              Why teams choose Relay
            </h2>
            <p className="mt-4 text-slate-500">Built for the way modern B2B teams work</p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {[
              {
                icon: <LuZap className="h-5 w-5 text-teal-500" />,
                title: "Generate in seconds",
                desc: "Turn your docs, websites, and knowledge base into polished LinkedIn posts instantly.",
              },
              {
                icon: <LuShield className="h-5 w-5 text-blue-500" />,
                title: "Always on-brand",
                desc: "Every post goes through your review workflow before it ever goes live.",
              },
              {
                icon: <LuTrendingUp className="h-5 w-5 text-teal-500" />,
                title: "Track what works",
                desc: "See approval rates, reach, and engagement growth — all in one dashboard.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50">
                  {item.icon}
                </div>
                <h3 className="mb-2 font-semibold text-slate-900">{item.title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-gradient-to-br from-teal-600 to-blue-600 py-24">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white md:text-4xl">
            Ready to grow your business with AI?
          </h2>
          <p className="mt-4 text-teal-100">
            Join thousands of teams using Relay to find leads and grow their LinkedIn presence on
            autopilot.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/register"
              className="flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-base font-semibold text-teal-700 shadow-sm transition-colors hover:bg-teal-50"
            >
              Start Free Trial <LuArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="text-sm text-teal-100 transition-colors hover:text-white"
            >
              Already have an account? Sign in →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 bg-white py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-start justify-between gap-10 md:flex-row md:items-center">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500">
                  <span className="text-xs font-bold text-white">R</span>
                </div>
                <span className="font-bold text-slate-900">Relay</span>
              </div>
              <p className="text-xs text-slate-400">AI-powered LinkedIn automation platform</p>
            </div>

            <div className="flex flex-wrap gap-10 text-sm">
              <div>
                <p className="mb-3 font-medium text-slate-900">Products</p>
                <div className="space-y-2">
                  <Link
                    href="/register"
                    className="block text-slate-500 transition-colors hover:text-slate-900"
                  >
                    LinkedIn Autopilot
                  </Link>
                  <Link
                    href="/register"
                    className="block text-slate-500 transition-colors hover:text-slate-900"
                  >
                    Leads
                  </Link>
                </div>
              </div>
              <div>
                <p className="mb-3 font-medium text-slate-900">Account</p>
                <div className="space-y-2">
                  <Link
                    href="/login"
                    className="block text-slate-500 transition-colors hover:text-slate-900"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/register"
                    className="block text-slate-500 transition-colors hover:text-slate-900"
                  >
                    Free Trial
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 border-t border-slate-100 pt-8 text-center text-xs text-slate-400">
            © 2025 Relay. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
