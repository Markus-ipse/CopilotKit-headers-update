---
"@copilotkit/shared": minor
"@copilotkit/runtime-client-gql": minor
"@copilotkit/react-core": minor
---

feat(react-core): support dynamic headers function in CopilotKit component

The `headers` prop on the `<CopilotKit>` component now accepts either a static object or a function that returns headers (sync or async). When a function is provided, it will be called before each request to the `runtimeUrl`, enabling dynamic header generation such as refreshing auth tokens.

**Example usage:**

```tsx
// Static headers (existing behavior)
<CopilotKit runtimeUrl="/api/copilot" headers={{ "Authorization": "Bearer X" }}>

// Dynamic headers (sync)
<CopilotKit runtimeUrl="/api/copilot" headers={() => ({ "Authorization": `Bearer ${getToken()}` })}>

// Dynamic headers (async - useful for refreshing tokens)
<CopilotKit runtimeUrl="/api/copilot" headers={async () => ({ "Authorization": `Bearer ${await refreshToken()}` })}>
```
