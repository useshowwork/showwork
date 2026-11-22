import { writeContentBatches } from "./batchWriting";
import { formatGeneratedCaption, PLATFORM_CAPTION_STYLE, SOCIAL_CAPTION_STYLE } from "./captionStyle";
import { ContentGenerationError } from "./generationError";
import type { CreativeModel } from "./creativeGeneration";

type Caption = { caption: string; cta: string; hashtags: string };
type SharedCaptionSeed = Caption & {
    contentUnit: number;
    platform: string;
    sourcePlatform: string;
    concept: string;
    format: string;
};

export async function writePlatformCaptions(
    call: CreativeModel,
    context: { evidence: string; managerRequest: string },
    seeds: SharedCaptionSeed[],
    concurrency?: number,
) {
    if (!seeds.length) return new Map<string, Caption>();
    const properties = {
        contentUnit: { type: "integer" },
        platform: { type: "string", enum: [...new Set(seeds.map(seed => seed.platform))] },
        caption: { type: "string" }, cta: { type: "string" }, hashtags: { type: "string" },
    };
    const raw = await writeContentBatches(
        item => call({ ...item, timeoutMs: 120000, attempts: 1 }),
        {
            instructions: `Write destination-specific captions for shared posts. Keep the same concept, facts, objective and creative direction. Rewrite only the public caption, CTA and hashtags. Keep the call to action aligned with the original intent. If the caption closes with a CTA, copy that line exactly into cta. Use an empty cta when the post needs no action. Keep the caption within 2200 characters. ${SOCIAL_CAPTION_STYLE} ${PLATFORM_CAPTION_STYLE}`,
            input: JSON.stringify(context),
            jsonSchema: {
                name: "shared_platform_captions",
                schema: {
                    type: "object", additionalProperties: false, required: ["posts"],
                    properties: { posts: { type: "array", items: { type: "object", additionalProperties: false, required: Object.keys(properties), properties } } },
                },
            },
        },
        seeds,
        { concurrency, batchSize: 8 },
    );
    const adapted = new Map<string, Caption>();
    for (const post of (JSON.parse(raw) as { posts: (Caption & { platform: string; contentUnit: number })[] }).posts) {
        const caption = typeof post.caption === "string" ? formatGeneratedCaption(post.caption) : "";
        if (!caption || caption.length > 2200 ||
            typeof post.cta !== "string" || post.cta.length > 500 ||
            typeof post.hashtags !== "string" || post.hashtags.length > 500)
            throw new ContentGenerationError("AI_CONTENT_INVALID", "The platform captions were incomplete. Please try again.");
        adapted.set(`${post.platform}:${post.contentUnit}`, { caption, cta: post.cta.trim(), hashtags: post.hashtags.trim() });
    }
    return adapted;
}
