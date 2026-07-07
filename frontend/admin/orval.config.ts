import { defineConfig } from 'orval';

export default defineConfig({
  rayflowAdmin: {
    input: './openapi.json',
    output: {
      mode: 'tags',
      target: './src/lib/sdk/sdk.ts',
      client: 'react-query',
      clean: true,
      override: {
        mutator: {
          path: './src/lib/custom-fetch.ts',
          name: 'customFetch',
        },
        fetch: {
          includeHttpResponseReturnType: false,
        },
      },
    },
  },
});
