import Link from "next/link";
import { notFound } from "next/navigation";
import { getCollections } from "@/lib/data";
import { inr } from "@/lib/format";
import {
  moveProductImageAction,
  publishCatalogAction,
  saveProductEditAction,
  setProductMainImageAction,
  toggleProductVisibilityAction,
} from "@/app/actions";
import { catalogWritable, mergedProduct, overrideStats } from "@/lib/catalog-admin";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Product edit — yahan se website ka product poora manage hota hai:
 * title, price, MRP, stock, featured, description, collections, size-wise price
 * aur photos. Save "publish" ke baad live storefront par chala jaata hai.
 */
export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const handle = decodeURIComponent(id);
  const product = mergedProduct(handle);
  if (!product) notFound();
  const session = await getSession();
  const allCollections = getCollections();
  const listed = new Set(product.collections);
  const stats = overrideStats();
  const storeUrl = process.env.NEXT_PUBLIC_STORE_URL ?? "http://localhost:3000";

  return (
    <>
      <div className="topbar">
        <div>
          <p className="small muted">
            <Link href="/products">← Products</Link>
          </p>
          <h1>{product.title}</h1>
          <p className="mono small">{product.handle}</p>
        </div>
        <div className="actions">
          <form action={publishCatalogAction}>
            <button className="btn btn-primary btn-sm" type="submit">
              Publish to website
            </button>
          </form>
          <a className="btn" href={`${storeUrl}/products/${product.handle}`} target="_blank" rel="noreferrer">
            View on store
          </a>
        </div>
      </div>

      {!catalogWritable() ? (
        <div className="panel" data-testid="catalog-readonly">
          <div className="panel-body small">
            <strong>Read-only mode.</strong> Catalogue edits (title, price, photos, publish) repo checkout par
            chalte hain — deployed panel me filesystem read-only hota hai. Yahan se orders, payments, notes,
            tracking, delivery rules aur invoices manage karein; product edits GitHub push ke baad live honge.
          </div>
        </div>
      ) : null}

      {stats.lastPublishedAt ? (
        <p className="small muted">
          Last published: {new Date(stats.lastPublishedAt).toLocaleString("en-IN")} · edits pending publish:{" "}
          {stats.edited}
        </p>
      ) : null}

      <form action={saveProductEditAction} className="panel">
        <div className="panel-head">
          <h2>Catalogue details</h2>
          <button className="btn btn-primary btn-sm" type="submit">
            Save product
          </button>
        </div>
        <div className="panel-body">
          <input type="hidden" name="handle" value={product.handle} />
          <input type="hidden" name="actor" value={session?.email ?? "admin"} />

          <div className="field">
            <label htmlFor="title">Title</label>
            <input id="title" name="title" defaultValue={product.title} required />
          </div>

          <div className="row">
            <div className="field">
              <label htmlFor="price">Selling price (₹)</label>
              <input id="price" name="price" type="number" min="1" step="1" defaultValue={Math.round(product.price / 100)} />
              <p className="small muted" style={{ marginTop: 4 }}>
                Current: {inr(product.price)}
              </p>
            </div>
            <div className="field">
              <label htmlFor="compareAtPrice">MRP (₹)</label>
              <input
                id="compareAtPrice"
                name="compareAtPrice"
                type="number"
                min="0"
                step="1"
                defaultValue={product.compareAtPrice ? Math.round(product.compareAtPrice / 100) : ""}
              />
            </div>
            <div className="field">
              <label>Status</label>
              <label className="small" style={{ textTransform: "none", letterSpacing: 0 }}>
                <input type="checkbox" name="inStock" defaultChecked={product.inStock} style={{ width: "auto", marginRight: 8 }} />
                In stock
              </label>
              <label className="small" style={{ textTransform: "none", letterSpacing: 0 }}>
                <input type="checkbox" name="featured" defaultChecked={product.featured} style={{ width: "auto", marginRight: 8 }} />
                Featured on home
              </label>
            </div>
          </div>

          <div className="field">
            <label htmlFor="description">Short description</label>
            <textarea id="description" name="description" rows={3} defaultValue={product.description} />
          </div>

          <div className="field">
            <label>Collections</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {allCollections.map((collection) => (
                <label key={collection.handle} className="small" style={{ textTransform: "none", letterSpacing: 0 }}>
                  <input
                    type="checkbox"
                    name="collections"
                    value={collection.handle}
                    defaultChecked={listed.has(collection.handle)}
                    style={{ width: "auto", marginRight: 6 }}
                  />
                  {collection.title}
                </label>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Size-wise price aur availability</label>
            <table className="table">
              <thead>
                <tr>
                  <th>Size</th>
                  <th>Price (₹)</th>
                  <th>Available</th>
                </tr>
              </thead>
              <tbody>
                {product.sizes.map((size) => {
                  const pricing = product.sizePricing?.[size];
                  const key = size.replace(/ /g, "_");
                  return (
                    <tr key={size}>
                      <td>{size}</td>
                      <td>
                        <input
                          type="number"
                          name={`size_${key}`}
                          min="0"
                          step="1"
                          defaultValue={pricing ? Math.round(pricing.price / 100) : Math.round(product.price / 100)}
                          style={{ width: 110 }}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          name={`avail_${key}`}
                          defaultChecked={pricing?.available ?? true}
                          style={{ width: "auto" }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="field">
            <label>Photos — main image chuniye (customer ko yahi sabse pehle dikhti hai)</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }} data-testid="image-manager">
              {product.images.slice(0, 10).map((image, index) => {
                const isMain = index === 0;
                return (
                  <div key={image} style={{ width: 96 }}>
                    <div style={{ position: "relative" }}>
                      <img
                        src={image}
                        alt=""
                        width={96}
                        height={128}
                        style={{
                          objectFit: "cover",
                          border: isMain ? "2px solid #6f1d2b" : "1px solid #e5e5e5",
                          width: 96,
                          height: 128,
                        }}
                      />
                      {isMain ? (
                        <span
                          style={{
                            position: "absolute",
                            left: 4,
                            top: 4,
                            background: "#6f1d2b",
                            color: "#fff",
                            fontSize: 9,
                            letterSpacing: ".08em",
                            padding: "2px 5px",
                            textTransform: "uppercase",
                          }}
                        >
                          Main
                        </span>
                      ) : null}
                    </div>
                    <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                      {isMain ? null : (
                        <form action={setProductMainImageAction}>
                          <input type="hidden" name="handle" value={product.handle} />
                          <input type="hidden" name="image" value={image} />
                          <button className="btn btn-sm" type="submit" title="Main image banayein">
                            Main
                          </button>
                        </form>
                      )}
                      <form action={moveProductImageAction}>
                        <input type="hidden" name="handle" value={product.handle} />
                        <input type="hidden" name="image" value={image} />
                        <input type="hidden" name="direction" value="up" />
                        <button className="btn btn-sm" type="submit" disabled={index === 0} title="Aage khiskayein">
                          ↑
                        </button>
                      </form>
                      <form action={moveProductImageAction}>
                        <input type="hidden" name="handle" value={product.handle} />
                        <input type="hidden" name="image" value={image} />
                        <input type="hidden" name="direction" value="down" />
                        <button
                          className="btn btn-sm"
                          type="submit"
                          disabled={index >= Math.min(product.images.length, 10) - 1}
                          title="Peeche khiskayein"
                        >
                          ↓
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="small muted">
              {product.images.length} photos. Pehli photo main image hoti hai — card par, search me aur product
              page ke top par wahi dikhti hai. Sirf ek photo wale product par card par image badalti nahi (cursor ke
              saath halki si float karti hai). Publish ke baad live.
            </p>
          </div>
        </div>
      </form>

      <div className="panel">
        <div className="panel-head">
          <h2>Website visibility</h2>
        </div>
        <div className="panel-body">
          <p className="small muted">
            Hide karne par product storefront listings se hat jaata hai (URL 404). Publish ke baad effect.
          </p>
          <form action={toggleProductVisibilityAction} className="actions">
            <input type="hidden" name="handle" value={product.handle} />
            <input type="hidden" name="hidden" value={product.hidden ? "false" : "true"} />
            <button className="btn btn-sm" type="submit">
              {product.hidden ? "Show on website" : "Hide from website"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
