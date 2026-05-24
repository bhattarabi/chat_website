export type Role = "customer" | "admin";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: Role;
  disabled: boolean;
};

export type PlatformLink = {
  id: string;
  title: string;
  description: string | null;
  url: string;
  image_url: string | null;
  button_label: string;
  active: boolean;
  sort_order: number;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  status: "draft" | "published";
  created_at: string;
};
