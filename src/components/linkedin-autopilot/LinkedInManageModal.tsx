import Modal from "@/components/ui/Modal";
import { FaLinkedinIn } from "react-icons/fa";
import { LuShieldCheck, LuCircleUser, LuUnlink, LuLoader } from "react-icons/lu";
import { LinkedInAccountResponse } from "@/types/LinkedIn";
import LinkedInAvatar from "@/components/linkedin/LinkedInAvatar";

interface LinkedInManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: LinkedInAccountResponse | undefined;
  onConnect: () => void;
  isConnecting: boolean;
  onDisconnect: () => void;
  isDisconnecting: boolean;
}

export default function LinkedInManageModal({
  isOpen,
  onClose,
  account,
  onConnect,
  isConnecting,
  onDisconnect,
  isDisconnecting,
}: LinkedInManageModalProps) {
  const isConnected = account?.connected ?? false;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="LinkedIn Account" width="md">
      {/* Connection status */}
      <div
        className={`mb-6 flex items-start gap-4 rounded-xl border px-4 py-3.5 ${
          isConnected ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"
        }`}
      >
        {isConnected && account?.picture_url ? (
          <div className="relative shrink-0">
            <LinkedInAvatar
              pictureUrl={account.picture_url}
              name={account.name}
              className="h-10 w-10 rounded-full"
              fallback={
                <div className="flex h-full w-full items-center justify-center bg-blue-600">
                  <FaLinkedinIn className="h-5 w-5 text-white" />
                </div>
              }
            />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-linkedin ring-2 ring-white">
              <FaLinkedinIn className="h-2.5 w-2.5 text-white" />
            </span>
          </div>
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600">
            <FaLinkedinIn className="h-5 w-5 text-white" />
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">
              {isConnected ? account?.name : "No account connected"}
            </span>
            <span
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                isConnected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-green-500" : "bg-gray-400"}`}
              />
              {isConnected ? "Connected" : "Not connected"}
            </span>
          </div>
          {isConnected && <p className="mt-0.5 text-xs text-gray-500">authorized via OAuth</p>}
        </div>
      </div>

      {/* Permission details — only when connected */}
      {isConnected && (
        <div className="mb-6 space-y-2.5">
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <LuShieldCheck className="h-4 w-4 shrink-0 text-green-500" />
            Publish posts enabled
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <LuCircleUser className="h-4 w-4 shrink-0 text-green-500" />
            Profile access granted · 1 account connected
          </div>
        </div>
      )}

      {/* Connect / Reconnect button */}
      <button
        className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
        onClick={onConnect}
        disabled={isConnecting}
      >
        {isConnecting ? (
          <LuLoader className="h-4 w-4 animate-spin" />
        ) : (
          <FaLinkedinIn className="h-4 w-4" />
        )}
        {isConnected ? "Reconnect LinkedIn" : "Connect your LinkedIn"}
      </button>

      {/* Disconnect link — only when connected */}
      {isConnected && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={onDisconnect}
            disabled={isDisconnecting}
            className="flex items-center gap-1.5 text-xs text-red-400 transition-colors hover:text-red-600 disabled:opacity-50"
          >
            <LuUnlink className="h-3.5 w-3.5" />
            {isDisconnecting ? "Disconnecting…" : "Disconnect account"}
          </button>
        </div>
      )}
    </Modal>
  );
}
