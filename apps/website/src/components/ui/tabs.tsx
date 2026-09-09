import { cn } from "@/lib/utils";
// shadcn/ui Tabs, composed with Radix and AIK semantic tokens (MIT).
import * as TabsPrimitive from "@radix-ui/react-tabs";
import type * as React from "react";
export const Tabs = TabsPrimitive.Root;
export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex items-center gap-1 rounded-lg bg-muted p-1 text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
export function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "rounded-md px-4 py-2 text-sm font-medium transition-colors data-[state=active]:bg-card data-[state=active]:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
        className,
      )}
      {...props}
    />
  );
}
export function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("mt-4 focus-visible:outline-2 focus-visible:outline-ring", className)}
      {...props}
    />
  );
}
