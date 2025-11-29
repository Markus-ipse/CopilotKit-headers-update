import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Test suite for dynamic headers functionality in CopilotRuntimeClient.
 *
 * This tests the `resolveHeaders` helper function and header merging behavior
 * in the `createFetchFn` factory function. Since these are internal functions,
 * we extract and test the core logic separately.
 */

// Type definition matching the one in CopilotRuntimeClient.ts
type HeadersInit =
  | Record<string, string>
  | (() => Record<string, string> | Promise<Record<string, string>>);

/**
 * Helper function to resolve headers from either a static object or a function.
 * This is a copy of the function from CopilotRuntimeClient.ts for testing.
 */
async function resolveHeaders(headers?: HeadersInit): Promise<Record<string, string>> {
  if (!headers) {
    return {};
  }
  if (typeof headers === "function") {
    return await headers();
  }
  return headers;
}

describe("CopilotRuntimeClient - Dynamic Headers", () => {
  describe("resolveHeaders", () => {
    describe("Headers as static object (existing behavior)", () => {
      test("should return empty object when headers is undefined", async () => {
        const result = await resolveHeaders(undefined);
        expect(result).toEqual({});
      });

      test("should return the static headers object as-is", async () => {
        const staticHeaders = {
          Authorization: "Bearer token123",
          "X-Custom-Header": "custom-value",
        };

        const result = await resolveHeaders(staticHeaders);

        expect(result).toEqual(staticHeaders);
        expect(result).toBe(staticHeaders); // Should be the same reference
      });

      test("should return empty object when provided empty static headers", async () => {
        const result = await resolveHeaders({});
        expect(result).toEqual({});
      });

      test("should handle static headers with multiple values", async () => {
        const staticHeaders = {
          Authorization: "Bearer token123",
          "X-Custom-Header": "custom-value",
          "Content-Type": "application/json",
          Accept: "application/json",
        };

        const result = await resolveHeaders(staticHeaders);
        expect(result).toEqual(staticHeaders);
      });
    });

    describe("Headers as synchronous function", () => {
      test("should call the function and return its result", async () => {
        const headersFn = vi.fn().mockReturnValue({
          Authorization: "Bearer sync-token",
        });

        const result = await resolveHeaders(headersFn);

        expect(headersFn).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ Authorization: "Bearer sync-token" });
      });

      test("should handle function returning empty object", async () => {
        const headersFn = vi.fn().mockReturnValue({});

        const result = await resolveHeaders(headersFn);

        expect(headersFn).toHaveBeenCalledTimes(1);
        expect(result).toEqual({});
      });

      test("should handle function returning multiple headers", async () => {
        const expectedHeaders = {
          Authorization: "Bearer sync-token",
          "X-Request-ID": "req-123",
          "X-Tenant-ID": "tenant-456",
        };
        const headersFn = vi.fn().mockReturnValue(expectedHeaders);

        const result = await resolveHeaders(headersFn);

        expect(headersFn).toHaveBeenCalledTimes(1);
        expect(result).toEqual(expectedHeaders);
      });
    });

    describe("Headers as async function", () => {
      test("should call the async function and await its result", async () => {
        const headersFn = vi.fn().mockResolvedValue({
          Authorization: "Bearer async-token",
        });

        const result = await resolveHeaders(headersFn);

        expect(headersFn).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ Authorization: "Bearer async-token" });
      });

      test("should handle async function returning empty object", async () => {
        const headersFn = vi.fn().mockResolvedValue({});

        const result = await resolveHeaders(headersFn);

        expect(headersFn).toHaveBeenCalledTimes(1);
        expect(result).toEqual({});
      });

      test("should handle async function with delay (simulating token refresh)", async () => {
        const refreshedToken = "Bearer refreshed-token-xyz";
        const headersFn = vi.fn().mockImplementation(async () => {
          // Simulate async token refresh operation
          await new Promise((resolve) => setTimeout(resolve, 10));
          return { Authorization: refreshedToken };
        });

        const result = await resolveHeaders(headersFn);

        expect(headersFn).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ Authorization: refreshedToken });
      });

      test("should handle async function returning multiple headers", async () => {
        const expectedHeaders = {
          Authorization: "Bearer async-token",
          "X-Session-ID": "session-789",
          "X-User-ID": "user-abc",
        };
        const headersFn = vi.fn().mockResolvedValue(expectedHeaders);

        const result = await resolveHeaders(headersFn);

        expect(result).toEqual(expectedHeaders);
      });
    });

    describe("Error handling when header function throws", () => {
      test("should propagate error from sync function that throws", async () => {
        const error = new Error("Failed to get headers");
        const headersFn = vi.fn().mockImplementation(() => {
          throw error;
        });

        await expect(resolveHeaders(headersFn)).rejects.toThrow("Failed to get headers");
        expect(headersFn).toHaveBeenCalledTimes(1);
      });

      test("should propagate error from async function that rejects", async () => {
        const error = new Error("Token refresh failed");
        const headersFn = vi.fn().mockRejectedValue(error);

        await expect(resolveHeaders(headersFn)).rejects.toThrow("Token refresh failed");
        expect(headersFn).toHaveBeenCalledTimes(1);
      });

      test("should propagate custom error types", async () => {
        class TokenExpiredError extends Error {
          constructor() {
            super("Token has expired");
            this.name = "TokenExpiredError";
          }
        }

        const headersFn = vi.fn().mockRejectedValue(new TokenExpiredError());

        await expect(resolveHeaders(headersFn)).rejects.toThrow("Token has expired");
      });
    });

    describe("Header function is called for each invocation", () => {
      test("should call header function each time resolveHeaders is invoked", async () => {
        let callCount = 0;
        const headersFn = vi.fn().mockImplementation(() => {
          callCount++;
          return { "X-Call-Count": String(callCount) };
        });

        const result1 = await resolveHeaders(headersFn);
        const result2 = await resolveHeaders(headersFn);
        const result3 = await resolveHeaders(headersFn);

        expect(headersFn).toHaveBeenCalledTimes(3);
        expect(result1).toEqual({ "X-Call-Count": "1" });
        expect(result2).toEqual({ "X-Call-Count": "2" });
        expect(result3).toEqual({ "X-Call-Count": "3" });
      });

      test("should get fresh token on each call (simulating token that changes)", async () => {
        const tokens = ["token-1", "token-2", "token-3"];
        let tokenIndex = 0;
        const headersFn = vi.fn().mockImplementation(async () => {
          const token = tokens[tokenIndex++];
          return { Authorization: `Bearer ${token}` };
        });

        const result1 = await resolveHeaders(headersFn);
        const result2 = await resolveHeaders(headersFn);
        const result3 = await resolveHeaders(headersFn);

        expect(result1).toEqual({ Authorization: "Bearer token-1" });
        expect(result2).toEqual({ Authorization: "Bearer token-2" });
        expect(result3).toEqual({ Authorization: "Bearer token-3" });
      });
    });
  });

  describe("Header merging behavior", () => {
    /**
     * Test the header merging logic similar to createFetchFn.
     * Dynamic headers should be merged with existing headers, with dynamic headers taking precedence.
     */
    function mergeHeaders(
      existingHeaders: Record<string, string>,
      resolvedHeaders: Record<string, string>,
    ): Record<string, string> {
      return {
        ...existingHeaders,
        ...resolvedHeaders,
      };
    }

    test("should merge dynamic headers with existing headers", () => {
      const existingHeaders = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      const dynamicHeaders = {
        Authorization: "Bearer token",
      };

      const result = mergeHeaders(existingHeaders, dynamicHeaders);

      expect(result).toEqual({
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: "Bearer token",
      });
    });

    test("should allow dynamic headers to override existing headers", () => {
      const existingHeaders = {
        Authorization: "Bearer old-token",
        "X-Custom-Header": "old-value",
      };
      const dynamicHeaders = {
        Authorization: "Bearer new-token",
        "X-Custom-Header": "new-value",
      };

      const result = mergeHeaders(existingHeaders, dynamicHeaders);

      expect(result).toEqual({
        Authorization: "Bearer new-token",
        "X-Custom-Header": "new-value",
      });
    });

    test("should handle empty dynamic headers", () => {
      const existingHeaders = {
        "Content-Type": "application/json",
      };
      const dynamicHeaders = {};

      const result = mergeHeaders(existingHeaders, dynamicHeaders);

      expect(result).toEqual({
        "Content-Type": "application/json",
      });
    });

    test("should handle empty existing headers", () => {
      const existingHeaders = {};
      const dynamicHeaders = {
        Authorization: "Bearer token",
      };

      const result = mergeHeaders(existingHeaders, dynamicHeaders);

      expect(result).toEqual({
        Authorization: "Bearer token",
      });
    });

    test("should handle both empty headers", () => {
      const result = mergeHeaders({}, {});
      expect(result).toEqual({});
    });

    describe("Integration with publicApiKey header", () => {
      /**
       * Tests that simulate how dynamic headers work alongside the publicApiKey
       * that is set during CopilotRuntimeClient construction.
       */
      test("should preserve publicApiKey when dynamic headers are provided", () => {
        const staticHeaders = {
          "X-CopilotKit-Runtime-Client-GQL-Version": "1.0.0",
          "x-copilotcloud-public-api-key": "pk_test_123",
        };
        const dynamicHeaders = {
          Authorization: "Bearer user-token",
        };

        const result = mergeHeaders(staticHeaders, dynamicHeaders);

        expect(result).toEqual({
          "X-CopilotKit-Runtime-Client-GQL-Version": "1.0.0",
          "x-copilotcloud-public-api-key": "pk_test_123",
          Authorization: "Bearer user-token",
        });
        expect(result["x-copilotcloud-public-api-key"]).toBe("pk_test_123");
      });

      test("should allow dynamic headers to override publicApiKey if explicitly provided", () => {
        const staticHeaders = {
          "x-copilotcloud-public-api-key": "pk_test_old",
        };
        const dynamicHeaders = {
          "x-copilotcloud-public-api-key": "pk_test_new",
        };

        const result = mergeHeaders(staticHeaders, dynamicHeaders);

        expect(result["x-copilotcloud-public-api-key"]).toBe("pk_test_new");
      });
    });

    describe("Integration with auth headers", () => {
      test("should properly merge custom auth headers with version headers", () => {
        const staticHeaders = {
          "X-CopilotKit-Runtime-Client-GQL-Version": "1.0.0",
        };
        const authHeaders = {
          Authorization: "Bearer jwt-token",
          "X-Auth-Provider": "custom-provider",
        };

        const result = mergeHeaders(staticHeaders, authHeaders);

        expect(result).toEqual({
          "X-CopilotKit-Runtime-Client-GQL-Version": "1.0.0",
          Authorization: "Bearer jwt-token",
          "X-Auth-Provider": "custom-provider",
        });
      });

      test("should handle complex header scenarios with multiple auth tokens", () => {
        const staticHeaders = {
          "X-CopilotKit-Runtime-Client-GQL-Version": "1.0.0",
          "x-copilotcloud-public-api-key": "pk_test_123",
        };
        const dynamicAuthHeaders = {
          Authorization: "Bearer access-token",
          "X-Refresh-Token": "refresh-token-xyz",
          "X-Device-ID": "device-123",
        };

        const result = mergeHeaders(staticHeaders, dynamicAuthHeaders);

        expect(result).toEqual({
          "X-CopilotKit-Runtime-Client-GQL-Version": "1.0.0",
          "x-copilotcloud-public-api-key": "pk_test_123",
          Authorization: "Bearer access-token",
          "X-Refresh-Token": "refresh-token-xyz",
          "X-Device-ID": "device-123",
        });
      });
    });
  });
});
