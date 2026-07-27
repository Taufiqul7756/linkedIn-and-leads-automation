"use client";
import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { LuLink } from "react-icons/lu";

interface ProfileUrlModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileUrlModal({ isOpen, onClose }: ProfileUrlModalProps) {
  const [url, setUrl] = useState("");

  const handleSave = () => {
    // API will come — placeholder
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Your Profile URL" width="md">
      <p className="mb-5 text-sm text-gray-500">
        Add your LinkedIn profile URL so Relay can personalise content to your voice and audience.
      </p>

      <div>
        <label htmlFor="profile-url" className="mb-1.5 block text-sm font-medium text-gray-700">
          LinkedIn Profile URL
        </label>
        <div className="relative">
          <LuLink className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            id="profile-url"
            type="url"
            placeholder="https://www.linkedin.com/in/yourname"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2.5">
        <button
          onClick={onClose}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!url.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </Modal>
  );
}
