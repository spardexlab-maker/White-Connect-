// /api/directory: the same public directory as JSON, for the app's own directory pages.
import { directory, type Handler } from '../_lib/site';

export const onRequestGet: Handler = async (ctx) =>
  new Response(JSON.stringify(await directory(ctx)), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
