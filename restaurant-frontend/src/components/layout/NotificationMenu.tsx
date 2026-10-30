"use client";

import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Bell,
  CalendarDays,
  CreditCard,
  Info,
  MessageSquare,
  ShoppingCart,
  TriangleAlert,
  Utensils,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/lib/hooks";
import type { NotificationIcon } from "@/lib/types";

const ICON_MAP: Record<NotificationIcon, React.ComponentType<{ className?: string }>> = {
  order: ShoppingCart,
  payment: CreditCard,
  warning: TriangleAlert,
  info: Info,
  calendar: CalendarDays,
  request: MessageSquare,
  table: Utensils,
};

function formatRelativeTime(isoTime: string): string {
  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) return "";
  const distance = formatDistanceToNow(date, { addSuffix: true });
  return distance.replace("less than a minute ago", "just now");
}

export function NotificationMenu() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground" />
        }
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground ring-2 ring-background">
            {unreadCount}
          </span>
        )}
        <span className="sr-only">Notifications</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-80 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-open:slide-in-from-top-2 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:slide-out-to-top-2 origin-[--transform-origin]"
      >
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs font-normal text-muted-foreground hover:text-foreground"
            >
              Mark all read
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No notifications
          </div>
        ) : (
          notifications.map((notification) => {
            const Icon = ICON_MAP[notification.icon] ?? Info;
            const content = (
              <div className="flex items-start gap-3 p-3">
                <div
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                    notification.read
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary/10 text-primary"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "text-sm",
                      !notification.read && "font-medium"
                    )}
                  >
                    {notification.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {notification.description}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    {formatRelativeTime(notification.time)}
                  </p>
                </div>
                {!notification.read && (
                  <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                )}
              </div>
            );

            return notification.action ? (
              <DropdownMenuItem
                key={notification.id}
                onClick={() => markRead(notification.id)}
                className={cn(
                  "cursor-pointer",
                  !notification.read && "bg-primary/5"
                )}
              >
                <Link
                  href={notification.action.href}
                  className="flex items-start gap-3 w-full"
                >
                  {content}
                </Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                key={notification.id}
                onClick={() => markRead(notification.id)}
                className={cn(
                  "cursor-pointer",
                  !notification.read && "bg-primary/5"
                )}
              >
                {content}
              </DropdownMenuItem>
            );
          })
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="justify-center text-xs text-muted-foreground cursor-pointer">
          View all notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
