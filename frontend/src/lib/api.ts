import type { ApiErrorBody } from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/v1";

export class ApiError extends Error {
  status: number;
  code: string;
  body: ApiErrorBody | null;

  constructor(status: number, code: string, message: string, body: ApiErrorBody | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

type RequestOptions = RequestInit & { retried?: boolean };

function headersOf(init: RequestOptions): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init.body && typeof init.body === "string") headers["Content-Type"] = "application/json";
  return { ...headers, ...(init.headers as Record<string, string> | undefined) };
}

async function parseError(res: Response): Promise<ApiError> {
  let body: ApiErrorBody | null = null;
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    body = null;
  }
  const rawMessage = body?.message ?? res.statusText;
  const message = Array.isArray(rawMessage) ? rawMessage.join(". ") : rawMessage;
  return new ApiError(res.status, body?.code ?? "UNKNOWN_ERROR", message, body);
}

/** Intenta renovar la sesión con la cookie de refresh (rotación en el backend). */
async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" });
    return res.ok;
  } catch {
    return false;
  }
}

async function request<T>(path: string, init: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: headersOf(init),
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "No se pudo conectar con el servidor");
  }

  // 401 → rotar refresh una sola vez y reintentar
  if (res.status === 401 && !init.retried) {
    const ok = await tryRefresh();
    if (ok) {
      return request<T>(path, { ...init, retried: true });
    }
  }

  if (!res.ok) {
    throw await parseError(res);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get<T>(path: string, init?: RequestInit) {
    return request<T>(path, { method: "GET", ...init });
  },
  post<T>(path: string, body?: unknown, init?: RequestInit) {
    return request<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
      ...init,
    });
  },
  patch<T>(path: string, body?: unknown, init?: RequestInit) {
    return request<T>(path, {
      method: "PATCH",
      body: body === undefined ? undefined : JSON.stringify(body),
      ...init,
    });
  },
  put<T>(path: string, body?: unknown, init?: RequestInit) {
    return request<T>(path, {
      method: "PUT",
      body: body === undefined ? undefined : JSON.stringify(body),
      ...init,
    });
  },
  del<T>(path: string, init?: RequestInit) {
    return request<T>(path, { method: "DELETE", ...init });
  },
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado";
}