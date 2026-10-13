import { CheckCircle } from "@phosphor-icons/react/dist/csr/CheckCircle";
import type { ReactNode } from "react";

type SelectionCardProps = {
  group: string;
  value: string;
  title: string;
  checked: boolean;
  subdued: boolean;
  featured?: boolean;
  onSelect: () => void;
  children: ReactNode;
};

export function SelectionCard({ group, value, title, checked, subdued, featured, onSelect, children }: SelectionCardProps) {
  const id = `${group}-${value}`;
  return (
    <label className="relative flex cursor-pointer" htmlFor={id}>
      <input
        id={id} type="radio" name={group} value={value} checked={checked}
        aria-label={title} aria-describedby={`${id}-description`}
        onChange={onSelect}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (!event.repeat) onSelect();
          }
        }}
        className="peer sr-only"
      />
      <span className={`relative flex w-full flex-col overflow-hidden rounded-2xl border-2 p-5 text-left transition-all duration-300 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-[#182026] hover:shadow-[0_8px_24px_-8px_rgba(24,32,38,0.12)] motion-safe:hover:-translate-y-1 ${checked ? "border-[#182026] shadow-[0_4px_20px_-2px_rgba(24,32,38,0.05)]" : featured ? "border-[#182026]/20 shadow-sm" : "border-[#E4E9E7]"} ${subdued ? "bg-white/60 motion-safe:scale-[0.98] hover:bg-white peer-focus-visible:bg-white" : "bg-white"}`}>
        {featured ? <span className="absolute right-0 top-0 rounded-bl-lg bg-[#7ED6A5] px-3 py-1 text-[10px] font-bold tracking-wider">MÁS ELEGIDO</span> : null}
        <CheckCircle aria-hidden="true" weight="fill" className={`absolute right-4 text-xl transition-opacity ${featured ? "top-8" : "top-4"} ${checked ? "opacity-100" : "opacity-0"}`} />
        {children}
      </span>
    </label>
  );
}
