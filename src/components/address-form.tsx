"use client";

import { useState, type FormEvent } from "react";

export type Address = {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  area: string | null;
  city: string;
  state: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
};

export function AddressForm({
  initial,
  defaults,
  onSaved,
  onCancel,
}: {
  initial?: Address;
  defaults?: { name: string; phone: string };
  onSaved: (a: Address) => void;
  onCancel?: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "Home");
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({ lat: initial?.latitude ?? null, lng: initial?.longitude ?? null });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function locate() {
    if (!navigator.geolocation) return setErr("Location is not available on this device");
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: Number(p.coords.latitude.toFixed(6)), lng: Number(p.coords.longitude.toFixed(6)) }),
      () => setErr("Could not read your location. You can still save the address without it."),
    );
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget).entries());
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(initial ? `/api/addresses/${initial.id}` : "/api/addresses", {
        method: initial ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, label, latitude: coords.lat, longitude: coords.lng, isDefault: initial?.isDefault }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSaved(data.address);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save address");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{err}</p>}
      <div className="flex gap-2">
        {["Home", "Work", "Other"].map((l) => (
          <button type="button" key={l} onClick={() => setLabel(l)} className={`chip ${label === l ? "chip-active" : ""}`}>{l}</button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Receiver&apos;s name</label>
          <input name="recipientName" required defaultValue={initial?.recipientName ?? defaults?.name} className="input" autoComplete="name" />
        </div>
        <div>
          <label className="label">Mobile number</label>
          <input name="phone" required inputMode="numeric" defaultValue={initial?.phone ?? defaults?.phone} className="input" autoComplete="tel-national" />
        </div>
      </div>
      <div>
        <label className="label">Flat / house no. / building / street</label>
        <input name="line1" required defaultValue={initial?.line1} className="input" autoComplete="address-line1" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Area / locality</label>
          <input name="area" defaultValue={initial?.area ?? ""} className="input" />
        </div>
        <div>
          <label className="label">Landmark (optional)</label>
          <input name="landmark" defaultValue={initial?.landmark ?? ""} className="input" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">City</label>
          <input name="city" defaultValue={initial?.city ?? "Hyderabad"} className="input" />
        </div>
        <div>
          <label className="label">State</label>
          <input name="state" defaultValue={initial?.state ?? "Telangana"} className="input" />
        </div>
        <div>
          <label className="label">PIN code</label>
          <input name="pincode" required inputMode="numeric" maxLength={6} defaultValue={initial?.pincode} className="input" autoComplete="postal-code" />
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <button type="button" onClick={locate} className="btn-outline py-2 text-xs">📍 Pin my location (helps our rider)</button>
        {coords.lat != null && <span className="text-xs font-medium text-emerald-700">Location saved</span>}
      </div>
      <div className="flex gap-2 pt-1">
        <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save address"}</button>
        {onCancel && <button type="button" onClick={onCancel} className="btn-outline">Cancel</button>}
      </div>
    </form>
  );
}
