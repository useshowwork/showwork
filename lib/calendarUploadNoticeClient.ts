import { calendarMutationFetch } from "@/lib/publishing/clientRequests";

export function calendarUploadBatch(calendarId: string) {
  const id = crypto.randomUUID();
  const receipts = new Map<string, object>();
  return {
    id,
    record(receipt: unknown) {
      if (receipt && typeof receipt === "object" && "postId" in receipt && typeof receipt.postId === "string") {
        receipts.set(receipt.postId, receipt);
      }
    },
    async notify() {
      if (!receipts.size) return;
      const body = JSON.stringify({ batchId: id, receipts: [...receipts.values()], timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await calendarMutationFetch(`/api/calendars/${calendarId}/uploads/notify`, {
            method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body,
          });
          if (response.ok) return;
          if (response.status < 500) break;
        } catch {
          // Retry the same batch so the email provider can deduplicate it.
        }
      }
      console.warn("Could not confirm the workspace upload notification.");
    },
  };
}
