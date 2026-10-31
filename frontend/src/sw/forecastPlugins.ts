// NOTE: serialized into sw.js by workbox; keep this self-contained.
export const forecastFetchPlugin = {
  fetchDidSucceed: async ({ response }: { response: Response }) => {
    if (!response.ok) throw new Error("forecast " + response.status);
    return response;
  },
};
