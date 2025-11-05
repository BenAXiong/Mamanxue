import { useEffect, useState } from "react";

const HIDE_THRESHOLD = 12;

export function Footer() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    const update = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastY;

      if (Math.abs(delta) > HIDE_THRESHOLD) {
        setHidden(delta > 0);
        lastY = currentY;
      }

      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <footer
      className={`sticky bottom-0 z-10 bg-slate-950/80 px-4 py-3 text-center text-xs text-slate-500 backdrop-blur transition-transform duration-300 sm:px-6 md:px-8 ${
        hidden ? "translate-y-full opacity-0" : "translate-y-0 opacity-100"
      }`}
    >
      <p>Built with love for spaced repetition · 曼曼學</p>
    </footer>
  );
}

export default Footer;
