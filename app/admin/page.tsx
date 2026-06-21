import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDown, ArrowUp, Menu, MessageCircle, Save, Trash2 } from "lucide-react";
import { PlatformLinksAdminTable, UsersAdminTable } from "@/components/admin-data-tables";
import { StaffAppHeader } from "@/components/staff-app-header";
import { rulesByCategory } from "@/lib/game-room-rules";
import { createClient } from "@/lib/supabase-server";
import type {
  Conversation,
  GameRoomRule,
  PlatformLink,
  Profile,
  SocialLinks
} from "@/lib/types";
import {
  addGameRoomRule,
  deleteGameRoomRule,
  moveGameRoomRule,
  saveGameRoomRule,
  savePlatformLink,
  saveSocialLinks
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
    { data: socialLinks },
    { data: gameRules }
  ] = await Promise.all([
      supabase
        .from("platform_links")
        .select("id, title, url, image_url, active")
        .order("title")
        .returns<PlatformLink[]>(),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }).returns<Profile[]>(),
      supabase
        .from("conversations")
        .select("*, profiles:customer_id(email, full_name, phone)")
        .order("last_message_at", { ascending: false })
        .returns<Conversation[]>(),
      supabase
        .from("social_links")
        .select("id, telegram_url, facebook_url")
        .eq("id", "main")
        .maybeSingle<SocialLinks>(),
      supabase
        .from("game_room_rules")
        .select("id, category, body, sort_order, created_at")
        .order("category", { ascending: true })
        .order("sort_order", { ascending: true })
        .returns<GameRoomRule[]>()
    ]);
  const gameRuleColumns = rulesByCategory(gameRules);

  return (
    <main className="app-shell">
      <StaffAppHeader showAdmin />

      <section className="admin-tabs">
        <input id="admin-tab-links" name="admin-tabs" type="radio" defaultChecked />
        <input id="admin-tab-social" name="admin-tabs" type="radio" />
        <input id="admin-tab-rules" name="admin-tabs" type="radio" />
        <input id="admin-tab-users" name="admin-tabs" type="radio" />
        <input id="admin-tab-chats" name="admin-tabs" type="radio" />

        <div className="admin-tab-list admin-desktop-tab-list" role="tablist" aria-label="Admin sections">
          <label htmlFor="admin-tab-links" role="tab">
            Platform Links
          </label>
          <label htmlFor="admin-tab-social" role="tab">
            Social Links
          </label>
          <label htmlFor="admin-tab-rules" role="tab">
            Gameroom Rules
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
            <label htmlFor="admin-tab-social" role="tab">
              Social Links
            </label>
            <label htmlFor="admin-tab-rules" role="tab">
              Gameroom Rules
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
              <label className="check-row">
                <input name="active" type="checkbox" defaultChecked />
                Active
              </label>
              <button type="submit">Add link</button>
            </form>
            <PlatformLinksAdminTable links={links ?? []} />
          </section>

          <section className="admin-section admin-tab-panel social-panel">
            <h1>Social links</h1>
            <form action={saveSocialLinks} className="panel-form">
              <label>
                Telegram URL
                <input
                  name="telegram_url"
                  defaultValue={socialLinks?.telegram_url ?? ""}
                  pattern="https?://.+|www\..+"
                  placeholder="https://t.me/..."
                  title="Enter a URL starting with http://, https://, or www."
                />
              </label>
              <label>
                Facebook URL
                <input
                  name="facebook_url"
                  defaultValue={socialLinks?.facebook_url ?? ""}
                  pattern="https?://.+|www\..+"
                  placeholder="https://facebook.com/..."
                  title="Enter a URL starting with http://, https://, or www."
                />
              </label>
              <button type="submit">Save social links</button>
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
