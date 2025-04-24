const assert = require('assert');

// Mock data structures
const rateLimits = {};

/**
 * Check if a request is rate limited
 * @param {string} identifier - The identifier to check (IP or socket ID)
 * @param {number} limit - Maximum number of requests allowed in the time window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {boolean} - True if rate limited, false otherwise
 */
function isRateLimited(identifier, limit = 5, windowMs = 60000) {
  const now = Date.now();
  
  // Initialize rate limit entry if it doesn't exist
  if (!rateLimits[identifier]) {
    rateLimits[identifier] = {
      count: 0,
      resetAt: now + windowMs
    };
  }
  
  // Reset count if the window has expired
  if (now > rateLimits[identifier].resetAt) {
    rateLimits[identifier] = {
      count: 0,
      resetAt: now + windowMs
    };
  }
  
  // Increment count and check if rate limited
  rateLimits[identifier].count++;
  
  return rateLimits[identifier].count > limit;
}

/**
 * Clean up expired rate limit entries
 */
function cleanupRateLimits() {
  const now = Date.now();
  let cleanupCount = 0;
  
  for (const identifier in rateLimits) {
    if (now > rateLimits[identifier].resetAt) {
      delete rateLimits[identifier];
      cleanupCount++;
    }
  }
  
  return cleanupCount;
}

// Test suite
describe('Rate Limiting Tests', () => {
  beforeEach(() => {
    // Clear rate limits before each test
    Object.keys(rateLimits).forEach(key => delete rateLimits[key]);
  });

  it('should allow requests within the rate limit', () => {
    const identifier = 'test-ip';
    const limit = 5;
    
    // Make 5 requests (should all be allowed)
    for (let i = 0; i < limit; i++) {
      const isLimited = isRateLimited(identifier, limit);
      assert.strictEqual(isLimited, false, `Request ${i+1} should not be rate limited`);
    }
    
    // Verify the count is at the limit
    assert.strictEqual(rateLimits[identifier].count, limit, 'Count should be at the limit');
  });

  it('should block requests exceeding the rate limit', () => {
    const identifier = 'test-ip';
    const limit = 5;
    
    // Make 5 requests (should all be allowed)
    for (let i = 0; i < limit; i++) {
      isRateLimited(identifier, limit);
    }
    
    // Make one more request (should be blocked)
    const isLimited = isRateLimited(identifier, limit);
    assert.strictEqual(isLimited, true, 'Request exceeding limit should be rate limited');
    
    // Verify the count is above the limit
    assert.strictEqual(rateLimits[identifier].count, limit + 1, 'Count should be above the limit');
  });

  it('should reset the rate limit after the time window expires', function(done) {
    const identifier = 'test-ip';
    const limit = 5;
    const windowMs = 100; // Small window for testing

    // Make 5 requests (should all be allowed)
    for (let i = 0; i < limit; i++) {
      isRateLimited(identifier, limit, windowMs);
    }

    // Make one more request (should be blocked)
    let isLimited = isRateLimited(identifier, limit, windowMs);
    assert.strictEqual(isLimited, true, 'Request exceeding limit should be rate limited');

    // Wait for the window to expire
    setTimeout(() => {
      try {
        // Make another request after window expires (should be allowed)
        isLimited = isRateLimited(identifier, limit, windowMs);
        assert.strictEqual(isLimited, false, 'Request after window expires should not be rate limited');

        // Verify the count was reset
        assert.strictEqual(rateLimits[identifier].count, 1, 'Count should be reset to 1');

        done();
      } catch (err) {
        done(err);
      }
    }, windowMs + 10);
  });

  it('should clean up expired rate limit entries', function(done) {
    const windowMs = 100; // Small window for testing

    // Create several rate limit entries
    isRateLimited('ip1', 5, windowMs);
    isRateLimited('ip2', 5, windowMs);
    isRateLimited('ip3', 5, windowMs);

    // Verify entries were created
    assert.strictEqual(Object.keys(rateLimits).length, 3, 'Should have 3 rate limit entries');

    // Wait for the window to expire
    setTimeout(() => {
      try {
        // Clean up expired entries
        const cleanupCount = cleanupRateLimits();

        // Verify entries were cleaned up
        assert.strictEqual(cleanupCount, 3, 'Should have cleaned up 3 entries');
        assert.strictEqual(Object.keys(rateLimits).length, 0, 'Should have no rate limit entries left');

        done();
      } catch (err) {
        done(err);
      }
    }, windowMs + 10);
  });

  it('should handle multiple identifiers independently', () => {
    const limit = 3;
    
    // Make requests for different IPs
    for (let i = 0; i < limit; i++) {
      isRateLimited('ip1', limit);
      isRateLimited('ip2', limit);
    }
    
    // Verify both IPs are at their limits
    assert.strictEqual(rateLimits['ip1'].count, limit, 'IP1 count should be at the limit');
    assert.strictEqual(rateLimits['ip2'].count, limit, 'IP2 count should be at the limit');
    
    // Exceed the limit for IP1
    const ip1Limited = isRateLimited('ip1', limit);
    assert.strictEqual(ip1Limited, true, 'IP1 should be rate limited');
    
    // IP2 should still be at the limit but not over
    const ip2Limited = isRateLimited('ip2', limit);
    assert.strictEqual(ip2Limited, true, 'IP2 should now be rate limited too');
    
    // Add a new IP
    const ip3Limited = isRateLimited('ip3', limit);
    assert.strictEqual(ip3Limited, false, 'IP3 should not be rate limited');
  });
});

// Tests will run automatically with Mocha
console.log('Running rate limiting tests...');