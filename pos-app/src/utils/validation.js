// Validation utilities

/**
 * Validates a phone number for Sri Lanka format
 * Accepts:
 * - Empty string (optional)
 * - Local format: 10 digits (e.g., 0776578098)
 * - International format: +94 followed by 9 digits (e.g., +940776578098 or 940776578098)
 * @param {string} phone - The phone number to validate
 * @returns {object} - { isValid: boolean, error: string | null }
 */
export const validatePhoneNumber = (phone) => {
    if (!phone || phone.trim() === '') {
        return { isValid: true, error: null }; // Optional field
    }

    const rawPhone = phone.trim();
    const normalizedPhone = rawPhone.replace(/\D/g, ''); // Remove all non-digits

    // Local phone: exactly 10 digits
    const isLocalPhone = normalizedPhone.length === 10;

    // International with country code: 12 digits starting with 94
    const isSriLankaWithCode = normalizedPhone.length === 12 && normalizedPhone.startsWith('94');

    if (!isLocalPhone && !isSriLankaWithCode) {
        return {
            isValid: false,
            error: 'Phone number must be local 10 digits (e.g., 0776578098) or Sri Lanka +94 format (e.g., +94 0776578098 or 940776578098).'
        };
    }

    return { isValid: true, error: null };
};

/**
 * Validates a non-negative quantity.
 * Accepts zero and positive numbers (>= 0).
 * @param {number|string} value - The quantity value to validate.
 * @param {string} fieldName - Optional field label for error messages.
 * @returns {{isValid: boolean, error: string|null}}
 */
export const validateNonNegativeQuantity = (value, fieldName = 'Quantity') => {
    const qty = Number(value);
    if (isNaN(qty) || qty < 0) {
        return { isValid: false, error: `${fieldName} must be a number greater than or equal to 0.` };
    }
    return { isValid: true, error: null };
};

/**
 * Validates a positive cost.
 * Cost must be greater than 0.
 * @param {number|string} value - The cost value to validate.
 * @param {string} fieldName - Optional field label for error messages.
 * @returns {{isValid: boolean, error: string|null}}
 */
export const validatePositiveCost = (value, fieldName = 'Cost') => {
    const cost = Number(value);
    if (isNaN(cost) || cost <= 0) {
        return { isValid: false, error: `${fieldName} must be a number greater than 0.` };
    }
    return { isValid: true, error: null };
};

/**
 * Formats a phone number for display
 * @param {string} phone - The phone number to format
 * @returns {string} - Formatted phone number
 */
export const formatPhoneNumber = (phone) => {
    if (!phone || phone.trim() === '') return '';

    const normalized = phone.replace(/\D/g, '');
    if (normalized.length === 10) {
        // Format local: 077 657 8098
        return `${normalized.slice(0, 3)} ${normalized.slice(3, 6)} ${normalized.slice(6)}`;
    } else if (normalized.length === 12 && normalized.startsWith('94')) {
        // Format international: +94 77 657 8098
        return `+94 ${normalized.slice(2, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7)}`;
    }
    return phone; // Return as-is if doesn't match patterns
};