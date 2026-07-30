'use client';

import React, { useState, useCallback } from 'react';
import { StrKey } from '@stellar/stellar-sdk';

export interface AddressFormProps {
  onSubmit: (address: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  initialValue?: string;
}

/**
 * Validates a Stellar public key (G... address).
 */
export function validateStellarAddress(address: string): {
  valid: boolean;
  error?: string;
} {
  if (!address.trim()) {
    return { valid: false, error: 'Address is required' };
  }
  if (!address.startsWith('G')) {
    return { valid: false, error: 'Stellar addresses must start with G' };
  }
  if (address.length !== 56) {
    return { valid: false, error: 'Stellar addresses must be 56 characters' };
  }
  try {
    if (!StrKey.isValidEd25519PublicKey(address)) {
      return { valid: false, error: 'Invalid Stellar address checksum' };
    }
  } catch {
    return { valid: false, error: 'Invalid Stellar address format' };
  }
  return { valid: true };
}

/**
 * Address input form with real-time Stellar address validation.
 */
export function AddressForm({
  onSubmit,
  label = 'Stellar Address',
  placeholder = 'G...',
  disabled = false,
  initialValue = '',
}: AddressFormProps) {
  const [address, setAddress] = useState(initialValue);
  const [error, setError] = useState<string | undefined>();
  const [touched, setTouched] = useState(false);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    setAddress(val);
    if (touched && val) {
      const result = validateStellarAddress(val);
      setError(result.error);
    } else if (!val) {
      setError(undefined);
    }
  }, [touched]);

  const handleBlur = useCallback(() => {
    setTouched(true);
    if (address) {
      const result = validateStellarAddress(address);
      setError(result.error);
    }
  }, [address]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const result = validateStellarAddress(address);
    if (result.valid) {
      setError(undefined);
      onSubmit(address);
    } else {
      setError(result.error);
    }
  }, [address, onSubmit]);

  return (
    <form onSubmit={handleSubmit} data-testid="address-form">
      <label
        htmlFor="stellar-address"
        style={{ display: 'block', marginBottom: '8px', fontWeight: 500, fontSize: '14px' }}
      >
        {label}
      </label>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          id="stellar-address"
          type="text"
          value={address}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          data-testid="address-input"
          aria-invalid={!!error}
          aria-describedby={error ? 'address-error' : undefined}
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: '8px',
            border: `1px solid ${error ? '#ef4444' : '#d1d5db'}`,
            fontSize: '14px',
            fontFamily: 'monospace',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={disabled || !!error || !address}
          data-testid="submit-button"
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: disabled || !!error || !address ? '#9ca3af' : '#3b82f6',
            color: 'white',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          Submit
        </button>
      </div>
      {error && (
        <p
          id="address-error"
          data-testid="address-error"
          style={{ color: '#ef4444', fontSize: '13px', marginTop: '6px' }}
          role="alert"
        >
          {error}
        </p>
      )}
    </form>
  );
}

export default AddressForm;
