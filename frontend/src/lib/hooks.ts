import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./api";
import type { ShopPublic, UserOut } from "./types";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<UserOut>("/auth/me").catch(() => null),
    staleTime: 60_000,
  });
}

export function useShop(slug: string | undefined) {
  return useQuery({
    queryKey: ["shop", slug],
    queryFn: () => apiGet<ShopPublic>(`/public/shops/${slug}`),
    enabled: !!slug,
  });
}

export function useToday() {
  return useQuery({
    queryKey: ["today"],
    queryFn: () => apiGet<{ date: string }>("/public/today").then((r) => r.date),
    staleTime: 5 * 60_000,
  });
}
