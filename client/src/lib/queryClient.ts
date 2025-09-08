import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    if (res.status === 401) {
      // Clear auth data and redirect to login on unauthorized
      localStorage.removeItem('currentUser');
      window.location.href = '/';
      return;
    }
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  customHeaders?: Record<string, string | undefined>,
): Promise<Response> {
  const headers: Record<string, string> = {};
  
  // Handle FormData vs JSON content
  if (data instanceof FormData) {
    // Don't set Content-Type for FormData, let browser set it with boundary
  } else if (data) {
    headers["Content-Type"] = "application/json";
  }

  // Apply custom headers, filtering out undefined values
  if (customHeaders) {
    Object.entries(customHeaders).forEach(([key, value]) => {
      if (value !== undefined) {
        headers[key] = value;
      }
    });
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data instanceof FormData ? data : (data ? JSON.stringify(data) : undefined),
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (res.status === 401) {
      if (unauthorizedBehavior === "returnNull") {
        // Clear auth data and redirect to login on unauthorized
        localStorage.removeItem('currentUser');
        window.location.href = '/';
        return null;
      }
      // For "throw" behavior, also redirect but let the error bubble up
      localStorage.removeItem('currentUser');
      window.location.href = '/';
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false, // Keep performance light
      refetchOnMount: false, // Avoid unnecessary refetches
      staleTime: 10 * 60 * 1000, // 10 minutes - longer cache for better performance
      gcTime: 30 * 60 * 1000, // 30 minutes - keep cached data longer
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
