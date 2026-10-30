export type NotificationType =
  | "order"
  | "payment"
  | "warning"
  | "info"
  | "reservation"
  | "request"
  | "table";

export type NotificationIcon =
  | "order"
  | "payment"
  | "warning"
  | "info"
  | "calendar"
  | "request"
  | "table";

export interface NotificationAction {
  label: string;
  href: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  icon: NotificationIcon;
  title: string;
  description: string;
  time: string;
  read: boolean;
  action?: NotificationAction;
}
