"use client"

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible"

import { cn } from "@/lib/utils"

const Collapsible = CollapsiblePrimitive.Root

const CollapsibleTrigger = CollapsiblePrimitive.Trigger

const CollapsibleContent = ({
  className,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Panel>) => (
  <CollapsiblePrimitive.Panel
    data-slot="collapsible-content"
    className={cn("overflow-hidden text-sm transition-all", className)}
    {...props}
  />
)

export {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
}
