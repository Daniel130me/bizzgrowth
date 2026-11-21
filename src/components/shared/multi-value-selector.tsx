"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type MultiValueSelectorProps = {
  values: string[];
  suggestions: readonly string[];
  onChange: (values: string[]) => void;
  ariaLabel: string;
  placeholder: string;
  suggestionLabel: string;
  maxItems: number;
  maxValueLength: number;
  disabled?: boolean;
  disabledMessage?: string;
};

function normalizedValue(value: string, maxLength: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

/**
 * Searchable multi-value input used for catalogue-backed fields that also
 * permit precise custom values. Enter and comma commit the current query.
 */
export function MultiValueSelector({
  values,
  suggestions,
  onChange,
  ariaLabel,
  placeholder,
  suggestionLabel,
  maxItems,
  maxValueLength,
  disabled = false,
  disabledMessage,
}: MultiValueSelectorProps) {
  const [query, setQuery] = useState("");
  const selected = useMemo(
    () => new Set(values.map((value) => value.toLocaleLowerCase())),
    [values],
  );
  const matchingSuggestions = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return suggestions.filter((suggestion) => (
      !selected.has(suggestion.toLocaleLowerCase())
      && (!search || suggestion.toLocaleLowerCase().includes(search))
    ));
  }, [query, selected, suggestions]);

  function addValue(rawValue: string) {
    const value = normalizedValue(rawValue, maxValueLength);
    if (!value || values.length >= maxItems || selected.has(value.toLocaleLowerCase())) return;
    onChange([...values, value]);
    setQuery("");
  }

  function removeValue(value: string) {
    onChange(values.filter((item) => item !== value));
  }

  const atLimit = values.length >= maxItems;
  const inputDisabled = disabled || atLimit;

  return (
    <div className="space-y-2">
      <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-md border border-input bg-background px-3 py-2 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
        {values.map((value) => (
          <Badge key={value} variant="secondary" className="gap-1 py-1 pl-2.5 pr-1">
            {value}
            <button
              type="button"
              className="rounded-sm p-0.5 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => removeValue(value)}
              aria-label={`Remove ${value}`}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        <input
          className="min-w-48 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
          value={query}
          maxLength={maxValueLength}
          aria-label={ariaLabel}
          placeholder={atLimit ? "Selection limit reached" : placeholder}
          disabled={inputDisabled}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              addValue(query);
            } else if (event.key === "Backspace" && !query && values.length) {
              removeValue(values[values.length - 1]);
            }
          }}
        />
      </div>

      {disabled ? (
        <p className="text-xs text-muted-foreground">{disabledMessage}</p>
      ) : atLimit ? (
        <p className="text-xs text-muted-foreground">Selection limit reached. Remove an item to add another.</p>
      ) : (
        <div className="rounded-lg border bg-slate-50 p-3">
          <p className="mb-2 text-xs font-medium text-slate-600">
            {query.trim() ? "Matching suggestions" : suggestionLabel}
          </p>
          {matchingSuggestions.length ? (
            <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto" role="group" aria-label={suggestionLabel}>
              {matchingSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => addValue(suggestion)}
                  className="rounded-full border bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Plus className="mr-1 inline size-3" />{suggestion}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No catalogue match. Press Enter or comma to add “{query.trim()}”.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
