"use client";

import { useState, useRef } from "react";
import { Upload, X, Camera } from "lucide-react";

interface AvatarUploadProps {
  currentAvatar?: string;
  onAvatarChange: (avatarUrl: string | null) => void;
  maxSizeKB?: number;
  acceptedTypes?: string[];
}

export function AvatarUpload({
  currentAvatar,
  onAvatarChange,
  maxSizeKB = 500,
  acceptedTypes = ["image/jpeg", "image/png", "image/webp"],
}: AvatarUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentAvatar || null);
  const [error, setError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!acceptedTypes.includes(file.type)) {
      setError("Invalid file type. Please upload JPEG, PNG, or WebP.");
      return;
    }

    // Validate file size
    if (file.size > maxSizeKB * 1024) {
      setError(`File size exceeds ${maxSizeKB}KB limit.`);
      return;
    }

    setError("");

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPreview(result);
      onAvatarChange(result);
    };
    reader.onerror = () => {
      setError("Failed to read file. Please try again.");
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import {
  AVATAR_ACCEPT_ATTR,
  avatarInitials,
  isRenderableAvatar,
  loadAvatar,
  removeAvatar,
  saveAvatar,
  validateAvatarFile,
} from "@/lib/avatar";

interface AvatarUploadProps {
  /** Wallet address the avatar belongs to. Upload is disabled without one. */
  address: string | null;
  /** Rendered size in pixels. */
  size?: number;
}

/**
 * Lets a connected user set a local profile image for their address (#342).
 *
 * The image never leaves the browser: it is read with `FileReader` into a data
 * URL and stored in `localStorage` under `avatar:<address>`. Switching
 * addresses reloads that address's avatar; see `src/lib/avatar.ts` and
 * `docs/caching.md` for the storage contract.
 */
export default function AvatarUpload({ address, size = 56 }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  // Read from storage after mount only: touching localStorage during render
  // would produce different server and client output and break hydration. The
  // synchronous setState is the point — it is how the external store is pulled
  // into React state, and it re-runs only when the address changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAvatar(loadAvatar(address));
    setError(null);
  }, [address]);

  const openPicker = () => {
    setError(null);
    inputRef.current?.click();
  };

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Always reset the input so re-picking the same file fires `change` again.
    event.target.value = "";
    if (!file || !address) return;

    const validation = validateAvatarFile(file);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setError(null);
    setReading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setReading(false);
      const result = reader.result;
      if (!isRenderableAvatar(result)) {
        setError("That image couldn't be read. Try a different file.");
        return;
      }
      if (!saveAvatar(address, result)) {
        setError("Couldn't save the image — browser storage may be full.");
        return;
      }
      setAvatar(result);
    };
    reader.onerror = () => {
      setReading(false);
      setError("That image couldn't be read. Try a different file.");
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = () => {
    setPreview(null);
    onAvatarChange(null);
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative group">
        {/* Avatar Preview */}
        <div
          onClick={handleClick}
          className="w-24 h-24 rounded-full border-2 border-dashed border-[var(--border)] bg-[var(--surface)] flex items-center justify-center cursor-pointer overflow-hidden hover:border-[var(--primary)] transition-colors"
        >
          {preview ? (
            <img
              src={preview}
              alt="Avatar preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <Camera className="w-8 h-8 text-[var(--text-muted)]" />
          )}
        </div>

        {/* Remove Button */}
        {preview && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRemove();
            }}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
            aria-label="Remove avatar"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Upload Overlay */}
        <div
          onClick={handleClick}
          className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
        >
          <Upload className="w-6 h-6 text-white" />
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes.join(",")}
        onChange={handleFileSelect}
        className="hidden"
        aria-label="Upload avatar"
      />

      {/* Error Message */}
      {error && (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}

      {/* Helper Text */}
      {!preview && (
        <p className="text-xs text-[var(--text-muted)] text-center">
          Click to upload avatar<br />
          Max {maxSizeKB}KB • {acceptedTypes.map((t) => t.split("/")[1]).join(", ")}
        </p>
      )}
    removeAvatar(address);
    setAvatar(null);
    setError(null);
  };

  const boxStyle = { width: size, height: size };

  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0" style={boxStyle}>
        <div
          className="w-full h-full rounded-full overflow-hidden bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center"
          style={boxStyle}
        >
          {avatar ? (
            // A data URL, not a remote asset: next/image cannot optimise it and
            // would only add client JS for no benefit.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt="Your profile avatar"
              width={size}
              height={size}
              className="w-full h-full object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="text-sm font-semibold font-mono text-[var(--text-muted)]"
            >
              {avatarInitials(address)}
            </span>
          )}
        </div>
        {reading && (
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none text-white" />
          </div>
        )}
      </div>

      <div className="min-w-0">
        <input
          ref={inputRef}
          type="file"
          accept={AVATAR_ACCEPT_ATTR}
          onChange={handleFile}
          className="sr-only"
          // The visible buttons below are the accessible controls; this input is
          // kept out of the tab order so focus is not trapped on a hidden field.
          tabIndex={-1}
          aria-hidden="true"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openPicker}
            disabled={!address || reading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-xs font-medium hover:border-[var(--text-muted)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Camera className="w-3.5 h-3.5 shrink-0" />
            {avatar ? "Change avatar" : "Upload avatar"}
          </button>
          {avatar && (
            <button
              type="button"
              onClick={handleRemove}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-transparent text-xs font-medium text-[var(--text-muted)] hover:text-[var(--error)] transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              Remove
            </button>
          )}
        </div>
        <p aria-live="polite" className="mt-1 text-xs text-[var(--text-muted)] break-words">
          {error ? (
            <span className="text-[var(--error)]">{error}</span>
          ) : (
            "PNG, JPEG, WebP or GIF, up to 512 KB. Stored only in this browser."
          )}
        </p>
      </div>
    </div>
  );
}
