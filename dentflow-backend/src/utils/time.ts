/**
 * Get current time for business logic.
 * In test environment, can be overridden via MOCK_DATE env var.
 */
export const getCurrentTime = (): Date => {
  if (process.env.NODE_ENV === 'test' && process.env.MOCK_DATE) {
    return new Date(process.env.MOCK_DATE);
  }
  return new Date();
};
