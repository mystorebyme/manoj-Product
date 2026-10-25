"use client";

import { useMemo, useRef, useState } from "react";
import { createProductAction } from "@/app/actions";

/**
 * Naya product + uski kai photos (ek saath, seedha upload).
 *
 * Owner ko koi URL daalne ki zaroorat nahi — phone/computer se photos choose
 * kariye, turant preview dikhega. Save karte hi product storefront par live ho
 * jaata hai (naam, price, MRP, size + stock + size-wise price, colour, collection).
 */

const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "Free Size"];

const COLLECTIONS = [
  { value: "new-arrivals", label: "New arrivals" },
  { value: "party-wear-gown", label: "Anarkali suit" },
  { value: "lehnga-choli", label: "Lehenga choli" },
  { value: "printed-suit-set", label: "Printed suit set" },
  { value: "trending", label: "Trending" },
  { value: "weddin-collection", label: "Wedding collection" },
  { value: "sale", label: "Sale" },
];

const CATEGORIES = [
  { value: "anarkali", label: "Anarkali" },
  { value: "lehnga", label: "Lehenga" },
  { value: "printed", label: "Printed set" },
  { value: "gown", label: "Gown" },
  { value: "sharara", label: "Sharara" },
  { value: "saree", label: "Saree" },
  { value: "other", label: "Other" },
];

export function NewProductForm({ error }: { error?: string }) {
  const [title, setTitle] = useState("");
  const [previews, setPreviews] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>(["S", "M", "L", "XL"]);
  const fileInput = useRef<HTMLInputElement>(null);

  const handle = useMemo(
    () =>
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 70),
    [title],
  );

  function onFiles(files: FileList | null) {
    if (!files) return;
    const list = Array.from(files).slice(0, 12);
    setPreviews(list.map((file) => URL.createObjectURL(file)));
  }

  function toggleSize(size: string) {
    setSelectedSizes((current) =>
      current.includes(size) ? current.filter((item) => item !== size) : [...current, size],
    );
  }

  return (
    <form action={createProductAction} encType="multipart/form-data" className="stack-lg">
      {error ? <div className="notice warn">{error}</div> : null}

      <section className="panel">
        <div className="panel-head">
          <h2>1 · Photos</h2>
          <span className="badge">{previews.length || 0}/12</span>
        </div>
        <div className="panel-body">
          <label className="upload-drop" htmlFor="photos">
            <input
              ref={fileInput}
              id="photos"
              name="photos"
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => onFiles(event.target.files)}
              data-testid="product-photos"
            />
            <strong>Photos choose kariye (4–6 best)</strong>
            <span>
              JPG / PNG / WEBP · max 8 MB each · pehli photo main image hoti hai (card/search par wahi) — save ke baad badal bhi sakte hain
            </span>
            <span className="small muted" style={{ display: "block", marginTop: 4 }}>
              Salah: front full-length, back, dupatta/work ka close-up, aur ek wearing shot — customer ko
              sabse zyada yahi photos pasand aati hain (12 tak lag sakti hain).
            </span>
          </label>

          {previews.length ? (
            <div className="upload-grid">
              {previews.map((src, index) => (
                // eslint-disable-next-line @next/next/no-img-element
                <figure key={src} className={index === 0 ? "is-primary" : undefined}>
                  <img src={src} alt="" />
                  {index === 0 ? <figcaption>Cover</figcaption> : null}
                </figure>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>2 · Product details</h2>
          <span className="badge">{handle || "handle"}</span>
        </div>
        <div className="panel-body">
          <div className="field">
            <label htmlFor="title">Product name</label>
            <input
              id="title"
              name="title"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Maroon hand-embroidered anarkali set"
            />
          </div>

          <input type="hidden" name="handle" value={handle} />

          <div className="row">
            <div className="field">
              <label htmlFor="price">Selling price (₹)</label>
              <input id="price" name="price" type="number" min="1" step="1" required placeholder="1499" />
            </div>
            <div className="field">
              <label htmlFor="compareAtPrice">MRP (₹) — optional</label>
              <input id="compareAtPrice" name="compareAtPrice" type="number" min="0" step="1" placeholder="2999" />
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label htmlFor="colours">Colours (comma se)</label>
              <input id="colours" name="colours" placeholder="Maroon, Emerald, Ivory" />
            </div>
            <div className="field">
              <label htmlFor="fabric">Fabric</label>
              <input id="fabric" name="fabric" placeholder="Georgette with zari work" />
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label htmlFor="collection">Collection</label>
              <select id="collection" name="collection" defaultValue="new-arrivals">
                {COLLECTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="category">Category</label>
              <select id="category" name="category" defaultValue="anarkali">
                {CATEGORIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              rows={4}
              placeholder="Fabric, work, dupatta, care instructions…"
            />
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>3 · Sizes, stock &amp; price</h2>
          <span className="badge">stock 0 = sold out · price khaali = base</span>
        </div>
        <div className="panel-body">
          <div className="size-grid">
            {SIZES.map((size) => {
              const active = selectedSizes.includes(size);
              return (
                <div key={size} className={`size-card ${active ? "is-on" : ""}`}>
                  <label className="size-check">
                    <input
                      type="checkbox"
                      name={`size_${size}`}
                      value="1"
                      checked={active}
                      onChange={() => toggleSize(size)}
                    />
                    <span>{size}</span>
                  </label>
                  <input
                    type="number"
                    name={`stock_${size}`}
                    min="0"
                    step="1"
                    defaultValue={active ? 5 : 0}
                    disabled={!active}
                    aria-label={`${size} stock`}
                    title="Stock (pieces)"
                  />
                  <input
                    type="number"
                    name={`price_${size}`}
                    min="0"
                    step="1"
                    placeholder="₹ base"
                    disabled={!active}
                    aria-label={`${size} price`}
                    title={`${size} ka price (khaali = base price)`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>4 · Publish</h2>
        </div>
        <div className="panel-body">
          <div className="field">
            <label htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue="published">
              <option value="published">Live — website par turant dikhega</option>
              <option value="draft">Draft — abhi chhupaa rahe</option>
            </select>
          </div>
          <button className="btn btn-primary" type="submit" data-testid="save-product">
            Save product
          </button>
        </div>
      </section>
    </form>
  );
}
