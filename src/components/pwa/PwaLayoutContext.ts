import { createContext } from "react";
import type React from "react";

export interface PwaLayoutCtxValue {
  isActive: boolean;
  setTitle: (t: string | undefined) => void;
  setIcon: (i: React.ElementType | undefined) => void;
  setBackTo: (b: string | undefined) => void;
  setOnBack: (f: (() => void) | undefined) => void;
}

export const PwaLayoutCtx = createContext<PwaLayoutCtxValue>({
  isActive: false,
  setTitle: () => {},
  setIcon: () => {},
  setBackTo: () => {},
  setOnBack: () => {},
});
