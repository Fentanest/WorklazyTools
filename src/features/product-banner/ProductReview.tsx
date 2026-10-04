import { useState } from "react";
import { Button } from "../../components/ui/button";
import { UtilityField, UtilityInput } from "../../components/UtilitySurface";
import { detectDuplicates, imageStatus, productReviewFields, type EditorAction } from "./state";
import type { BannerEditorState } from "./stateTypes";
import { validateProductUrl } from "./urlPolicy";
import type { BannerUiText } from "./uiMessages";

export function ProductReview({ state, dispatch, text }: { state: BannerEditorState; dispatch: (action: EditorAction) => void; text: BannerUiText }) {
  const [page, setPage] = useState(0), [dragged, setDragged] = useState<string | null>(null), [retry, setRetry] = useState<Record<string, number>>({});
  const products = state.project.products, last = Math.max(0, Math.ceil(products.length / 20) - 1), current = Math.min(page, last);
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={() => dispatch({ type: "select-all", selected: true })}>{text.all}</Button>
      <Button variant="secondary" onClick={() => dispatch({ type: "select-all", selected: false })}>{text.clear}</Button>
      {[true, false].map((included) => <Button key={String(included)} variant="secondary" disabled={!state.selectedIds.length} onClick={() => dispatch({ type: "include", ids: state.selectedIds, included })}>{included ? text.include : text.exclude}</Button>)}
      <Button variant="secondary" disabled={!state.selectedIds.length} onClick={() => dispatch({ type: "delete", ids: state.selectedIds })}>{text.delete}</Button>
      <Button variant="secondary" disabled={!state.past.length} onClick={() => dispatch({ type: "undo" })}>{text.undo}</Button>
    </div>
    {detectDuplicates(products).length > 0 && <p role="status">{text.duplicate}</p>}
    {products.slice(current * 20, current * 20 + 20).map((p, index) => <article key={p.id} className="space-y-3 rounded-2xl border border-border p-4" data-testid="banner-product" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (dragged) dispatch({ type: "move", id: dragged, to: current * 20 + index }); setDragged(null); }}>
      <span draggable onDragStart={() => setDragged(p.id)} onDragEnd={() => setDragged(null)} className="cursor-grab">↕</span>
      {validateProductUrl(p.imageUrl).valid && <img key={`${p.imageUrl}-${retry[p.id] ?? 0}`} src={p.imageUrl} alt={p.name} loading="lazy" className="h-24 w-24 rounded-lg object-contain" onLoad={() => dispatch({ type: "image-status", id: p.id, url: p.imageUrl, status: "success" })} onError={() => dispatch({ type: "image-status", id: p.id, url: p.imageUrl, status: "failure" })} />}
      <p role="status">{text.imageStates[imageStatus(state, p.id)]}</p>
      <Button variant="secondary" size="sm" onClick={() => { dispatch({ type: "image-status", id: p.id, url: p.imageUrl, status: "checking" }); setRetry((previous) => ({ ...previous, [p.id]: (previous[p.id] ?? 0) + 1 })); }}>{text.retry}</Button>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2"><input type="checkbox" checked={state.selectedIds.includes(p.id)} onChange={(e) => dispatch({ type: "select", ids: [p.id], selected: e.target.checked })} />{current * 20 + index + 1}</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={p.included} onChange={(e) => dispatch({ type: "include", ids: [p.id], included: e.target.checked })} />{text.include}</label>
        <Button variant="secondary" size="sm" disabled={current * 20 + index === 0} onClick={() => dispatch({ type: "move-step", id: p.id, direction: "up" })}>{text.up}</Button>
        <Button variant="secondary" size="sm" disabled={current * 20 + index === products.length - 1} onClick={() => dispatch({ type: "move-step", id: p.id, direction: "down" })}>{text.down}</Button>
      </div>
      {(["name", "imageUrl", "promotionUrl"] as const).map((field) => <UtilityField key={field}><span>{text[field]}</span><UtilityInput value={p[field]} onChange={(e) => dispatch({ type: "edit", id: p.id, changes: { [field]: e.target.value } })} /></UtilityField>)}
      {productReviewFields(p).some((f) => f !== "productId") && <p className="text-destructive" role="status">{text.review}</p>}
      {p.productIdNeedsReview && <p className="text-destructive" role="status" data-testid="product-id-warning">{text.idWarning}</p>}
    </article>)}
    {products.length > 20 && <div className="flex flex-wrap items-center gap-2"><Button variant="secondary" disabled={current === 0} onClick={() => setPage(current - 1)}>{text.previous}</Button><span>{current + 1} / {last + 1}</span><Button variant="secondary" disabled={current === last} onClick={() => setPage(current + 1)}>{text.next}</Button></div>}
  </div>;
}
