import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";

export default function InviteLoading() {
  return (
    <Card>
      <CardHeader>
        {/* Title skeleton */}
        <div className="h-7 w-48 animate-pulse bg-muted" />
        {/* Description skeleton */}
        <div className="h-4 w-64 animate-pulse bg-muted" />
      </CardHeader>
      <CardContent>
        {/* Action button skeleton */}
        <div className="h-9 w-full animate-pulse bg-muted" />
      </CardContent>
    </Card>
  );
}
