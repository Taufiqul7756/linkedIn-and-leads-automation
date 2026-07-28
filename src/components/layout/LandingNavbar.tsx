"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { LuChevronDown, LuMenu, LuX } from "react-icons/lu";
import { FaLinkedinIn } from "react-icons/fa";
import { LuUsers } from "react-icons/lu";

const products = [
  {
    name: "LinkedIn Autopilot",
    href: "/linkedin-autopilot",
    desc: "AI-powered content generation & scheduling",
    icon: <FaLinkedinIn className="h-4 w-4 text-teal-500" />,
  },
  {
    name: "Leads",
    href: "/leads",
    desc: "Find and manage your ideal prospects",
    icon: <LuUsers className="h-4 w-4 text-blue-500" />,
  },
];

export default function LandingNavbar() {
  const [productsOpen, setProductsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!productsOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProductsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [productsOpen]);

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500">
            <span className="text-sm font-bold text-white">R</span>
          </div>
          <span className="text-lg font-bold text-slate-900">Relay</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-8 md:flex">
          {/* Products dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setProductsOpen((v) => !v)}
              className="flex items-center gap-1 text-sm text-slate-600 transition-colors hover:text-slate-900"
            >
              Products
              <LuChevronDown
                className={`h-4 w-4 transition-transform ${productsOpen ? "rotate-180" : ""}`}
              />
            </button>
            {productsOpen && (
              <div className="absolute left-0 top-full mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                {products.map((p) => (
                  <Link
                    key={p.name}
                    href={p.href}
                    onClick={() => setProductsOpen(false)}
                    className="flex items-start gap-3 rounded-lg px-4 py-3 transition-colors hover:bg-slate-50"
                  >
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                      {p.icon}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-800">{p.name}</div>
                      <div className="mt-0.5 text-xs text-slate-400">{p.desc}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <span className="flex cursor-default items-center gap-1.5 text-sm text-slate-400">
            Pricing
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-400">
              Soon
            </span>
          </span>
        </div>

        {/* Auth buttons */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="text-sm text-slate-600 transition-colors hover:text-slate-900"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-600"
          >
            Free Trial
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="text-slate-600 hover:text-slate-900 md:hidden"
        >
          {mobileOpen ? <LuX className="h-6 w-6" /> : <LuMenu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-6 py-5 md:hidden">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Products
          </p>
          {products.map((p) => (
            <Link
              key={p.name}
              href={p.href}
              onClick={() => setMobileOpen(false)}
              className="block py-2 text-sm text-slate-600 hover:text-slate-900"
            >
              {p.name}
            </Link>
          ))}
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-400">
            Pricing
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-400">
              Soon
            </span>
          </div>
          <div className="mt-5 flex items-center gap-4 border-t border-slate-200 pt-5">
            <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900">
              Login
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white"
            >
              Free Trial
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
