"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AddressForm, type Address } from "./address-form";
import { useToast } from "./providers";

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

export function ProfileForm({ name, email, phone }: { name: string; email: string | null; phone: string }) {
  const toast = useToast();
  const router = useRouter();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await send("/api/profile", "PUT", { name: f.get("name"), email: f.get("email") });
      toast("Profile updated");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <div><label className="label">Full name</label><input name="name" defaultValue={name} required className="input" /></div>
      <div><label className="label">Mobile number</label><input value={`+91 ${phone}`} disabled className="input bg-surface" /></div>
      <div><label className="label">Email</label><input name="email" type="email" defaultValue={email ?? ""} className="input" /></div>
      <button className="btn-primary">Save profile</button>
    </form>
  );
}

export function PasswordForm() {
  const toast = useToast();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    try {
      await send("/api/profile/password", "POST", { currentPassword: f.get("currentPassword"), newPassword: f.get("newPassword") });
      toast("Password changed");
      form.reset();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <div><label className="label">Current password</label><input name="currentPassword" type="password" required autoComplete="current-password" className="input" /></div>
      <div><label className="label">New password</label><input name="newPassword" type="password" required minLength={8} autoComplete="new-password" className="input" /></div>
      <button className="btn-outline">Change password</button>
    </form>
  );
}

export function AddressManager({ initial, user }: { initial: Address[]; user: { name: string; phone: string } }) {
  const toast = useToast();
  const router = useRouter();
  const [list, setList] = useState(initial);
  const [editing, setEditing] = useState<Address | "new" | null>(null);

  async function remove(id: string) {
    if (!confirm("Delete this address?")) return;
    try {
      await send(`/api/addresses/${id}`, "DELETE");
      setList((l) => l.filter((a) => a.id !== id));
      toast("Address deleted");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  }
  async function makeDefault(a: Address) {
    try {
      await send(`/api/addresses/${a.id}`, "PUT", { ...a, isDefault: true });
      setList((l) => l.map((x) => ({ ...x, isDefault: x.id === a.id })));
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((a) => (
          <div key={a.id} className="rounded-xl border border-line p-4 text-sm">
            <div className="flex items-center gap-2 font-bold">{a.label}{a.isDefault && <span className="rounded bg-ink px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">Default</span>}</div>
            <p className="mt-1">{a.recipientName} · {a.phone}</p>
            <p className="text-muted">{[a.line1, a.line2, a.area, a.landmark].filter(Boolean).join(", ")}, {a.city} {a.pincode}</p>
            <div className="mt-3 flex gap-3 text-xs font-semibold">
              <button onClick={() => setEditing(a)} className="text-brand hover:underline">Edit</button>
              <button onClick={() => remove(a.id)} className="text-red-600 hover:underline">Delete</button>
              {!a.isDefault && <button onClick={() => makeDefault(a)} className="text-muted hover:underline">Make default</button>}
            </div>
          </div>
        ))}
      </div>
      {list.length === 0 && !editing && <p className="text-sm text-muted">No saved addresses yet.</p>}
      {editing ? (
        <div className="mt-4 rounded-xl border border-line p-4">
          <AddressForm
            key={editing === "new" ? "new" : editing.id}
            initial={editing === "new" ? undefined : editing}
            defaults={user}
            onSaved={(a) => {
              setList((l) => (editing === "new" ? [...l, a] : l.map((x) => (x.id === a.id ? a : x))));
              setEditing(null);
              toast("Address saved");
              router.refresh();
            }}
            onCancel={() => setEditing(null)}
          />
        </div>
      ) : (
        <button onClick={() => setEditing("new")} className="btn-outline mt-4">+ Add new address</button>
      )}
    </div>
  );
}
