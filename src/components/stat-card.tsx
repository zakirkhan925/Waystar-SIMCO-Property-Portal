import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("gap-1 py-4", className)}>
      <CardContent className="space-y-1 px-4">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="text-xl font-semibold tabular-nums sm:text-2xl">{value}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}
