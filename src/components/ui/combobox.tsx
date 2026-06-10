"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type ComboboxItem = { id: string; label: string; sublabel?: string };

type Props = {
  name: string;
  items: ComboboxItem[];
  defaultValue?: string;
  value?: string;
  onChange?: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function Combobox({
  name,
  items,
  defaultValue = "",
  value: controlledValue,
  onChange,
  placeholder = "Search or select…",
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [internalId, setInternalId] = useState(defaultValue);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const value = controlledValue !== undefined ? controlledValue : internalId;
  const selectedItem = items.find((i) => i.id === value);

  // Close on tap/click outside — pointerdown covers both mouse and touch
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const filtered = query.trim()
    ? items.filter(
        (i) =>
          i.label.toLowerCase().includes(query.toLowerCase()) ||
          i.sublabel?.toLowerCase().includes(query.toLowerCase())
      )
    : items;

  function select(item: ComboboxItem) {
    if (controlledValue === undefined) setInternalId(item.id);
    onChange?.(item.id);
    setQuery("");
    setOpen(false);
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    if (controlledValue === undefined) setInternalId("");
    onChange?.("");
    setQuery("");
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { setOpen(false); setQuery(""); }
    if (e.key === "Enter" && open && filtered.length > 0) {
      e.preventDefault();
      select(filtered[0]);
    }
  }

  const displayValue = open ? query : (selectedItem?.label ?? "");

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <input type="hidden" name={name} value={value} />

      {/* Trigger */}
      <div
        onClick={() => { if (!disabled) { setOpen(true); inputRef.current?.focus(); } }}
        className={cn(
          "flex items-center h-11 w-full rounded-xl border bg-slate-900 px-3 text-sm transition-colors",
          disabled ? "cursor-not-allowed opacity-50 border-slate-800" : "cursor-text border-slate-700",
          open && !disabled && "ring-2 ring-blue-500 border-blue-500"
        )}
      >
        <input
          ref={inputRef}
          value={displayValue}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={selectedItem ? "" : placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent outline-none text-white placeholder:text-slate-500 min-w-0 text-sm"
        />
        <div className="flex items-center gap-0.5 ml-1 shrink-0">
          {value && !disabled && (
            <button
              type="button"
              onClick={clear}
              className="text-slate-400 hover:text-white rounded p-1 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform duration-150", open && "rotate-180")} />
        </div>
      </div>

      {/* Dropdown */}
      {open && !disabled && (
        <div className="absolute z-50 mt-1.5 w-full rounded-xl border border-slate-600 bg-slate-800 shadow-2xl overflow-hidden">
          <div className="max-h-[min(280px,45vh)] overflow-y-auto py-1 overscroll-contain">
            {filtered.length === 0 ? (
              <p className="px-4 py-4 text-sm text-slate-400 text-center">No results</p>
            ) : (
              filtered.map((item) => {
                const active = item.id === value;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => select(item)}
                    className={cn(
                      "w-full flex items-start gap-2.5 px-4 py-3 text-left transition-colors active:bg-slate-700",
                      active ? "bg-blue-600/20 hover:bg-blue-600/25" : "hover:bg-slate-700"
                    )}
                  >
                    <Check className={cn("h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-400 transition-opacity", active ? "opacity-100" : "opacity-0")} />
                    <div className="min-w-0 flex-1">
                      <span className={cn("block text-sm leading-snug", active ? "text-blue-300 font-medium" : "text-slate-100")}>
                        {item.label}
                      </span>
                      {item.sublabel && (
                        <span className="block text-xs text-slate-400 mt-0.5">{item.sublabel}</span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
