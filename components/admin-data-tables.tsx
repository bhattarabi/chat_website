"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowUpDown, Pencil, Trash2, X } from "lucide-react";
import type { PlatformLink, Profile, PromoSubscriber } from "@/lib/types";
import {
  deletePlatformLink,
  deletePromoSubscriber,
  savePlatformLink,
  updatePromoSubscriber,
  updateUserStatus
} from "@/app/admin/actions";

type Direction = "asc" | "desc";
type PlatformColumn =
  | "title"
  | "url"
  | "image_url"
  | "isFeatured"
  | "description"
  | "button_label"
  | "sort_order"
  | "active";
type UserColumn = "full_name" | "email" | "phone" | "role" | "disabled";
type SubscriberColumn = "email" | "phone" | "subscribed_at" | "unsubscribed_at";

type SortState<TColumn extends string> = {
  column: TColumn;
  direction: Direction;
};

function nextDirection<TColumn extends string>(
  sort: SortState<TColumn>,
  column: TColumn
): SortState<TColumn> {
  return {
    column,
    direction: sort.column === column && sort.direction === "asc" ? "desc" : "asc"
  };
}

function textValue(value: string | number | boolean | null | undefined) {
  return String(value ?? "").toLowerCase();
}

function compareValues(a: string | number | boolean | null, b: string | number | boolean | null) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return String(a ?? "").localeCompare(String(b ?? ""));
}

export function PlatformLinksAdminTable({ links }: { links: PlatformLink[] }) {
  const [sort, setSort] = useState<SortState<PlatformColumn>>({
    column: "sort_order",
    direction: "asc"
  });
  const [filters, setFilters] = useState<Record<PlatformColumn, string>>({
    title: "",
    url: "",
    image_url: "",
    isFeatured: "",
    description: "",
    button_label: "",
    sort_order: "",
    active: ""
  });
  const [editing, setEditing] = useState<PlatformLink | null>(null);

  const visibleLinks = useMemo(() => {
    return [...links]
      .filter((item) =>
        (Object.keys(filters) as PlatformColumn[]).every((column) => {
          const filter = filters[column].toLowerCase();
          if (!filter) return true;
          if (column === "active") return (item.active ? "active" : "inactive") === filter;
          if (column === "isFeatured") return (item.isFeatured ? "featured" : "not featured") === filter;
          return textValue(item[column]).includes(filter);
        })
      )
      .sort((a, b) => {
        const result = compareValues(a[sort.column], b[sort.column]);
        return sort.direction === "asc" ? result : -result;
      });
  }, [filters, links, sort]);

  return (
    <>
      <div className="data-table-wrap">
        <table className="admin-data-table platform-links-table">
          <colgroup>
            <col className="platform-col-title" />
            <col className="platform-col-url" />
            <col className="platform-col-image" />
            <col className="platform-col-featured" />
            <col className="platform-col-button" />
            <col className="platform-col-order" />
            <col className="platform-col-status" />
            <col className="platform-col-actions" />
          </colgroup>
          <thead>
            <tr>
              <SortableHeader label="Title" onClick={() => setSort(nextDirection(sort, "title"))} />
              <SortableHeader label="URL" onClick={() => setSort(nextDirection(sort, "url"))} />
              <SortableHeader label="Image" onClick={() => setSort(nextDirection(sort, "image_url"))} />
              <SortableHeader
                label="Featured"
                onClick={() => setSort(nextDirection(sort, "isFeatured"))}
              />
              <SortableHeader
                label="Button"
                onClick={() => setSort(nextDirection(sort, "button_label"))}
              />
              <SortableHeader label="Order" onClick={() => setSort(nextDirection(sort, "sort_order"))} />
              <SortableHeader label="Status" onClick={() => setSort(nextDirection(sort, "active"))} />
              <th aria-label="Actions" />
            </tr>
            <tr>
              <FilterCell
                value={filters.title}
                onChange={(value) => setFilters({ ...filters, title: value })}
              />
              <FilterCell
                value={filters.url}
                onChange={(value) => setFilters({ ...filters, url: value })}
              />
              <FilterCell
                value={filters.image_url}
                onChange={(value) => setFilters({ ...filters, image_url: value })}
              />
              <th>
                <select
                  value={filters.isFeatured}
                  onChange={(event) => setFilters({ ...filters, isFeatured: event.target.value })}
                  aria-label="Filter featured"
                >
                  <option value="">All</option>
                  <option value="featured">Featured</option>
                  <option value="not featured">Not featured</option>
                </select>
              </th>
              <FilterCell
                value={filters.button_label}
                onChange={(value) => setFilters({ ...filters, button_label: value })}
              />
              <FilterCell
                value={filters.sort_order}
                onChange={(value) => setFilters({ ...filters, sort_order: value })}
              />
              <th>
                <select
                  value={filters.active}
                  onChange={(event) => setFilters({ ...filters, active: event.target.value })}
                  aria-label="Filter status"
                >
                  <option value="">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visibleLinks.map((item) => (
              <tr key={item.id}>
                <td title={item.title}>{item.title}</td>
                <td title={item.url}>{item.url}</td>
                <td title={item.image_url ?? undefined}>
                  {item.image_url ? (
                    <a href={item.image_url} target="_blank" rel="noreferrer" title={item.image_url}>
                      {item.image_url}
                    </a>
                  ) : (
                    ""
                  )}
                </td>
                <td>{item.isFeatured ? "Featured" : "Not featured"}</td>
                <td title={item.button_label}>{item.button_label}</td>
                <td>{item.sort_order}</td>
                <td>{item.active ? "Active" : "Inactive"}</td>
                <td>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="icon-only secondary"
                      title="Edit link"
                      onClick={() => setEditing(item)}
                    >
                      <Pencil size={16} />
                    </button>
                    <form action={deletePlatformLink}>
                      <input type="hidden" name="id" value={item.id} />
                      <button className="icon-only danger" title="Delete link" type="submit">
                        <Trash2 size={16} />
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing ? (
        <Modal title="Edit Platform Link" onClose={() => setEditing(null)}>
          <form action={savePlatformLink} className="modal-form">
            <input type="hidden" name="id" value={editing.id} />
            <label>
              Title
              <input name="title" defaultValue={editing.title} required />
            </label>
            <label>
              URL
              <input
                name="url"
                defaultValue={editing.url}
                pattern="https?://.+|www\..+"
                required
                title="Enter a URL starting with http://, https://, or www."
              />
            </label>
            <label>
              Image URL
              <input
                name="image_url"
                defaultValue={editing.image_url ?? ""}
                pattern="https?://.+|www\..+"
                title="Enter an image URL starting with http://, https://, or www."
              />
            </label>
            <label className="check-row">
              <input name="isFeatured" type="checkbox" defaultChecked={editing.isFeatured} />
              Featured
            </label>
            <label>
              Description
              <textarea name="description" defaultValue={editing.description ?? ""} rows={4} />
            </label>
            <label>
              Button
              <input name="button_label" defaultValue={editing.button_label} />
            </label>
            <label>
              Order
              <input name="sort_order" type="number" defaultValue={editing.sort_order} />
            </label>
            <label className="check-row">
              <input name="active" type="checkbox" defaultChecked={editing.active} />
              Active
            </label>
            <button type="submit">Save changes</button>
          </form>
        </Modal>
      ) : null}
    </>
  );
}

export function UsersAdminTable({ users }: { users: Profile[] }) {
  const [sort, setSort] = useState<SortState<UserColumn>>({
    column: "email",
    direction: "asc"
  });
  const [filters, setFilters] = useState<Record<UserColumn, string>>({
    full_name: "",
    email: "",
    phone: "",
    role: "",
    disabled: ""
  });
  const [editing, setEditing] = useState<Profile | null>(null);

  const visibleUsers = useMemo(() => {
    return [...users]
      .filter((item) =>
        (Object.keys(filters) as UserColumn[]).every((column) => {
          const filter = filters[column].toLowerCase();
          if (!filter) return true;
          if (column === "disabled") return (item.disabled ? "disabled" : "active") === filter;
          return textValue(item[column]).includes(filter);
        })
      )
      .sort((a, b) => {
        const result = compareValues(a[sort.column], b[sort.column]);
        return sort.direction === "asc" ? result : -result;
      });
  }, [filters, sort, users]);

  return (
    <>
      <div className="data-table-wrap">
        <table className="admin-data-table">
          <thead>
            <tr>
              <SortableHeader label="Name" onClick={() => setSort(nextDirection(sort, "full_name"))} />
              <SortableHeader label="Email" onClick={() => setSort(nextDirection(sort, "email"))} />
              <SortableHeader label="Phone" onClick={() => setSort(nextDirection(sort, "phone"))} />
              <SortableHeader label="Role" onClick={() => setSort(nextDirection(sort, "role"))} />
              <SortableHeader label="Status" onClick={() => setSort(nextDirection(sort, "disabled"))} />
              <th>Actions</th>
            </tr>
            <tr>
              <FilterCell
                value={filters.full_name}
                onChange={(value) => setFilters({ ...filters, full_name: value })}
              />
              <FilterCell
                value={filters.email}
                onChange={(value) => setFilters({ ...filters, email: value })}
              />
              <FilterCell
                value={filters.phone}
                onChange={(value) => setFilters({ ...filters, phone: value })}
              />
              <th>
                <select
                  value={filters.role}
                  onChange={(event) => setFilters({ ...filters, role: event.target.value })}
                  aria-label="Filter role"
                >
                  <option value="">All</option>
                  <option value="agent">Agent</option>
                  <option value="admin">Admin</option>
                  <option value="customer">Customer</option>
                </select>
              </th>
              <th>
                <select
                  value={filters.disabled}
                  onChange={(event) => setFilters({ ...filters, disabled: event.target.value })}
                  aria-label="Filter status"
                >
                  <option value="">All</option>
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visibleUsers.map((item) => (
              <tr key={item.id}>
                <td>{item.full_name || ""}</td>
                <td>{item.email}</td>
                <td>{item.phone || ""}</td>
                <td>{item.role}</td>
                <td>{item.disabled ? "Disabled" : "Active"}</td>
                <td>
                  <button
                    type="button"
                    className="icon-only secondary"
                    title="Edit user"
                    onClick={() => setEditing(item)}
                  >
                    <Pencil size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing ? (
        <Modal title="Edit User" onClose={() => setEditing(null)}>
          <form action={updateUserStatus} className="modal-form">
            <input type="hidden" name="user_id" value={editing.id} />
            <div className="account-email">
              <span>Email</span>
              <strong>{editing.email}</strong>
            </div>
            <div className="account-email">
              <span>Name</span>
              <strong>{editing.full_name || "No name saved"}</strong>
            </div>
            <div className="account-email">
              <span>Phone</span>
              <strong>{editing.phone || "No phone saved"}</strong>
            </div>
            <label>
              Role
              <select name="role" defaultValue={editing.role}>
                <option value="customer">Customer</option>
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <label className="check-row">
              <input name="disabled" type="checkbox" defaultChecked={editing.disabled} />
              Disabled
            </label>
            <button type="submit">Save changes</button>
          </form>
        </Modal>
      ) : null}
    </>
  );
}

export function PromoSubscribersAdminTable({ subscribers }: { subscribers: PromoSubscriber[] }) {
  const [sort, setSort] = useState<SortState<SubscriberColumn>>({
    column: "subscribed_at",
    direction: "desc"
  });
  const [filters, setFilters] = useState<Record<SubscriberColumn, string>>({
    email: "",
    phone: "",
    subscribed_at: "",
    unsubscribed_at: ""
  });
  const [editing, setEditing] = useState<PromoSubscriber | null>(null);

  const visibleSubscribers = useMemo(() => {
    return [...subscribers]
      .filter((item) =>
        (Object.keys(filters) as SubscriberColumn[]).every((column) => {
          const filter = filters[column].toLowerCase();
          if (!filter) return true;
          if (column === "unsubscribed_at") {
            return (item.unsubscribed_at ? "unsubscribed" : "active") === filter;
          }
          return textValue(item[column]).includes(filter);
        })
      )
      .sort((a, b) => {
        const result = compareValues(a[sort.column], b[sort.column]);
        return sort.direction === "asc" ? result : -result;
      });
  }, [filters, sort, subscribers]);

  return (
    <>
      <div className="data-table-wrap">
        <table className="admin-data-table subscribers-table">
          <thead>
            <tr>
              <SortableHeader label="Email" onClick={() => setSort(nextDirection(sort, "email"))} />
              <SortableHeader label="Phone" onClick={() => setSort(nextDirection(sort, "phone"))} />
              <SortableHeader
                label="Subscribed"
                onClick={() => setSort(nextDirection(sort, "subscribed_at"))}
              />
              <SortableHeader
                label="Status"
                onClick={() => setSort(nextDirection(sort, "unsubscribed_at"))}
              />
              <th>Actions</th>
            </tr>
            <tr>
              <FilterCell
                value={filters.email}
                onChange={(value) => setFilters({ ...filters, email: value })}
              />
              <FilterCell
                value={filters.phone}
                onChange={(value) => setFilters({ ...filters, phone: value })}
              />
              <FilterCell
                value={filters.subscribed_at}
                onChange={(value) => setFilters({ ...filters, subscribed_at: value })}
              />
              <th>
                <select
                  value={filters.unsubscribed_at}
                  onChange={(event) => setFilters({ ...filters, unsubscribed_at: event.target.value })}
                  aria-label="Filter subscriber status"
                >
                  <option value="">All</option>
                  <option value="active">Active</option>
                  <option value="unsubscribed">Unsubscribed</option>
                </select>
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visibleSubscribers.map((item) => (
              <tr key={item.id}>
                <td>{item.email}</td>
                <td>{item.phone || ""}</td>
                <td>{new Date(item.subscribed_at).toLocaleString()}</td>
                <td>{item.unsubscribed_at ? "Unsubscribed" : "Active"}</td>
                <td>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="icon-only secondary"
                      title="Edit subscriber"
                      onClick={() => setEditing(item)}
                    >
                      <Pencil size={16} />
                    </button>
                    <form action={deletePromoSubscriber}>
                      <input type="hidden" name="id" value={item.id} />
                      <button className="icon-only danger" title="Delete subscriber" type="submit">
                        <Trash2 size={16} />
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing ? (
        <Modal title="Edit Subscriber" onClose={() => setEditing(null)}>
          <form action={updatePromoSubscriber} className="modal-form">
            <input type="hidden" name="id" value={editing.id} />
            <label>
              Email
              <input name="email" type="email" defaultValue={editing.email} required />
            </label>
            <label>
              Phone
              <input name="phone" type="tel" defaultValue={editing.phone ?? ""} />
            </label>
            <label className="check-row">
              <input name="active" type="checkbox" defaultChecked={!editing.unsubscribed_at} />
              Active
            </label>
            <button type="submit">Save changes</button>
          </form>
        </Modal>
      ) : null}
    </>
  );
}

function SortableHeader({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <th>
      <button type="button" className="table-sort-button" onClick={onClick}>
        {label}
        <ArrowUpDown size={14} />
      </button>
    </th>
  );
}

function FilterCell({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <th>
      <input
        aria-label="Filter"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </th>
  );
}

function Modal({
  children,
  title,
  onClose
}: {
  children: ReactNode;
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button type="button" className="icon-only secondary" title="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
