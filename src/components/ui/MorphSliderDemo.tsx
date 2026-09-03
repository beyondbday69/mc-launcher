import MorphSlider from "./MorphSlider";

const items = [
  {
    image:
      "https://images.unsplash.com/photo-1782977389500-dd7adad33ebe?q=80&w=1600&auto=format&fit=crop",
    caption: "One",
  },
  {
    image:
      "https://images.unsplash.com/photo-1781499455083-6ccc3beb20cd?q=80&w=1600&auto=format&fit=crop",
    caption: "Two",
  },
  {
    image:
      "https://images.unsplash.com/photo-1776394254711-4a0d7345269a?q=80&w=1600&auto=format&fit=crop",
    caption: "Three",
  },
];

export default function MorphSliderDemo() {
  return (
    <div style={{ height: "500px", position: "relative", width: "100%", maxWidth: "900px", margin: "0 auto" }}>
      <MorphSlider
        items={items}
        transition="melt"
        intensity={0.55}
        aberration={0.35}
        drift={0.4}
        autoplay={false}
        overlayColor="#05060a"
        duration={1.1}
        ease="power2.inOut"
        scale={2.4}
        autoplayDelay={4}
        loop
        radius={16}
        showCaptions
        showControls
        showIndicators
      />
    </div>
  );
}
