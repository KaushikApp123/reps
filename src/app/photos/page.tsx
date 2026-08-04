import { createClient } from "@/lib/supabase/server";
import { requireOnboarded } from "@/lib/data";
import { s3Configured, signView } from "@/lib/s3";
import { EmptyState, SectionTitle } from "@/components/ui";
import PhotoGrid from "./photo-grid";

// Presigned view URLs are short-lived, so this page must not be cached.
export const dynamic = "force-dynamic";

export default async function PhotosPage() {
  const { userId } = await requireOnboarded();
  const supabase = await createClient();

  const { data: photos } = await supabase
    .from("progress_photos")
    .select("id, s3_key, note, taken_at")
    .eq("user_id", userId)
    .order("taken_at", { ascending: false });

  const configured = s3Configured();

  // Sign each object for viewing. The bucket itself stays private.
  const withUrls = configured
    ? await Promise.all(
        (photos ?? []).map(async (p) => ({
          id: p.id,
          note: p.note,
          takenAt: p.taken_at,
          url: await signView(p.s3_key),
        })),
      )
    : [];

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 pb-8 pt-7">
      <header className="animate-rise mb-6">
        <h1 className="text-[26px] font-bold leading-tight">Progress photos</h1>
        <p className="mt-1 text-sm text-muted">
          Private to you. Stored encrypted, served through links that expire.
        </p>
      </header>

      {!configured ? (
        <EmptyState
          icon="🔒"
          title="Photo storage isn't configured"
          body="Set the AWS environment variables to enable progress photos on this deployment."
        />
      ) : (
        <>
          <PhotoGrid photos={withUrls} />

          <section className="mt-8">
            <SectionTitle>How this works</SectionTitle>
            <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4 text-sm leading-relaxed text-muted">
              Photos upload straight from your device to private S3 storage
              using a one-minute signed link, so they never pass through the
              app server. Viewing uses a separate link that expires after five
              minutes. Only the object key is kept in the database.
            </div>
          </section>
        </>
      )}
    </main>
  );
}
