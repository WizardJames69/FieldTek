"use client";
import { useRef, useState, useEffect } from "react";
import { useScroll, useTransform, motion } from "framer-motion";

export function ContainerScroll({
  titleComponent,
  children,
}: {
  titleComponent: string | React.ReactNode;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
  });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const scaleDimensions = () => {
    return isMobile ? [0.7, 0.9] : [1.05, 1];
  };

  const rotate = useTransform(scrollYProgress, [0, 1], [20, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], scaleDimensions());
  const translate = useTransform(scrollYProgress, [0, 1], [0, -100]);

  return (
    <div
      className="h-auto md:h-[70rem] flex items-start md:items-center justify-center relative p-2 md:p-20"
      ref={containerRef}
    >
      <div
        className="py-2 md:py-40 w-full relative"
        style={{
          perspective: "1060px",
        }}
      >
        <Header translate={translate} titleComponent={titleComponent} />
        <Card rotate={rotate} translate={translate} scale={scale}>
          {children}
        </Card>
      </div>
    </div>
  );
}

function Header({
  translate,
  titleComponent,
}: {
  translate: ReturnType<typeof useTransform<number>>;
  titleComponent: React.ReactNode;
}) {
  return (
    <motion.div
      style={{
        translateY: translate,
      }}
      className="div max-w-5xl mx-auto relative z-10 pb-2 md:pb-16"
    >
      {titleComponent}
    </motion.div>
  );
}

function Card({
  rotate,
  scale,
  children,
}: {
  rotate: ReturnType<typeof useTransform<number>>;
  scale: ReturnType<typeof useTransform<number>>;
  translate: ReturnType<typeof useTransform<number>>;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, filter: "blur(12px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      transition={{ type: "spring", bounce: 0.2, duration: 1.5, delay: 0.8 }}
      style={{
        rotateX: rotate,
        scale,
        boxShadow:
          "0 0 80px rgba(249,115,22,0.04), 0 20px 60px rgba(0,0,0,0.5), 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a, 0 233px 65px #00000003",
      }}
      className="max-w-5xl -mt-12 mx-auto h-[26rem] md:h-[32rem] w-full border border-white/[0.06] p-3 bg-[#111214] rounded-2xl shadow-lg shadow-black/30 relative z-0"
    >
      <div className="h-full w-full overflow-hidden rounded-xl bg-[#111113] relative">
        {children}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent to-[#09090B] pointer-events-none z-10" />
      </div>
    </motion.div>
  );
}
