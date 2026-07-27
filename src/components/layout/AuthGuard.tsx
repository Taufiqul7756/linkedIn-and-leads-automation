"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const PUBLIC_ROUTES = ["/", "/login", "/register"];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  const isPublic = PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!token && !isPublic) {
      router.replace("/login");
    } else if (token && isPublic) {
      router.replace("/linkedin-autopilot");
    }
  }, [token, isPublic, router, mounted]);

  // Before mount: render children so SSR and first client render match (no hydration mismatch).
  // After mount: apply auth guard — redirect handled by useEffect above.
  if (!mounted) return <>{children}</>;
  if (!token && !isPublic) return null;
  if (token && isPublic) return null;

  return <>{children}</>;
}
