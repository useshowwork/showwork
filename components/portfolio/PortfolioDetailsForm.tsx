"use client";

import { IMAGE_FILE_ACCEPT, MEDIA_FILE_ACCEPT, getFileContentType } from "@/lib/mediaFileTypes";

import { useState, type InputHTMLAttributes } from "react";
import { ArrowRight, Check, CheckCircle2, ImagePlus, Loader2, Mail, Monitor, Plus, Save, Smartphone, Upload, UserRound, X } from "lucide-react";
import styles from "./PortfolioIdentity.module.css";
import { useRouter } from "next/navigation";
import { putFileWithProgress } from "@/lib/uploadClient";

interface BannerCandidate {
  id: string;
  url: string;
  type: "PHOTO" | "VIDEO";
}

async function prepareBannerFile(file: File, maxDimension: number): Promise<File> {
  if (!getFileContentType(file).startsWith("image/") || typeof createImageBitmap === "undefined") return file;
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.92));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, "") || "portfolio-banner";
    return new File([blob], `${name}.webp`, { type: "image/webp", lastModified: Date.now() });
  } catch {
    // Unsupported image codecs and browser canvas failures keep the original upload intact.
    return file;
  } finally {
    bitmap?.close();
  }
}

export default function PortfolioDetailsForm({
  companyName,
  heroTagline,
  heroMediaId,
    heroBannerDesktopUrl: initialBannerDesktopUrl,
  heroBannerDesktopType: initialBannerDesktopType,
  heroBannerMobileUrl: initialBannerMobileUrl,
  heroBannerMobileType: initialBannerMobileType,
  bannerCandidates,
  contactEmail,
  whatsappNumber,
  ctaText,
  instagramUrl,
  twitterUrl,
  linkedinUrl,
  tiktokUrl,
  facebookUrl,
  youtubeUrl,
  bioText: initialBioText,
  bioSkills: initialBioSkills,
  bioStat: initialBioStat,
  bioPhotoUrl: initialBioPhotoUrl,
}: {
   companyName: string;
  heroTagline: string | null;
  heroMediaId: string | null;
    heroBannerDesktopUrl: string | null;
  heroBannerDesktopType: string | null;
  heroBannerMobileUrl: string | null;
  heroBannerMobileType: string | null;
  bannerCandidates: BannerCandidate[];
  contactEmail: string | null;
  whatsappNumber: string | null;
  ctaText: string | null;
  instagramUrl: string | null;
  twitterUrl: string | null;
  linkedinUrl: string | null;
  tiktokUrl: string | null;
  facebookUrl: string | null;
  youtubeUrl: string | null;
  bioText?: string | null;
  bioSkills?: string[];
  bioStat?: string | null;
  bioPhotoUrl?: string | null;
}) {
  const router = useRouter();

   const [name, setName] = useState(companyName);
  const [tagline, setTagline] = useState(heroTagline ?? "");
  const [selectedHero, setSelectedHero] = useState(heroMediaId);
    const [bannerDesktopUrl, setBannerDesktopUrl] = useState(initialBannerDesktopUrl ?? "");
  const [bannerDesktopType, setBannerDesktopType] = useState<"IMAGE" | "VIDEO">((initialBannerDesktopType as "IMAGE" | "VIDEO") ?? "IMAGE");
  const [bannerMobileUrl, setBannerMobileUrl] = useState(initialBannerMobileUrl ?? "");
  const [bannerMobileType, setBannerMobileType] = useState<"IMAGE" | "VIDEO">((initialBannerMobileType as "IMAGE" | "VIDEO") ?? "IMAGE");
  const [uploadingDesktopBanner, setUploadingDesktopBanner] = useState(false);
  const [uploadingMobileBanner, setUploadingMobileBanner] = useState(false);
  const [desktopBannerProgress, setDesktopBannerProgress] = useState(0);
  const [mobileBannerProgress, setMobileBannerProgress] = useState(0);
  const [email, setEmail] = useState(contactEmail ?? "");
  const [whatsapp, setWhatsapp] = useState(whatsappNumber ?? "");
  const [cta, setCta] = useState(ctaText ?? "");
  const [instagram, setInstagram] = useState(instagramUrl ?? "");
  const [twitter, setTwitter] = useState(twitterUrl ?? "");
  const [linkedin, setLinkedin] = useState(linkedinUrl ?? "");
  const [tiktok, setTiktok] = useState(tiktokUrl ?? "");
  const [facebook, setFacebook] = useState(facebookUrl ?? "");
  const [youtube, setYoutube] = useState(youtubeUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // ── Intro / bio section — shown before the portfolio's own sections
  // on the public page. Separate state from everything above, but
  // saved together in the same save() call below. ──
  const [bioText, setBioText] = useState(initialBioText ?? "");
  const [bioSkills, setBioSkills] = useState<string[]>(initialBioSkills ?? []);
  const [skillDraft, setSkillDraft] = useState("");
  const [bioStat, setBioStat] = useState(initialBioStat ?? "");
  const [bioPhotoUrl, setBioPhotoUrl] = useState(initialBioPhotoUrl ?? "");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(0);

  const uploadBioPhoto = async (file: File) => {
    setUploadingPhoto(true);
    setPhotoProgress(0);
    setUploadError(null);
    try {
      const presignRes = await fetch("/api/portfolio/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: getFileContentType(file), fileSizeMb: file.size / (1024 * 1024) }),
      });
      const presignData = await presignRes.json();
      if (!presignRes.ok) throw new Error(presignData.error ?? "Failed to start upload");

      await putFileWithProgress(presignData.uploadUrl, file, { contentType: getFileContentType(file), onProgress: ({ percent }) => setPhotoProgress(percent) });

      // A profile photo isn't gallery work, so this deliberately never
      // calls /api/portfolio/upload/complete — that route creates a
      // PortfolioMedia row meant for actual portfolio pieces, which
      // isn't what a bio photo is. presignData.publicUrl is what gets
      // saved directly.
      setBioPhotoUrl(presignData.publicUrl);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Photo upload failed. Please try again.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const uploadBanner = async (
    file: File,
    setUrl: (url: string) => void,
    setType: (type: "IMAGE" | "VIDEO") => void,
    setUploading: (v: boolean) => void,
    setProgress: (percent: number) => void,
    maxDimension: number,
  ) => {
    setUploading(true);
    setUploadError(null);
    setProgress(0);
    try {
      const uploadFile = await prepareBannerFile(file, maxDimension);
      const presignRes = await fetch("/api/portfolio/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: uploadFile.name, contentType: getFileContentType(uploadFile), fileSizeMb: uploadFile.size / (1024 * 1024) }),
      });
      const presignData = await presignRes.json();
      if (!presignRes.ok) throw new Error(presignData.error ?? "Failed to start upload");

      await putFileWithProgress(presignData.uploadUrl, uploadFile, { contentType: getFileContentType(uploadFile), onProgress: ({ percent }) => setProgress(percent) });

      // Same reasoning as the bio photo above — a banner isn't a
      // gallery piece, so this never calls /api/portfolio/upload/
      // complete; the public URL is saved directly. The type is
      // recorded alongside it so the public page knows whether to
      // render this as an <img> or a <video>.
      setUrl(presignData.publicUrl);
      setType(getFileContentType(uploadFile).startsWith("video/") ? "VIDEO" : "IMAGE");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Banner upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };
  const addSkill = () => {
    const trimmed = skillDraft.trim();
    if (trimmed && !bioSkills.includes(trimmed)) {
      setBioSkills([...bioSkills, trimmed]);
    }
    setSkillDraft("");
  };

  const removeSkill = (skill: string) => {
    setBioSkills(bioSkills.filter((s) => s !== skill));
  };

  const [activeTab, setActiveTab] = useState<'basics' | 'banner' | 'about' | 'contact'>('basics');
  const [saveError, setSaveError] = useState<string | null>(null);
  const values = {
    companyName: name, heroTagline: tagline, heroMediaId: selectedHero,
    heroBannerDesktopUrl: bannerDesktopUrl, heroBannerDesktopType: bannerDesktopType,
    heroBannerMobileUrl: bannerMobileUrl, heroBannerMobileType: bannerMobileType,
    contactEmail: email, whatsappNumber: whatsapp, ctaText: cta,
    instagramUrl: instagram, twitterUrl: twitter, linkedinUrl: linkedin,
    tiktokUrl: tiktok, facebookUrl: facebook, youtubeUrl: youtube,
    bioText, bioSkills, bioStat, bioPhotoUrl,
  };
  const serialized = JSON.stringify(values);
  const [lastSaved, setLastSaved] = useState(serialized);
  const dirty = serialized !== lastSaved;
  const uploading = uploadingDesktopBanner || uploadingMobileBanner || uploadingPhoto;
  const tabs = [
    { id: 'basics' as const, label: 'Basics', icon: UserRound },
    { id: 'banner' as const, label: 'Banner', icon: ImagePlus },
    { id: 'about' as const, label: 'About you', icon: UserRound },
    { id: 'contact' as const, label: 'Contact', icon: Mail },
  ];
  const save = async () => {
    if (saving || uploading || !dirty) return;
    if (!name.trim()) { setActiveTab('basics'); setSaveError('Add your name or brand name before saving.'); return; }
    setSaving(true); setSaved(false); setSaveError(null);
    try {
      const response = await fetch('/api/portfolio', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: serialized,
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'We couldn’t save your changes. Please try again.');
      }
      setLastSaved(serialized); setSaved(true); router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'We couldn’t save your changes. Please try again.');
    } finally { setSaving(false); }
  };

  return <div className={styles.editor}>
    <div className={styles.tabs} role="tablist" aria-label="Portfolio identity sections">
      {tabs.map(({ id, label, icon: Icon }, index) => <button key={id} id={`identity-tab-${id}`} type="button" role="tab" aria-selected={activeTab === id} aria-controls={`identity-panel-${id}`} tabIndex={activeTab === id ? 0 : -1} disabled={saving} onClick={() => setActiveTab(id)} onKeyDown={event => {
        const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : offset ? (index + offset + tabs.length) % tabs.length : null;
        if (next !== null) { event.preventDefault(); setActiveTab(tabs[next].id); document.getElementById(`identity-tab-${tabs[next].id}`)?.focus(); }
      }}><Icon size={16} /><span>{label}</span></button>)}
    </div>
    <div className={styles.layout}>
      <div className={styles.formArea}>
        <fieldset disabled={saving} className={styles.fieldset}>
          <section id="identity-panel-basics" role="tabpanel" aria-labelledby="identity-tab-basics" hidden={activeTab !== 'basics'}>
            <div className={styles.sectionHeading}><span className={styles.kicker}>YOUR FIRST IMPRESSION</span><h3>Start with the essentials.</h3><p>Help visitors recognise you and understand what you do.</p></div>
            <IdentityField label="Your name or brand" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Alex Morgan Studio" autoComplete="organization" />
            <IdentityField label="What do you do?" value={tagline} onChange={e => setTagline(e.target.value)} placeholder="e.g. Photographer & visual storyteller" hint="A short line that appears at the top of your portfolio." />
            <IdentityField label="Contact button text" value={cta} onChange={e => setCta(e.target.value)} placeholder="Let’s work together" hint="The invitation visitors see when they’re ready to reach out." />
            <button type="button" className={styles.next} onClick={() => setActiveTab('banner')}>Next: choose your banner <ArrowRight size={15} /></button>
          </section>
          <section id="identity-panel-banner" role="tabpanel" aria-labelledby="identity-tab-banner" hidden={activeTab !== 'banner'}>
            <div className={styles.sectionHeading}><span className={styles.kicker}>SET THE SCENE</span><h3>Give your work a strong opening.</h3><p>Add a wide banner for desktop and a portrait version for phones.</p></div>
            <div className={styles.bannerGrid}>
              <BannerPicker label="Desktop banner" hint="Landscape · 1920 × 1080 recommended" url={bannerDesktopUrl} mediaType={bannerDesktopType} uploading={uploadingDesktopBanner} progress={desktopBannerProgress} onFile={file => void uploadBanner(file, setBannerDesktopUrl, setBannerDesktopType, setUploadingDesktopBanner, setDesktopBannerProgress, 1920)} />
              <BannerPicker label="Mobile banner" hint="Portrait · 1080 × 1350 recommended" url={bannerMobileUrl} mediaType={bannerMobileType} uploading={uploadingMobileBanner} progress={mobileBannerProgress} onFile={file => void uploadBanner(file, setBannerMobileUrl, setBannerMobileType, setUploadingMobileBanner, setMobileBannerProgress, 1350)} />
            </div>
            {bannerCandidates.length > 0 && <details className={styles.gallery}><summary>Choose from your uploaded work</summary><p>Used when a dedicated banner hasn’t been added.</p><div className={styles.galleryGrid}>{bannerCandidates.map(candidate => <button key={candidate.id} type="button" aria-label={`Use portfolio ${candidate.type === 'VIDEO' ? 'video' : 'photo'} ${bannerCandidates.indexOf(candidate) + 1} as banner`} aria-pressed={selectedHero === candidate.id} onClick={() => setSelectedHero(candidate.id)}>
              {candidate.type === 'VIDEO' ? <video src={candidate.url} muted preload="metadata" /> : <img src={candidate.url} alt="" loading="lazy" />}
              {selectedHero === candidate.id && <span><Check size={14} /></span>}
            </button>)}</div></details>}
            <button type="button" className={styles.next} onClick={() => setActiveTab('about')}>Next: introduce yourself <ArrowRight size={15} /></button>
          </section>
          <section id="identity-panel-about" role="tabpanel" aria-labelledby="identity-tab-about" hidden={activeTab !== 'about'}>
            <div className={styles.sectionHeading}><span className={styles.kicker}>THE PERSON BEHIND THE WORK</span><h3>Tell your story.</h3><p>A short introduction helps people connect with you.</p></div>
            <div className={styles.photoRow}>
              {bioPhotoUrl ? <img src={bioPhotoUrl} alt="Your profile photo" /> : <span className={styles.photoPlaceholder}><UserRound size={26} /></span>}
              <div><strong>Profile photo</strong><label className={styles.uploadButton}>{uploadingPhoto ? <Loader2 size={14} className={styles.spinner} /> : <Upload size={14} />}{uploadingPhoto ? `Uploading ${photoProgress}%` : bioPhotoUrl ? 'Change photo' : 'Upload photo'}<input type="file" accept={IMAGE_FILE_ACCEPT} disabled={uploadingPhoto} onChange={e => { const file = e.target.files?.[0]; e.currentTarget.value = ''; if (file) void uploadBioPhoto(file); }} /></label></div>
            </div>
            <label className={styles.field}><span>About you</span><textarea value={bioText} onChange={e => setBioText(e.target.value)} rows={5} placeholder="Who you are, what you create, and what makes your approach different." /></label>
            <div className={styles.field}><label htmlFor="identity-skills">Skills & specialties</label><div className={styles.skills}>{bioSkills.map(skill => <span key={skill}>{skill}<button type="button" aria-label={`Remove ${skill}`} onClick={() => removeSkill(skill)}><X size={12} /></button></span>)}</div><div className={styles.skillInput}><input id="identity-skills" value={skillDraft} onChange={e => setSkillDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }} placeholder="e.g. Cinematography" /><button type="button" aria-label="Add skill" disabled={!skillDraft.trim()} onClick={addSkill}><Plus size={17} /></button></div><small>Press Enter or + to add a skill.</small></div>
            <IdentityField label="A highlight" value={bioStat} onChange={e => setBioStat(e.target.value)} placeholder="e.g. 50+ projects delivered" hint="Optional. Share a milestone you’re proud of." />
            <button type="button" className={styles.next} onClick={() => setActiveTab('contact')}>Next: add contact details <ArrowRight size={15} /></button>
          </section>
          <section id="identity-panel-contact" role="tabpanel" aria-labelledby="identity-tab-contact" hidden={activeTab !== 'contact'}>
            <div className={styles.sectionHeading}><span className={styles.kicker}>MAKE IT EASY TO REACH YOU</span><h3>Turn a visit into a conversation.</h3><p>Choose how potential clients can get in touch.</p></div>
            <IdentityField label="Contact email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="hello@yourstudio.com" autoComplete="email" />
            <IdentityField label="WhatsApp number" type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+234 800 000 0000" hint="Include your country code." autoComplete="tel" />
            <div className={styles.socialHeading}><h4>Social profiles</h4><span>Optional</span></div>
            <div className={styles.socialGrid}>{[
              {label:'Instagram', value:instagram, set:setInstagram, placeholder:'https://instagram.com/yourname'},
              {label:'X / Twitter', value:twitter, set:setTwitter, placeholder:'https://x.com/yourname'},
              {label:'LinkedIn', value:linkedin, set:setLinkedin, placeholder:'https://linkedin.com/in/yourname'},
              {label:'TikTok', value:tiktok, set:setTiktok, placeholder:'https://tiktok.com/@yourname'},
              {label:'Facebook', value:facebook, set:setFacebook, placeholder:'https://facebook.com/yourname'},
              {label:'YouTube', value:youtube, set:setYoutube, placeholder:'https://youtube.com/@yourname'},
            ].map(social => <IdentityField key={social.label} label={social.label} value={social.value} onChange={e => social.set(e.target.value)} placeholder={social.placeholder} inputMode="url" />)}</div>
          </section>
        </fieldset>
      </div>
      <aside className={styles.preview} aria-label="Draft identity preview">
        <div className={styles.previewHeading}><span>YOUR FIRST IMPRESSION</span><small>Draft preview</small></div>
        <div className={styles.previewCard}>
          <div className={styles.previewBanner}>{bannerDesktopUrl ? bannerDesktopType === 'VIDEO' ? <video src={bannerDesktopUrl} muted preload="metadata" /> : <img src={bannerDesktopUrl} alt="Desktop banner preview" /> : <div className={styles.bannerPlaceholder}><ImagePlus size={28} /><span>Your banner goes here</span></div>}</div>
          <div className={styles.previewCopy}>
            <div className={styles.previewAvatar}>{bioPhotoUrl ? <img src={bioPhotoUrl} alt="" /> : <span>{name.trim().slice(0,2).toUpperCase() || 'YOU'}</span>}</div>
            <h3>{name.trim() || 'Your name or brand'}</h3><p>{tagline || 'Your creative specialty, in a few words.'}</p>
            {bioText && <p className={styles.previewBio}>{bioText}</p>}
            {!!bioSkills.length && <div className={styles.previewSkills}>{bioSkills.slice(0,3).map(skill => <span key={skill}>{skill}</span>)}</div>}
            <span className={styles.previewCta}>{cta.trim() || 'Let’s work together'} <ArrowRight size={13} /></span>
          </div>
        </div>
        <p className={styles.previewNote}>A quick look at your details. Save your changes, then open your live portfolio to see the full design.</p>
      </aside>
    </div>
    <div className={styles.saveBar}>
      <div role={saveError || uploadError ? 'alert' : 'status'} className={saveError || uploadError ? styles.error : styles.saveStatus}>{saveError || uploadError || (uploading ? 'Upload in progress. Keep this page open.' : saving ? 'Saving your changes…' : dirty ? 'You have unsaved changes' : saved ? <><CheckCircle2 size={16} /> Your changes are saved</> : 'Your portfolio is up to date')}</div>
      <button type="button" disabled={saving || uploading || !dirty} onClick={() => void save()} className={styles.saveButton}>{saving ? <Loader2 size={16} className={styles.spinner} /> : <Save size={16} />}{saving ? 'Saving…' : 'Save changes'}</button>
    </div>
  </div>;
}

function IdentityField({ label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return <label className={styles.field}><span>{label}</span><input {...props} />{hint && <small>{hint}</small>}</label>;
}
function BannerPicker({ label, hint, url, mediaType, uploading, progress, onFile }: {label:string;hint:string;url:string;mediaType:string;uploading:boolean;progress:number;onFile:(file:File)=>void}) {
  return <div className={styles.bannerPicker}>
    <div className={styles.bannerTitle}>{label === 'Desktop banner' ? <Monitor size={16} /> : <Smartphone size={16} />}<h4>{label}</h4></div>
    <p>{hint}</p>
    <div className={styles.bannerFrame} data-portrait={label === 'Mobile banner'}>{url ? mediaType === 'VIDEO' ? <video src={url} muted controls preload="metadata" /> : <img src={url} alt={`${label} preview`} /> : <span><ImagePlus size={25} /><small>Image or video</small></span>}</div>
    <label className={styles.uploadButton}><Upload size={14} />{uploading ? `Uploading ${progress}%` : url ? 'Change banner' : 'Upload banner'}<input type="file" accept={MEDIA_FILE_ACCEPT} disabled={uploading} onChange={event => {const file=event.target.files?.[0];event.currentTarget.value='';if(file)onFile(file);}} /></label>
    {uploading && <progress aria-label={`${label} upload progress`} value={progress} max={100} />}
  </div>;
}
