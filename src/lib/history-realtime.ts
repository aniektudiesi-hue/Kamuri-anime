import { API_BASE } from "./api";

export function historySocketUrl(token: string) {
  const url = new URL(API_BASE);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws/user/history";
  url.search = "";
  url.searchParams.set("token", token);
  return url.toString();
}
