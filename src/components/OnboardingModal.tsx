'use client';

import React, { useState, useCallback, useEffect } from 'react';

export interface OnboardingStep {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

export interface OnboardingModalProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Called when the modal should close */
  onClose: () => void;
  /** Called when onboarding is completed */
  onComplete: () => void;
  /** The steps to display */
  steps: OnboardingStep[];
  /** Optional initial step index */
  initialStep?: number;
}

/**
 * A multi-step onboarding modal that guides users through
 * the C-Address onboarding flow.
 */
export function OnboardingModal({
  isOpen,
  onClose,
  onComplete,
  steps,
  initialStep = 0,
}: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);

  // Reset step when modal opens. The synchronous setState is the point: the
  // modal stays mounted between openings, so `isOpen` flipping true is the only
  // signal that the walkthrough should start over from `initialStep`. It runs
  // once per open, not on every render.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isOpen) setCurrentStep(initialStep);
  }, [isOpen, initialStep]);

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onComplete();
    }
  }, [currentStep, steps.length, onComplete]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  if (!isOpen || steps.length === 0) return null;

  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div
      className="onboarding-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Onboarding"
      onKeyDown={handleKeyDown}
      data-testid="onboarding-modal"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
    >
      {/* max-h + overflow-y so a long description on a short viewport (mobile
          landscape, a small popup window) scrolls inside the dialog instead of
          pushing the Next/Back controls off-screen with no way to reach them. */}
      <div
        className="onboarding-content card w-full max-w-[480px] max-h-[90vh] overflow-y-auto p-8"
        style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
      >
        {/* Progress bar */}
        <div className="h-1 rounded-full bg-[var(--surface-2)] mb-6 overflow-hidden">
          <div
            data-testid="progress-bar"
            className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-300 ease-in-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step indicator */}
        <p className="text-sm text-[var(--text-muted)] mb-2" data-testid="step-indicator">
          Step {currentStep + 1} of {steps.length}
        </p>

        {/* Step content */}
        {step.icon && <div className="mb-4">{step.icon}</div>}
        <h2 className="text-2xl font-semibold mb-3 text-[var(--foreground)]" data-testid="step-title">
          {step.title}
        </h2>
        <p className="text-base text-[var(--text-muted)] mb-8 leading-relaxed" data-testid="step-description">
          {step.description}
        </p>

        {/* Navigation buttons */}
        <div className="flex justify-between gap-3">
          {!isFirst ? (
            <button
              type="button"
              onClick={handleBack}
              data-testid="back-button"
              className="px-6 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--foreground)] text-sm hover:bg-[var(--border)] transition-colors"
            >
              Back
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              data-testid="skip-button"
              className="px-6 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--foreground)] text-sm hover:bg-[var(--border)] transition-colors"
            >
              Skip
            </button>
          )}
          <button
            type="button"
            onClick={handleNext}
            data-testid="next-button"
            className="px-6 py-2.5 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:bg-[var(--primary)]/90 transition-colors"
          >
            {isLast ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default OnboardingModal;
