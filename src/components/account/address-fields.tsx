"use client";

import { useMemo, useState } from "react";
import type { Locale } from "@/i18n/config";
import { getAccountDictionary } from "@/i18n/account";
import { countryOptions, prefecturesJp } from "@/lib/regions";
import { Field, Input, inputClass } from "./ui";

export type AddressValues = {
  country: string | null;
  prefecture: string | null;
  postal_code: string | null;
  address_line: string | null;
};

// Country, prefecture / state and the rest of the address. In Japan the prefecture is picked
// from the list, so it can be compared with the results data; elsewhere it is typed.
export function AddressFields({
  lang,
  defaults,
  required,
}: {
  lang: Locale;
  defaults?: Partial<AddressValues>;
  required?: boolean;
}) {
  const t = getAccountDictionary(lang).address;
  const countries = useMemo(() => countryOptions(lang), [lang]);
  const [country, setCountry] = useState(defaults?.country ?? (lang === "ja" ? "JP" : ""));
  const prefecture = defaults?.prefecture ?? "";

  return (
    <>
      <Field label={t.country}>
        <select
          name="country"
          required={required}
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className={inputClass}
        >
          <option value="">—</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      {country === "JP" ? (
        <Field label={t.prefecture}>
          <select
            key="jp"
            name="prefecture"
            required={required}
            defaultValue={prefecturesJp.some((p) => p.ja === prefecture) ? prefecture : ""}
            className={inputClass}
          >
            <option value="">—</option>
            {prefecturesJp.map((p) => (
              <option key={p.ja} value={p.ja}>
                {lang === "ja" ? p.ja : p.en}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <Field label={t.state}>
          <Input key="other" name="prefecture" required={required} defaultValue={prefecture} />
        </Field>
      )}
      <Field label={t.postalCode}>
        <Input name="postal_code" autoComplete="postal-code" defaultValue={defaults?.postal_code ?? ""} />
      </Field>
      <Field label={t.addressLine} hint={t.addressHint}>
        <Input
          name="address_line"
          required={required}
          autoComplete="street-address"
          defaultValue={defaults?.address_line ?? ""}
        />
      </Field>
    </>
  );
}
