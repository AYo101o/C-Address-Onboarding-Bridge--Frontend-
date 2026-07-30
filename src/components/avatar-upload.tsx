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
    </div>
  );
}
