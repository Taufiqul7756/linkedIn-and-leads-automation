import { Suspense } from "react";
import AccountsView from "@/components/linkedin/AccountsView";

export default function AccountsPage() {
  return (
    <Suspense>
      <AccountsView />
    </Suspense>
  );
}
