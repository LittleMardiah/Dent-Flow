/**
 * Get current time for business logic.
 * Allows mocking time in tests without using fake timers
 * (which break database connection pools).
 */
export const getCurrentTime = (): Date => {
  if (process.env.NODE_ENV === 'test' && process.env.MOCK_DATE) {
    return new Date(process.env.MOCK_DATE);
  }
  return new Date();
};
