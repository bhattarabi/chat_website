import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDown, ArrowUp, Menu, MessageCircle, Save, Trash2 } from "lucide-react";
import { PlatformLinksAdminTable, PromoSubscribersAdminTable, UsersAdminTable } from "@/components/admin-data-tables";
import { StaffAppHeader } from "@/components/staff-app-header";
import { rulesByCategory } from "@/lib/game-room-rules";
import { createClient } from "@/lib/supabase-server";
import type {
  Conversation,
  GameRoomRule,
  MainFeature,
  PlatformLink,
  Profile,
  PromoSubscriber,
  PromotionalEmail
} from "@/lib/types";
import {
  addGameRoomRule,
  deleteGameRoomRule,
  moveGameRoomRule,
  saveMainFeature,
  saveGameRoomRule,
  savePlatformLink,
  savePromotionalEmail,
  sendSavedPromotionalEmail
} from "./actions";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (currentProfile?.role !== "admin" || currentProfile.disabled) redirect("/dashboard");

  const [
    { data: links },
    { data: users },
    { data: conversations },
    { data: mainFeature },
    { data: gameRules },
    { data: promoSubscribers },
    { data: promotionalEmails }
  ] = await Promise.all([
      supabase
        .from("platform_links")
        .select("id, title, description, url, image_url, isFeatured:is_featured, button_label, active, sort_order")
        .order("sort_order")
        .returns<PlatformLink[]>(),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }).returns<Profile[]>(),
      supabase
        .from("conversations")
        .select("*, profiles:customer_id(email, full_name, phone)")
        .order("last_message_at", { ascending: false })
        .returns<Conversation[]>(),
      supabase
        .from("main_feature")
        .select("id, imageUrl:image_url, linkUrl:link_url")
        .eq("id", "main")
        .maybeSingle<MainFeature>(),
      supabase
        .from("game_room_rules")
        .select("id, category, body, sort_order, created_at")
        .order("category", { ascending: true })
        .order("sort_order", { ascending: true })
        .returns<GameRoomRule[]>(),
      supabase
        .from("promo_subscribers")
        .select("id, email, phone, subscribed_at, unsubscribed_at")
        .order("subscribed_at", { ascending: false })
        .limit(200)
        .returns<PromoSubscriber[]>(),
      supabase
        .from("promotional_emails")
        .select("id, subject, body, status, recipient_count, sent_count, send_error, sent_at, created_at")
        .order("created_at", { ascending: false })
        .limit(12)
        .returns<PromotionalEmail[]>()
    ]);
  const feature = mainFeature ?? { id: "main", imageUrl: null, linkUrl: null };
  const gameRuleColumns = rulesByCategory(gameRules);
  const activePromoSubscriberCount = (promoSubscribers ?? []).filter((item) => !item.unsubscribed_at).length;

  return (
    <main className="app-shell">
      <StaffAppHeader showAdmin />

      <section className="admin-tabs">
        <input id="admin-tab-links" name="admin-tabs" type="radio" defaultChecked />
        <input id="admin-tab-homepage" name="admin-tabs" type="radio" />
        <input id="admin-tab-rules" name="admin-tabs" type="radio" />
        <input id="admin-tab-promos" name="admin-tabs" type="radio" />
        <input id="admin-tab-subscribers" name="admin-tabs" type="radio" />
        <input id="admin-tab-users" name="admin-tabs" type="radio" />
        <input id="admin-tab-chats" name="admin-tabs" type="radio" />

        <div className="admin-tab-list admin-desktop-tab-list" role="tablist" aria-label="Admin sections">
          <label htmlFor="admin-tab-links" role="tab">
            Platform Links
          </label>
          <label htmlFor="admin-tab-homepage" role="tab">
            Homepage
          </label>
          <label htmlFor="admin-tab-rules" role="tab">
            Gameroom Rules
          </label>
          <label htmlFor="admin-tab-promos" role="tab">
            Promo Emails
          </label>
          <label htmlFor="admin-tab-subscribers" role="tab">
            Subscribers
          </label>
          <label htmlFor="admin-tab-users" role="tab">
            Users
          </label>
          <label htmlFor="admin-tab-chats" role="tab">
            User Chats
          </label>
        </div>
        <details className="admin-mobile-tab-menu">
          <summary aria-label="Open admin sections" title="Admin sections">
            <Menu aria-hidden="true" size={22} />
          </summary>
          <div className="admin-tab-list" role="tablist" aria-label="Admin sections">
            <label htmlFor="admin-tab-links" role="tab">
              Platform Links
            </label>
            <label htmlFor="admin-tab-homepage" role="tab">
              Homepage
            </label>
            <label htmlFor="admin-tab-rules" role="tab">
              Gameroom Rules
            </label>
            <label htmlFor="admin-tab-promos" role="tab">
              Promo Emails
            </label>
            <label htmlFor="admin-tab-subscribers" role="tab">
              Subscribers
            </label>
            <label htmlFor="admin-tab-users" role="tab">
              Users
            </label>
            <label htmlFor="admin-tab-chats" role="tab">
              User Chats
            </label>
          </div>
        </details>

        <div className="admin-tab-panels">
          <section className="admin-section admin-tab-panel links-panel">
            <h1>Platform links</h1>
            <form action={savePlatformLink} className="inline-form">
              <input name="title" placeholder="Title" required />
              <input
                name="url"
                pattern="https?://.+|www\..+"
                placeholder="https://... or www..."
                required
                title="Enter a URL starting with http://, https://, or www."
              />
              <label className="file-input-row">
                Image
                <input name="image_file" type="file" accept="image/*" />
              </label>
              <input name="description" placeholder="Description" />
              <input name="button_label" placeholder="Button" />
              <input name="sort_order" type="number" placeholder="Order" />
              <label className="check-row">
                <input name="active" type="checkbox" defaultChecked />
                Active
              </label>
              <label className="check-row">
                <input name="isFeatured" type="checkbox" />
                Featured
              </label>
              <button type="submit">Add link</button>
            </form>
            <PlatformLinksAdminTable links={links ?? []} />
          </section>

          <section className="admin-section admin-tab-panel homepage-panel">
            <h1>Homepage</h1>
            <form action={saveMainFeature} className="panel-form">
              <label>
                MainFeature image URL
                <input
                  name="main_feature_image_url"
                  defaultValue={feature.imageUrl ?? ""}
                  pattern="https?://.+|www\..+"
                  placeholder="https://... or www..."
                  title="Enter an image URL starting with http://, https://, or www."
                />
              </label>
              <label>
                MainFeature link
                <input
                  name="main_feature_link_url"
                  defaultValue={feature.linkUrl ?? ""}
                  pattern="https?://.+|www\..+"
                  placeholder="https://... or www..."
                  title="Enter a link starting with http://, https://, or www."
                />
              </label>
              <button type="submit">Save homepage</button>
            </form>
          </section>

          <section className="admin-section admin-tab-panel rules-panel">
            <h1>Gameroom Rules</h1>
            <div className="admin-rule-grid">
              {gameRuleColumns.map((column) => (
                <article className="admin-rule-card" key={column.key}>
                  <h2>{column.title}</h2>
                  <form action={addGameRoomRule} className="compact-form admin-rule-add-form">
                    <input name="category" type="hidden" value={column.key} />
                    <input name="body" placeholder={`Add ${column.title.toLowerCase()}`} required />
                    <button type="submit">Add</button>
                  </form>
                  <div className="admin-rule-list">
                    {column.rules.map((rule, index) => (
                      <div className="admin-rule-row" key={rule.id}>
                        <form action={saveGameRoomRule} className="admin-rule-edit-form" id={`save-rule-${rule.id}`}>
                          <input name="id" type="hidden" value={rule.id} />
                          <textarea
                            aria-label={`${column.title} rule`}
                            name="body"
                            defaultValue={rule.body}
                            rows={2}
                            required
                          />
                        </form>
                        <div className="admin-rule-row-actions">
                          <form action={moveGameRoomRule}>
                            <input name="id" type="hidden" value={rule.id} />
                            <input name="direction" type="hidden" value="up" />
                            <button
                              aria-label="Move rule up"
                              title="Move rule up"
                              type="submit"
                            >
                              <ArrowUp aria-hidden="true" size={16} />
                            </button>
                          </form>
                          <form action={moveGameRoomRule}>
                            <input name="id" type="hidden" value={rule.id} />
                            <input name="direction" type="hidden" value="down" />
                            <button
                              aria-label="Move rule down"
                              title="Move rule down"
                              type="submit"
                            >
                              <ArrowDown aria-hidden="true" size={16} />
                            </button>
                          </form>
                          <button
                            aria-label="Save rule"
                            form={`save-rule-${rule.id}`}
                            title="Save rule"
                            type="submit"
                            disabled={rule.id.startsWith("default-")}
                          >
                            <Save aria-hidden="true" size={16} />
                          </button>
                          <form action={deleteGameRoomRule}>
                            <input name="id" type="hidden" value={rule.id} />
                            <button
                              aria-label="Remove rule"
                              title="Remove rule"
                              type="submit"
                              disabled={rule.id.startsWith("default-")}
                            >
                              <Trash2 aria-hidden="true" size={16} />
                            </button>
                          </form>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="admin-section admin-tab-panel promos-panel">
            <h1>Promo Emails</h1>
            <div className="admin-metric-row">
              <div className="admin-metric">
                <span>Active subscribers</span>
                <strong>{activePromoSubscriberCount}</strong>
              </div>
              <div className="admin-metric">
                <span>Total collected</span>
                <strong>{promoSubscribers?.length ?? 0}</strong>
              </div>
            </div>
            <form action={savePromotionalEmail} className="panel-form">
              <input name="subject" placeholder="Email subject" required />
              <textarea name="body" placeholder="Promotional email text" rows={7} required />
              <div className="row-actions">
                <button name="intent" type="submit" value="draft">
                  Save draft
                </button>
                <button name="intent" type="submit" value="send">
                  Save and send
                </button>
              </div>
            </form>

            <div className="promo-admin-grid">
              <h2>Recent Campaigns</h2>
              {(promotionalEmails ?? []).map((item) => (
                <article className="notice-item" key={item.id}>
                  <div className="notice-heading-row">
                    <h3>{item.subject}</h3>
                    <small>{item.status}</small>
                  </div>
                  <p>{item.body}</p>
                  <small>
                    {item.sent_count}/{item.recipient_count} sent
                    {item.sent_at ? ` on ${new Date(item.sent_at).toLocaleString()}` : ""}
                  </small>
                  {item.send_error ? <p className="form-message error">{item.send_error}</p> : null}
                  {item.status !== "sending" ? (
                    <form action={sendSavedPromotionalEmail} className="compact-form">
                      <input name="id" type="hidden" value={item.id} />
                      <button type="submit">Send to subscribers</button>
                    </form>
                  ) : null}
                </article>
              ))}
            </div>
          </section>

          <section className="admin-section admin-tab-panel subscribers-panel">
            <h1>Subscribers</h1>
            <div className="admin-metric-row">
              <div className="admin-metric">
                <span>Active subscribers</span>
                <strong>{activePromoSubscriberCount}</strong>
              </div>
              <div className="admin-metric">
                <span>Total collected</span>
                <strong>{promoSubscribers?.length ?? 0}</strong>
              </div>
            </div>
            <PromoSubscribersAdminTable subscribers={promoSubscribers ?? []} />
          </section>

          <section className="admin-section admin-tab-panel users-panel">
            <h1>Users</h1>
            <UsersAdminTable users={users ?? []} />
          </section>

          <section className="admin-section admin-tab-panel chats-panel">
            <h1>User Chats</h1>
            {(conversations ?? []).map((item) => (
              <div className="chat-link" key={item.id}>
                <MessageCircle size={16} />
                <span>
                  <Link href={`/chat?conversation=${item.id}`}>
                    {item.profiles?.full_name || item.profiles?.email || item.guest_name || item.guest_email || "Customer"}
                  </Link>
                  <small>{new Date(item.last_message_at).toLocaleString()}</small>
                </span>
              </div>
            ))}
          </section>
        </div>
      </section>
    </main>
  );
}
