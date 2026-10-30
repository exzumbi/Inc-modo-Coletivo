export function useSearchParams() {
  return new URLSearchParams(location.hash.split("?")[1] || "");
}
export function useRouter() {
  const go = (path: string) => {
    location.hash = "/" + path.replace(/^\/backstage\//, "");
  };
  return {
    refresh: () => {},
    push: go,
    replace: (path: string, _options?: unknown) => go(path),
  };
}
