import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <FileQuestion className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-medium">Page not found</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          The workspace or page you&apos;re looking for doesn&apos;t exist or
          you don&apos;t have access to it.
        </p>
        <Button render={<Link href="/" />}>Go home</Button>
      </div>
    </div>
  );
}
