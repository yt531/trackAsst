import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function mergeCategories(defaultCats: any[], customCats: any[]): any[] {
  const customMap = new Map(customCats.map(c => [c.id, c]));
  
  const merged = [];
  for (const dc of defaultCats) {
    const custom = customMap.get(dc.id);
    if (custom) {
      if (!custom.isDeleted) {
        merged.push(custom);
      }
      customMap.delete(dc.id);
    } else {
      merged.push(dc);
    }
  }
  
  for (const custom of customMap.values()) {
    if (!custom.isDeleted) {
      merged.push(custom);
    }
  }
  
  return merged;
}
