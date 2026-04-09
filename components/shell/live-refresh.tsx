"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      router.refresh();
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [router]);

  return null;
}
