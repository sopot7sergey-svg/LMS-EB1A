import { NextResponse } from 'next/server';

/**
 * Public health check - no auth required.
 * Proxies to the API's /health endpoint so the login page can verify server availability
 * without hitting any protected route or rewrite that might add auth.
 */
export async function GET() {
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.API_URL ||
    'http://127.0.0.1:3001';

  try {
    const res = await fetch(`${apiUrl}/health`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      return NextResponse.json(
        { status: 'error', message: `API returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json().catch(() => ({ status: 'ok' }));
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Health] Proxy error:', error);
    return NextResponse.json(
      { status: 'error', message: 'API unreachable' },
      { status: 503 }
    );
  }
}
