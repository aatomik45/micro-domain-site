const defaultConfig = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000",
};

export function loadRuntimeConfig(): Promise<void> {
  return Promise.resolve();
}

export function getConfig() {
  return defaultConfig;
}

export function getAPIBaseURL(): string {
  return getConfig().API_BASE_URL.replace(/\/$/, "");
}

export const config = {
  get API_BASE_URL() {
    return getAPIBaseURL();
  },
};
