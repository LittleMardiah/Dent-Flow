import { IncomingMessage, ServerResponse } from 'http';
import { app } from '../src/index';

// Vercel Serverless Function handler
// Exports a single handler for all routes — Express app handles routing internally.

export default function handler(req: IncomingMessage, res: ServerResponse) {
  // Forward to Express app
  // Vercel provides IncomingMessage-compatible objects for req/res
  // but Express expects its own Req/Res — we use a thin compatibility layer.
  //
  // For simplicity (and because Vercel's Node runtime is compatible),
  // we can directly invoke the Express app as a listener.

  // Express app signature: app(req, res)
  // TypeScript types differ but the runtime behavior is compatible.
  return (app as any)(req, res);
}
