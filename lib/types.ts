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
  isFeatured: boolean;
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

export type MainFeature = {
  id: string;
  imageUrl: string | null;
  linkUrl: string | null;
};

export type Conversation = {
  id: string;
  customer_id: string;
  subject: string;
  last_message_at: string;
  profiles?: Pick<Profile, "email" | "full_name" | "phone"> | null;
};

export type ConversationPreview = Conversation & {
  latest_message?: Pick<Message, "body" | "image_url" | "sender_id" | "created_at"> | null;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  image_path: string | null;
  image_url: string | null;
  created_at: string;
};
