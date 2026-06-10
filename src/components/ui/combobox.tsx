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

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
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
    if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
    if (e.key === "Enter" && open && filtered.length > 0) {
      e.preventDefault();
      select(filtered[0]);
    }
  }

  const displayValue = open ? query : (selectedItem?.label ?? "");

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <input type="hidden" name={name} value={value} />
      <div
        onClick={() => {
          if (!disabled) {
            setOpen(true);
            inputRef.current?.focus();
          }
        }}
        className={cn(
          "flex items-center h-9 w-full rounded-md border bg-slate-900 px-3 py-1 text-sm transition-colors",
          disabled
            ? "cursor-not-allowed opacity-50 border-slate-800"
            : "cursor-text border-slate-700",
          open && !disabled && "ring-1 ring-blue-500 border-blue-500"
        )}
      >
        <input
          ref={inputRef}
          value={displayValue}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={selectedItem ? "" : placeholder}
          disabled={disabled}
          readOnly={false}
          className="flex-1 bg-transparent outline-none text-white placeholder:text-slate-500 min-w-0 text-sm"
        />
        <div className="flex items-center gap-0.5 ml-1 shrink-0">
          {value && !disabled && (
            <button
              type="button"
              onClick={clear}
              className="text-slate-300 hover:text-slate-300 rounded p-0.5 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-slate-300 transition-transform duration-150",
              open && "rotate-180"
            )}
          />
        </div>
      </div>

      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 shadow-xl overflow-hidden">
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-sm text-slate-300 text-center">No results</p>
            ) : (
              filtered.map((item) => {
                const active = item.id === value;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => select(item)}
                    className={cn(
                      "w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-slate-700 transition-colors",
                      active && "bg-blue-600/15"
                    )}
                  >
                    <Check
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-400 transition-opacity",
                        active ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="min-w-0">
                      <span
                        className={cn(
                          "block truncate text-sm",
                          active ? "text-blue-300 font-medium" : "text-slate-100"
                        )}
                      >
                        {item.label}
                      </span>
                      {item.sublabel && (
                        <span className="block text-xs text-slate-400 mt-0.5 truncate">
                          {item.sublabel}
                        </span>
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
