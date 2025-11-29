export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredBy<T, K extends keyof T> = T & { [P in K]-?: T[P] };

/**
 * Type for headers that can be either a static object or a function that returns headers.
 * The function can be sync or async, allowing for dynamic header generation (e.g., refreshing auth tokens).
 */
export type CopilotHeadersInit =
  | Record<string, string>
  | (() => Record<string, string> | Promise<Record<string, string>>);

/**
 * Alias for CopilotHeadersInit for backward compatibility.
 */
export type HeadersInit = CopilotHeadersInit;
