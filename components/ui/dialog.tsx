import * as React from "react"
import { cn } from "@/lib/utils"

// A simple Dialog implementation for MVP
export function Dialog({ open, onOpenChange, children }: { open: boolean, onOpenChange: (open: boolean) => void, children: React.ReactNode }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="z-50 w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900 mx-4">
        {children}
      </div>
    </div>
  )
}
