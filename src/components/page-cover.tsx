"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus, ImageOff, Replace } from "lucide-react";
import { getClient } from "@/lib/supabase/lazy-client";
import { captureSupabaseError } from "@/lib/sentry";
import { lazyCaptureException } from "@/lib/capture";
import { toast } from "@/lib/toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ACCEPTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

interface PageCoverProps {
  pageId: string;
  initialCoverUrl: string | null;
}

export function PageCover({ pageId, initialCoverUrl }: PageCoverProps) {
  const [coverUrl, setCoverUrl] = useState<string | null>(initialCoverUrl);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadCover = useCallback(
    async (file: File) => {
      if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
        toast.error("Unsupported image type. Use PNG, JPEG, GIF, or WebP.", {
          duration: 8000,
        });
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error("Image is too large. Maximum size is 5 MB.", {
          duration: 8000,
        });
        return;
      }

      setUploading(true);
      try {
        const supabase = await getClient();
        const ext = file.name.split(".").pop() ?? "png";
        const fileName = `${crypto.randomUUID()}.${ext}`;
        const filePath = `covers/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("page-images")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          captureSupabaseError(uploadError, "page-cover:upload");
          toast.error("Failed to upload cover image", { duration: 8000 });
          return;
        }

        const { data: urlData } = supabase.storage
          .from("page-images")
          .getPublicUrl(filePath);

        const newUrl = urlData.publicUrl;
        setCoverUrl(newUrl);

        const { error: updateError } = await supabase
          .from("pages")
          .update({ cover_url: newUrl })
          .eq("id", pageId);

        if (updateError) {
          captureSupabaseError(updateError, "page-cover:save");
          setCoverUrl(initialCoverUrl);
          toast.error("Failed to save cover image", { duration: 8000 });
        }
      } catch (error) {
        lazyCaptureException(error);
        toast.error("Failed to upload cover image", { duration: 8000 });
      } finally {
        setUploading(false);
      }
    },
    [pageId, initialCoverUrl],
  );

  const removeCover = useCallback(async () => {
    const previousUrl = coverUrl;
    setCoverUrl(null);

    try {
      const supabase = await getClient();
      const { error } = await supabase
        .from("pages")
        .update({ cover_url: null })
        .eq("id", pageId);

      if (error) {
        captureSupabaseError(error, "page-cover:remove");
        setCoverUrl(previousUrl);
        toast.error("Failed to remove cover image", { duration: 8000 });
      }
    } catch (error) {
      lazyCaptureException(error);
      setCoverUrl(previousUrl);
      toast.error("Failed to remove cover image", { duration: 8000 });
    }
  }, [pageId, coverUrl]);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        void uploadCover(file);
      }
      // Reset so the same file can be re-selected
      e.target.value = "";
    },
    [uploadCover],
  );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
      {coverUrl ? (
        <div className="group/cover relative -mx-6 -mt-6 mb-6">
          <div className="relative h-[200px] w-full overflow-hidden">
            <img
              src={coverUrl}
              alt=""
              className="h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />
          </div>
          <div className="absolute right-4 top-4 flex gap-1 opacity-0 transition-opacity group-hover/cover:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex h-7 items-center gap-1.5 bg-background/80 px-2 text-xs text-muted-foreground backdrop-blur-sm hover:bg-background/90 hover:text-foreground"
                disabled={uploading}
              >
                {uploading ? "Uploading…" : "Cover"}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={openFilePicker}>
                  <Replace className="h-4 w-4" />
                  Change cover
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={removeCover}
                >
                  <ImageOff className="h-4 w-4" />
                  Remove cover
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ) : (
        <div className="mb-1 max-sm:opacity-100 opacity-0 group-hover/page-header:opacity-100">
          <button
            className="flex min-h-11 items-center gap-1 rounded-sm px-1.5 text-xs text-muted-foreground hover:bg-overlay-hover sm:min-h-7"
            aria-label="Add cover image"
            onClick={openFilePicker}
            disabled={uploading}
          >
            <ImagePlus className="h-3.5 w-3.5" />
            <span>{uploading ? "Uploading…" : "Add cover"}</span>
          </button>
        </div>
      )}
    </>
  );
}
