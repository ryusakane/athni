import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build as plain static files so the site can be hosted for free on Cloudflare Pages.
  output: "export",
  // Emit en/players/index.html rather than en/players.html: player pages also live under
  // en/players/, and a file next to a same-named folder is ambiguous for static hosts.
  trailingSlash: true,
};

export default nextConfig;
