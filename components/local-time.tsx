"use client";

import { useEffect, useState } from "react";

type Props = {
  value: string;
};

function formatTime(value: string, timeZone?: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone
  }).format(new Date(value));
}

export function LocalTime({ value }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <time dateTime={value}>
      {mounted ? formatTime(value) : formatTime(value, "UTC")}
    </time>
  );
}
