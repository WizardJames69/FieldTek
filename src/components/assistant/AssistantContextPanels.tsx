import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Briefcase, ChevronsUpDown, FileText, Search, Wrench, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface JobContext {
  id: string;
  title: string;
  job_type: string | null;
  current_stage: string | null;
  priority: string | null;
  description: string | null;
  address: string | null;
  equipment_id: string | null;
  client_id: string | null;
}

export interface EquipmentContext {
  id: string;
  equipment_type: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  install_date: string | null;
  warranty_expiry: string | null;
  location_notes: string | null;
}

export interface DocumentContext {
  id: string;
  name: string;
  category: string | null;
}

interface AssistantContextPanelsProps {
  jobs: JobContext[];
  selectedJob: JobContext | null;
  jobSearchQuery: string;
  onJobSearchQueryChange: (query: string) => void;
  onJobSelect: (jobId: string) => void;
  onClearJob: () => void;
  equipment: EquipmentContext | null;
  documents: DocumentContext[];
}

/**
 * The Job Context / Equipment / Available Docs cards, extracted so the same
 * panels render in the desktop rail and the mobile context Sheet. All state
 * and handlers stay in Assistant.tsx; only the combobox open state is local
 * (per instance) so the hidden desktop rail can't ghost-open its popover
 * while the Sheet instance is in use.
 */
export function AssistantContextPanels({
  jobs,
  selectedJob,
  jobSearchQuery,
  onJobSearchQueryChange,
  onJobSelect,
  onClearJob,
  equipment,
  documents,
}: AssistantContextPanelsProps) {
  const [jobSearchOpen, setJobSearchOpen] = useState(false);

  return (
    <Card className="divide-y overflow-hidden">
      <div className="p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-foreground/80">
          <Briefcase className="h-4 w-4 text-muted-foreground" />
          Job Context
        </h3>
        <Popover open={jobSearchOpen} onOpenChange={setJobSearchOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={jobSearchOpen}
              className="w-full justify-between font-normal"
            >
              <span className="truncate">
                {selectedJob ? selectedJob.title : "Search for a job..."}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover" align="start">
            <Command>
              <CommandInput
                placeholder="Search jobs..."
                value={jobSearchQuery}
                onValueChange={onJobSearchQueryChange}
              />
              <CommandList>
                <CommandEmpty>No jobs found.</CommandEmpty>
                <CommandGroup>
                  {jobs.map((job) => (
                    <CommandItem
                      key={job.id}
                      value={job.title}
                      onSelect={() => {
                        onJobSelect(job.id);
                        setJobSearchOpen(false);
                        onJobSearchQueryChange("");
                      }}
                    >
                      <Search className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate">{job.title}</span>
                      {job.job_type && (
                        <Badge variant="secondary" className="ml-auto text-[10px] px-1.5">
                          {job.job_type}
                        </Badge>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {selectedJob && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">{selectedJob.job_type || "General"}</Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onClearJob}
                aria-label="Clear job context"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            {selectedJob.current_stage && (
              <p className="text-xs text-muted-foreground">
                Stage: {selectedJob.current_stage}
              </p>
            )}
            {selectedJob.address && (
              <p className="text-xs text-muted-foreground truncate">
                {selectedJob.address}
              </p>
            )}
          </div>
        )}
      </div>

      {equipment && (
        <div className="p-4">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 text-foreground/80">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            Equipment
          </h3>
          <div className="space-y-1 text-sm">
            <p className="font-medium">{equipment.equipment_type}</p>
            {equipment.brand && (
              <p className="text-muted-foreground">
                {equipment.brand} {equipment.model}
              </p>
            )}
            {equipment.serial_number && (
              <p className="text-xs text-muted-foreground">
                S/N: {equipment.serial_number}
              </p>
            )}
            {equipment.warranty_expiry && (
              <Badge
                variant="outline"
                className={cn(
                  "text-xs mt-2",
                  new Date(equipment.warranty_expiry) < new Date()
                    ? "border-destructive text-destructive"
                    : "border-emerald-500 text-emerald-600"
                )}
              >
                Warranty: {new Date(equipment.warranty_expiry) < new Date() ? "Expired" : "Active"}
              </Badge>
            )}
          </div>
        </div>
      )}

      {documents.length > 0 && (
        <div className="p-4">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 text-foreground/80">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Available Docs
          </h3>
          <div className="space-y-1">
            {documents.slice(0, 5).map((doc) => (
              <p key={doc.id} className="text-xs text-muted-foreground truncate">
                {doc.name}
              </p>
            ))}
            {documents.length > 5 && (
              <p className="text-xs text-muted-foreground">
                +{documents.length - 5} more
              </p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
