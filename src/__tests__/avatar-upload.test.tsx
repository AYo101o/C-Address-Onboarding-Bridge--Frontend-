// @vitest-environment jsdom
import React, { act } from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { AvatarUpload } from "@/components/avatar-upload";

// Set React act environment flag for jsdom test runner
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("AvatarUpload Component", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let mockOnAvatarChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockOnAvatarChange = vi.fn();
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    root = null;
    vi.restoreAllMocks();
  });

  it("renders upload area when no avatar is provided", async () => {
    await act(async () => {
      root?.render(<AvatarUpload onAvatarChange={mockOnAvatarChange} />);
    });

    const uploadArea = container?.querySelector("button");
    expect(uploadArea).not.toBeNull();
    expect(container?.textContent).toContain("Click to upload avatar");
  });

  it("renders current avatar when provided", async () => {
    const currentAvatar = "data:image/png;base64,test";
    await act(async () => {
      root?.render(<AvatarUpload currentAvatar={currentAvatar} onAvatarChange={mockOnAvatarChange} />);
    });

    const avatarImage = container?.querySelector("img");
    expect(avatarImage).not.toBeNull();
    expect(avatarImage?.getAttribute("src")).toBe(currentAvatar);
  });

  it("opens file dialog when upload area is clicked", async () => {
    await act(async () => {
      root?.render(<AvatarUpload onAvatarChange={mockOnAvatarChange} />);
    });

    const uploadArea = container?.querySelector("button");
    await act(async () => {
      uploadArea?.click();
    });

    const fileInput = container?.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();
  });

  it("handles valid file selection", async () => {
    await act(async () => {
      root?.render(<AvatarUpload onAvatarChange={mockOnAvatarChange} />);
    });

    const fileInput = container?.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;

    await act(async () => {
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(mockOnAvatarChange).toHaveBeenCalled();
  });

  it("shows error for invalid file type", async () => {
    await act(async () => {
      root?.render(<AvatarUpload onAvatarChange={mockOnAvatarChange} />);
    });

    const fileInput = container?.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["test"], "test.pdf", { type: "application/pdf" });
    
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;

    await act(async () => {
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(container?.textContent).toContain("Invalid file type");
    expect(mockOnAvatarChange).not.toHaveBeenCalled();
  });

  it("shows error for file size exceeding limit", async () => {
    await act(async () => {
      root?.render(<AvatarUpload onAvatarChange={mockOnAvatarChange} maxSizeKB={100} />);
    });

    const fileInput = container?.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["x".repeat(200 * 1024)], "test.jpg", { type: "image/jpeg" });
    
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;

    await act(async () => {
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(container?.textContent).toContain("File size exceeds");
    expect(mockOnAvatarChange).not.toHaveBeenCalled();
  });

  it("removes avatar when remove button is clicked", async () => {
    const currentAvatar = "data:image/png;base64,test";
    await act(async () => {
      root?.render(<AvatarUpload currentAvatar={currentAvatar} onAvatarChange={mockOnAvatarChange} />);
    });

    const removeButton = container?.querySelector('button[aria-label="Remove avatar"]');
    await act(async () => {
      removeButton?.click();
    });

    expect(mockOnAvatarChange).toHaveBeenCalledWith(null);
    expect(container?.querySelector("img")).toBeNull();
  });

  it("displays helper text with size and type information", async () => {
    await act(async () => {
      root?.render(<AvatarUpload onAvatarChange={mockOnAvatarChange} maxSizeKB={500} />);
    });

    expect(container?.textContent).toContain("Max 500KB");
    expect(container?.textContent).toContain("jpeg");
    expect(container?.textContent).toContain("png");
    expect(container?.textContent).toContain("webp");
  });
});
