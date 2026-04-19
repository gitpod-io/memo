import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function RootNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-foreground">
      <div className="flex flex-col items-center gap-4 text-center">
        <FileQuestion className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-medium">Page not found</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Button render={<Link href="/" />}>Go home</Button>
      </div>
    </div>
  );
}
