import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import api from "@/lib/api/client";
import type { ApiResponse, Notification, NotificationIcon, NotificationType } from "@/lib/types";

const STORAGE_KEY = "notifications";
const MAX_NOTIFICATIONS = 50;
const LOCAL_KEY = ["notifications", "local"] as const;
const SERVER_KEY = ["notifications", "server"] as const;

let notificationIdCounter = 0;

interface ServerNotification {
  id: string;
  type: string;
  icon: string;
  title: string;
  description: string;
  action_label?: string | null;
  action_url?: string | null;
  read: boolean;
  created_at: string;
}

function generateId(): string {
  if (typeof window !== "undefined" && typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  notificationIdCounter += 1;
  return `${Date.now()}-${notificationIdCounter}`;
}

function loadFromStorage(): Notification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (n): n is Notification =>
        n &&
        typeof n.id === "string" &&
        typeof n.title === "string" &&
        typeof n.read === "boolean"
    );
  } catch {
    return [];
  }
}

function persistToStorage(notifications: Notification[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)));
  } catch {
    // Storage full or unavailable - silently ignore
  }
}

function mapServerNotification(item: ServerNotification): Notification {
  return {
    id: item.id,
    type: (item.type as NotificationType) || "info",
    icon: (item.icon as NotificationIcon) || "info",
    title: item.title,
    description: item.description,
    time: item.created_at,
    read: item.read,
    action: item.action_url
      ? {
          label: item.action_label || "View",
          href: item.action_url,
        }
      : undefined,
  };
}

export function addNotification(
  queryClient: QueryClient,
  notification: Omit<Notification, "id" | "time" | "read">
): void {
  const newNotification: Notification = {
    ...notification,
    id: generateId(),
    time: new Date().toISOString(),
    read: false,
  };

  queryClient.setQueryData<Notification[]>(LOCAL_KEY, (current = []) => {
    const next = [newNotification, ...current].slice(0, MAX_NOTIFICATIONS);
    persistToStorage(next);
    return next;
  });
}

export function useNotifications() {
  const queryClient = useQueryClient();

  const localQuery = useQuery({
    queryKey: LOCAL_KEY,
    queryFn: loadFromStorage,
    initialData: [],
  });

  const serverQuery = useQuery({
    queryKey: SERVER_KEY,
    queryFn: () =>
      api
        .get<ApiResponse<{ items: ServerNotification[]; unread_count: number }>>("/notifications", {
          params: { per_page: 30 },
        })
        .then((res) => (res.data.data?.items ?? []).map(mapServerNotification)),
    retry: false,
    staleTime: 30_000,
  });

  const notifications = [...(serverQuery.data ?? []), ...(localQuery.data ?? [])]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, MAX_NOTIFICATIONS);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markReadMutation = useMutation({
    mutationFn: (id: string) =>
      api.patch<ApiResponse<ServerNotification>>(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SERVER_KEY });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.patch<ApiResponse<{ updated: number }>>("/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SERVER_KEY });
    },
  });

  const markRead = (id: string) => {
    const isLocal = (localQuery.data ?? []).some((n) => n.id === id);

    if (isLocal) {
      queryClient.setQueryData<Notification[]>(LOCAL_KEY, (current = []) => {
        const next = current.map((n) => (n.id === id ? { ...n, read: true } : n));
        persistToStorage(next);
        return next;
      });
      return;
    }

    markReadMutation.mutate(id);
  };

  const markAllRead = () => {
    queryClient.setQueryData<Notification[]>(LOCAL_KEY, (current = []) => {
      const next = current.map((n) => ({ ...n, read: true }));
      persistToStorage(next);
      return next;
    });
    markAllReadMutation.mutate();
  };

  return {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    isLoading: localQuery.isLoading || serverQuery.isLoading,
  };
}
