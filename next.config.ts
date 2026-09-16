import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The floating dev badge sits over the voice-note controls on phones.
  devIndicators: false,
  // Demo leads are read from disk at runtime; make sure the file ships with the functions.
  outputFileTracingIncludes: { '/api/**/*': ['./fixtures/demo-leads.json'] },
  /* config options here */
};

export default nextConfig;
