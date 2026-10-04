import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build as plain static files so the site can be hosted for free on Cloudflare Pages.
  output: "export",
};

export default nextConfig;
