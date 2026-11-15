"use client";
import { createContext } from "react";
export const ChannelProductContext = createContext(false);
export function ChannelProductProvider({
  engage,
  children,
}: {
  engage: boolean;
  children: React.ReactNode;
}) {
  return (
    <ChannelProductContext.Provider value={engage}>
      {children}
    </ChannelProductContext.Provider>
  );
}
