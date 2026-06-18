"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PlatformLink } from "@/lib/types";

type Props = {
  isSignedIn: boolean;
  platforms: Pick<PlatformLink, "id" | "title" | "image_url">[];
};

export function HeroPlatformCarousel({ isSignedIn, platforms }: Props) {
  const slides = platforms.filter((platform) => platform.image_url);
  const [activeIndex, setActiveIndex] = useState(0);
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);

  useEffect(() => {
    if (slides.length < 2) return;

    const interval = window.setInterval(() => {
      setActiveIndex((current) => {
        setPreviousIndex(current);
        return (current + 1) % slides.length;
      });
    }, 3200);

    return () => window.clearInterval(interval);
  }, [slides.length]);

  const activeSlide = slides[activeIndex];
  const previousSlide = previousIndex === null ? null : slides[previousIndex];

  return (
    <div className="hero-platform-panel">
      <div className="hero-platform-frame">
        {activeSlide?.image_url ? (
          <>
            {previousSlide?.image_url ? (
              <img
                key={`previous-${previousSlide.id}-${activeIndex}`}
                className="hero-platform-slide hero-platform-slide-exit"
                src={previousSlide.image_url}
                alt=""
                aria-hidden="true"
              />
            ) : null}
            <img
              key={activeSlide.id}
              className="hero-platform-slide hero-platform-slide-enter"
              src={activeSlide.image_url}
              alt={activeSlide.title}
            />
          </>
        ) : (
          <span>No games yet</span>
        )}
      </div>
      <div className="hero-actions">
        <a className="button hero-button-secondary" href="#host-chat-options">
          Talk To Host
        </a>
        <Link className="button hero-button-primary" href="/auth">
          Sign Up Now
        </Link>
      </div>
    </div>
  );
}
