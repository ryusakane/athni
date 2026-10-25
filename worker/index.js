// Runs only for Next's page-navigation files (wrangler.jsonc assets.run_worker_first); every
// other request is served straight from the static files without starting this Worker.
//
// Their names contain "$" (e.g. /ja/players/__next.$d$lang.players.__PAGE__.txt). Cloudflare's
// static assets answer a "$" with a redirect to "%24", and Chrome asks for "$" again, so the
// request loops until it fails. Next then reloads the whole page on every menu click, and the
// header briefly loses the "My account" link. Asking the assets for the "%24" form directly
// returns the file.
const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    url.pathname = url.pathname.replaceAll("$", "%24");
    return env.ASSETS.fetch(new Request(url, request));
  },
};

export default worker;
