import { useState } from "react";

export function useStatus() {
  const [status, setStatus] = useState("");
  return { status, setStatus, clear: () => setStatus("") };
}

export type StatusApi = ReturnType<typeof useStatus>;
