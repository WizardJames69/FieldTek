import AutoScroll from "embla-carousel-auto-scroll";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";

const trades = [
  { id: "hvac", name: "HVAC" },
  { id: "plumbing", name: "Plumbing" },
  { id: "electrical", name: "Electrical" },
  { id: "mechanical", name: "Mechanical" },
  { id: "fire-safety", name: "Fire & Safety" },
  { id: "refrigeration", name: "Refrigeration" },
  { id: "building-automation", name: "Building Automation" },
  { id: "appliance", name: "Appliance Install & Service" },
  { id: "elevators", name: "Elevators" },
  { id: "industrial", name: "Industrial Maintenance" },
  { id: "aviation", name: "Aviation Maintenance" },
];

export function TrustBar() {
  return (
    <section className="bg-[#0C0D0F] py-10 md:py-12 border-y border-white/[0.06]">
      <div className="mx-auto max-w-5xl px-4">
        <p className="text-sm uppercase tracking-widest text-[#6B7280] mb-8 text-center">
          Purpose-built for field service
        </p>

        <div className="relative">
          {/* Left fade */}
          <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-[#0C0D0F] to-transparent z-10 pointer-events-none" />
          {/* Right fade */}
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-[#0C0D0F] to-transparent z-10 pointer-events-none" />

          <Carousel
            opts={{ loop: true, dragFree: true }}
            plugins={[AutoScroll({ playOnInit: true, speed: 0.5 })]}
          >
            <CarouselContent className="-ml-0">
              {trades.map((trade) => (
                <CarouselItem
                  key={trade.id}
                  className="basis-auto pl-0"
                >
                  <div className="mx-4 md:mx-6 flex shrink-0 items-center justify-center">
                    <span className="text-sm font-medium uppercase tracking-widest text-[#6B7280] whitespace-nowrap">
                      {trade.name}
                    </span>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </div>
      </div>
    </section>
  );
}
