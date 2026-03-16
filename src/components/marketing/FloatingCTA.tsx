import { useEffect, useState } from "react";
import { WPT_PROMO } from "../../config/promotions";

export function FloatingCTA() {

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(true);
    }, WPT_PROMO.delay);

    return () => clearTimeout(timer);

  }, []);

  const close = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-in">

      <div className="relative rounded-xl overflow-hidden shadow-2xl">

        <button
          onClick={close}
          className="absolute top-2 right-2 z-50 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center"
        >
          ✕
        </button>

        <a
          href={WPT_PROMO.link}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src={WPT_PROMO.image}
            width={WPT_PROMO.width}
            height={WPT_PROMO.height}
            alt="WPT Global"
            className="block w-full h-auto"
          />
        </a>

      </div>

    </div>
  );
}