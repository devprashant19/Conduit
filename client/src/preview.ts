/**
 * Is this build the hosted static preview?
 *
 * The preview deployment is the client bundle with no Conduit behind it — no
 * daemon, no PTYs, nothing serving `/api/*`. So every request it makes answers
 * 404 and every socket it opens fails, and because the usage panels poll on a
 * timer the failures never stop: a visitor who opens devtools sees a console
 * filling up with errors for a condition the preview banner already explains in
 * a sentence.
 *
 * Making the requests anyway proves nothing. When the page can know there is no
 * backend, the honest thing is to say so and stay quiet.
 *
 * Two ways it knows, and the second is the one that matters:
 *
 *   VITE_STATIC_PREVIEW=1   set in the hosting environment. Vite inlines it at
 *                           build time, so a local build — where the variable is
 *                           unset — is the app it always was.
 *
 *   a *.vercel.app host     Conduit's backend is a long-lived daemon that owns
 *                           real PTYs. Vercel's platform cannot run one, so a
 *                           Conduit served from vercel.app never has a backend.
 *                           That is a property of the architecture, not a
 *                           deployment setting, which is why it does not depend
 *                           on remembering to configure anything.
 *
 * The host check is deliberately narrow: only vercel.app, never a custom domain,
 * because a custom domain can point at a real server and this must never make a
 * working install refuse to talk to its own daemon.
 */
const onVercelPreview = typeof window !== 'undefined'
  && /(^|\.)vercel\.app$/.test(window.location.hostname);

export const STATIC_PREVIEW =
  import.meta.env.VITE_STATIC_PREVIEW === '1' || onVercelPreview;
