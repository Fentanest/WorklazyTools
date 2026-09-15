import { Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import { matchTools } from "../app/toolSearch";
import { useAppLanguage } from "../i18n/routing";
import { useToolCatalog } from "../i18n/useToolCatalog";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName.toLowerCase();
  if (tag === "textarea" || tag === "select") return true;
  return tag === "input" && (target as HTMLInputElement).type !== "button";
}

export function TopbarSearch({ id }: { id?: string }) {
  const { t } = useTranslation("common");
  const language = useAppLanguage();
  const { toolCategories, tools } = useToolCatalog();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [composing, setComposing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const statusId = useId();

  const results = useMemo(() => {
    const categoryById = new Map(toolCategories.map((category) => [category.id, category]));
    return matchTools(
      tools.map((tool) => ({
        ...tool,
        categoryLabel: categoryById.get(tool.category)?.label ?? "",
        categoryShortLabel: categoryById.get(tool.category)?.shortLabel ?? "",
      })),
      query,
    );
  }, [toolCategories, tools, query]);
  // Focus alone never opens the list; arrows, typing, or a stored query do.
  const showPopup = open;

  // Route or language change closes the popup and clears the active option.
  // The query itself is kept.
  useEffect(() => {
    setOpen(false);
    setActive(-1);
  }, [location.pathname, language]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setOpen(false);
        setActive(-1);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") return;
      if (event.altKey || event.shiftKey || event.defaultPrevented) return;
      const target = event.target as EventTarget | null;
      if (event.isComposing) return;
      if (target instanceof HTMLElement) {
        if (isEditableTarget(target) || target.closest("[role='dialog']")) return;
      }
      if (document.querySelector("[data-testid='pdf-finish-ready'] input:focus")) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Mobile popup height follows the visual viewport above the soft keyboard.
  useEffect(() => {
    if (!showPopup || !window.visualViewport) return;
    const box = boxRef.current;
    if (!box) return;
    const update = () => {
      const viewport = window.visualViewport;
      if (!viewport || !box.isConnected) return;
      const rect = box.getBoundingClientRect();
      const available = viewport.height - (rect.bottom - viewport.offsetTop) - 8;
      box.style.setProperty("--search-popup-max-height", `${Math.max(120, Math.min(320, available))}px`);
    };
    update();
    window.visualViewport.addEventListener("resize", update);
    return () => window.visualViewport?.removeEventListener("resize", update);
  }, [showPopup]);

  const moveTo = (toolPath: string) => {
    setOpen(false);
    setActive(-1);
    navigate(toolPath);
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!results.length) return;
      setOpen(true);
      setActive((current) => {
        if (current === -1) return event.key === "ArrowDown" ? 0 : results.length - 1;
        const next = current + (event.key === "ArrowDown" ? 1 : -1);
        if (next < 0) return results.length - 1;
        if (next >= results.length) return 0;
        return next;
      });
      return;
    }
    if (event.key === "Enter") {
      if (open && active >= 0 && active < results.length) {
        event.preventDefault();
        moveTo(results[active].path);
      }
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  };

  const activeId = active >= 0 && active < results.length ? `global-search-option-${results[active].id}` : undefined;

  return (
    <div ref={boxRef} className="topbar-search" data-testid="global-tool-search">
      <Search size={17} aria-hidden="true" />
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-expanded={showPopup}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        aria-label={t("search.label")}
        placeholder={t("search.placeholder")}
        value={query}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => {
          if (query.trim()) setOpen(true);
        }}
        onBlur={() => {
          setOpen(false);
          setActive(-1);
        }}
        onCompositionStart={() => {
          setComposing(true);
          setOpen(false);
          setActive(-1);
        }}
        onCompositionEnd={(event) => {
          setComposing(false);
          setQuery(event.currentTarget.value);
          setActive(-1);
        }}
        onKeyDown={onInputKeyDown}
      />
      {!query && <kbd className="topbar-search-kbd" aria-hidden="true">{t("search.shortcut")}</kbd>}
      {showPopup && !composing && (
        <div className="topbar-search-popup" role="presentation">
          <ul role="listbox" id={listId} aria-label={t("search.label")}>
            {results.map((tool, index) => (
              <li
                key={tool.id}
                id={`global-search-option-${tool.id}`}
                role="option"
                aria-selected={index === active}
                data-active={index === active || undefined}
                onMouseDown={(event) => {
                  // Select on mousedown so blur never steals the click;
                  // touch scrolls are filtered by movement below.
                  event.preventDefault();
                  moveTo(tool.path);
                }}
                onTouchStart={(event) => {
                  const touch = event.touches[0];
                  (event.currentTarget as HTMLElement).dataset.touchX = `${touch.clientX}`;
                  (event.currentTarget as HTMLElement).dataset.touchY = `${touch.clientY}`;
                }}
                onTouchEnd={(event) => {
                  const element = event.currentTarget as HTMLElement;
                  const touch = event.changedTouches[0];
                  const dx = touch.clientX - Number(element.dataset.touchX ?? touch.clientX);
                  const dy = touch.clientY - Number(element.dataset.touchY ?? touch.clientY);
                  if (Math.hypot(dx, dy) > 10) return;
                  moveTo(tool.path);
                }}
              >
                <span className="topbar-search-option-title">{tool.title}</span>
                <span className="topbar-search-option-desc">{tool.shortTitle}</span>
              </li>
            ))}
          </ul>
          <p id={statusId} role="status" aria-atomic="true" className="topbar-search-status">
            {t("search.results", { count: results.length })}
          </p>
        </div>
      )}
      {!showPopup && (
        <span role="status" aria-atomic="true" className="topbar-search-status sr-only">
          {query.trim() ? t("search.results", { count: 0 }) : ""}
        </span>
      )}
    </div>
  );
}
