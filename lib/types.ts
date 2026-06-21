export type Role = "customer" | "agent" | "admin";

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
  url: string;
  image_url: string | null;
  active: boolean;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  status: "draft" | "published";
  created_at: string;
};

export type PromoSubscriber = {
  id: string;
  email: string;
  phone: string | null;
  subscribed_at: string;
  unsubscribed_at: string | null;
};

export type PromotionalEmail = {
  id: string;
  subject: string;
  body: string;
  status: "draft" | "sending" | "sent" | "failed";
  recipient_count: number;
  sent_count: number;
  send_error: string | null;
  sent_at: string | null;
  created_at: string;
};

export type GameRoomRuleCategory = "redemption" | "payment";

export type GameRoomRule = {
  id: string;
  category: GameRoomRuleCategory;
  body: string;
  sort_order: number;
  created_at: string;
};

export type Conversation = {
  id: string;
  customer_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  guest_token_hash: string | null;
  subject: string;
  last_message_at: string;
  profiles?: Pick<Profile, "email" | "full_name" | "phone"> | null;
};

export type ConversationPreview = Conversation & {
  latest_message?: Pick<
    Message,
    "body" | "image_url" | "sender_id" | "sender_type" | "created_at"
  > | null;
};

export type ChatReadState = {
  user_id: string;
  conversation_id: string;
  last_read_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  sender_type: "user" | "guest" | "system";
  body: string | null;
  image_path: string | null;
  image_url: string | null;
  created_at: string;
  sender_profile?: Pick<Profile, "email" | "full_name" | "role"> | null;
};
