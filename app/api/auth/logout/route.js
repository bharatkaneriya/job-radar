import { clearAuthCookie } from '#server/http.js';

export const POST = () => {
  const headers = new Headers();
  clearAuthCookie({ headers });
  return Response.json({ ok: true }, { headers });
};
