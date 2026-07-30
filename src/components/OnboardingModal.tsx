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

  // Reset step when modal opens
  useEffect(() => {
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
      className="onboarding-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Onboarding"
      onKeyDown={handleKeyDown}
      data-testid="onboarding-modal"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 50,
      }}
    >
      <div
        className="onboarding-content"
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '32px',
          maxWidth: '480px',
          width: '100%',
          margin: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* Progress bar */}
        <div
          style={{
            height: '4px',
            backgroundColor: '#e5e7eb',
            borderRadius: '2px',
            marginBottom: '24px',
            overflow: 'hidden',
          }}
        >
          <div
            data-testid="progress-bar"
            style={{
              height: '100%',
              width: `${progress}%`,
              backgroundColor: '#3b82f6',
              borderRadius: '2px',
              transition: 'width 0.3s ease',
            }}
          />
        </div>

        {/* Step indicator */}
        <p
          style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}
          data-testid="step-indicator"
        >
          Step {currentStep + 1} of {steps.length}
        </p>

        {/* Step content */}
        {step.icon && (
          <div style={{ marginBottom: '16px' }}>{step.icon}</div>
        )}
        <h2
          style={{
            fontSize: '24px',
            fontWeight: 600,
            marginBottom: '12px',
            color: '#111827',
          }}
          data-testid="step-title"
        >
          {step.title}
        </h2>
        <p
          style={{ fontSize: '16px', color: '#4b5563', marginBottom: '32px', lineHeight: 1.6 }}
          data-testid="step-description"
        >
          {step.description}
        </p>

        {/* Navigation buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          {!isFirst ? (
            <button
              onClick={handleBack}
              data-testid="back-button"
              style={{
                padding: '10px 24px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                backgroundColor: 'white',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Back
            </button>
          ) : (
            <button
              onClick={onClose}
              data-testid="skip-button"
              style={{
                padding: '10px 24px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                backgroundColor: 'white',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Skip
            </button>
          )}
          <button
            onClick={handleNext}
            data-testid="next-button"
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#3b82f6',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            {isLast ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default OnboardingModal;
