import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: [
    "@manhaj/lib",
    "@manhaj/ui",
    "@manhaj/auth",
    "@manhaj/admin",
    "@manhaj/teacher",
    "@manhaj/student",
    "@manhaj/parent",
  ],
};

export default config;
