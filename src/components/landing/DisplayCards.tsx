import { cn } from "@/lib/utils";
import { Network, FileSearch, Brain } from "lucide-react";

interface DisplayCardProps {
  className?: string;
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  date?: string;
  iconClassName?: string;
  titleClassName?: string;
}

function DisplayCard({
  className,
  icon = <Brain className="size-4 text-orange-300" />,
  title = "Featured",
  description = "Discover amazing content",
  date = "Just now",
  iconClassName,
  titleClassName = "text-orange-400",
}: DisplayCardProps) {
  return (
    <div
      className={cn(
        "relative flex h-36 w-[18rem] sm:w-[22rem] -skew-y-[8deg] select-none flex-col justify-between rounded-xl border-2 border-zinc-700 bg-[#18181B]/70 backdrop-blur-sm px-4 py-3 transition-all duration-700 overflow-hidden after:absolute after:-right-1 after:top-[-5%] after:h-[110%] after:w-[16rem] sm:after:w-[20rem] after:bg-gradient-to-l after:from-[#09090B] after:to-transparent after:content-[''] hover:border-white/20 hover:bg-[#1f1f23] [&>*]:flex [&>*]:items-center [&>*]:gap-2 touch-manipulation display-card-float",
        className
      )}
    >
      <div>
        <span className={cn("relative inline-block rounded-full bg-orange-900 p-1", iconClassName)}>
          {icon}
        </span>
        <p className={cn("text-lg font-medium", titleClassName)}>{title}</p>
      </div>
      <p className="text-sm sm:text-lg text-zinc-200 truncate">{description}</p>
      <p className="text-zinc-500">{date}</p>
    </div>
  );
}

interface DisplayCardsProps {
  cards?: DisplayCardProps[];
}

export function DisplayCards({ cards }: DisplayCardsProps) {
  const defaultCards: DisplayCardProps[] = [
    {
      className:
        "[grid-area:stack] hover:-translate-y-10 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-zinc-700 before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-[#09090B]/50 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration-700 hover:grayscale-0 before:left-0 before:top-0",
      icon: <Network className="size-4 text-orange-300" />,
      title: "Knowledge Graph",
      description: "Equipment relationships mapped",
      date: "4 models connected",
      titleClassName: "text-orange-400",
    },
    {
      className:
        "[grid-area:stack] translate-x-12 sm:translate-x-16 translate-y-10 hover:-translate-y-1 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-zinc-700 before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-[#09090B]/50 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration-700 hover:grayscale-0 before:left-0 before:top-0",
      icon: <FileSearch className="size-4 text-orange-300" />,
      title: "RAG Pipeline",
      description: "Real-time document retrieval",
      date: "12 manuals indexed",
      titleClassName: "text-orange-400",
    },
    {
      className:
        "[grid-area:stack] translate-x-24 sm:translate-x-32 translate-y-20 hover:translate-y-10",
      icon: <Brain className="size-4 text-orange-300" />,
      title: "Diagnostic Loop",
      description: "Learning from every repair",
      date: "142 outcomes analyzed",
      titleClassName: "text-orange-400",
    },
  ];

  const displayCards = cards || defaultCards;

  return (
    <div className="grid [grid-template-areas:'stack'] place-items-center opacity-100 animate-in fade-in-0 duration-700 overflow-visible pb-24 sm:pb-28">
      {displayCards.map((cardProps, index) => (
        <DisplayCard key={index} {...cardProps} />
      ))}
    </div>
  );
}
