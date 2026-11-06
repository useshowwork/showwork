"use client";
import ShowworkLogo from "@/components/brand/ShowworkLogo";

import { IMAGE_FILE_ACCEPT, VIDEO_FILE_ACCEPT, getFileContentType } from "@/lib/mediaFileTypes";

import UiSymbol from "@/components/ui/UiSymbol";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { putFileWithProgress } from "@/lib/uploadClient";
import Link from "next/link";
import { Plus_Jakarta_Sans } from "next/font/google";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
});

/* -------------------------------------------------------------------------- */
/* Brand                                                                      */
/* -------------------------------------------------------------------------- */

const COLOR = {
  black: "#0A0A0A",
  yellow: "#F5C842",
  yellowSoft: "#FFF7D6",
  paper: "#F7F7F5",
  line: "#E7E7E3",
  muted: "#73736E",
  green: "#1E9E5A",
  red: "#D83A3A",
};

const CODE_WORDS = [
  "sunrise",
  "harbor",
  "velvet",
  "cobalt",
  "willow",
  "ember",
  "quartz",
  "meadow",
  "cipher",
  "lantern",
  "orbit",
  "maple",
];

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type MediaType = "PHOTO" | "VIDEO" | "DOCUMENT" | "PDF";

type FileStatus = "pending" | "uploading" | "done" | "error";

type BuilderStep = "closed" | "type" | "details";

type Phase = "form" | "auth" | "verify" | "uploading" | "done";

interface QueuedFile {
  file: File;
  localId: string;
}

interface PendingSection {
  sectionLocalId: string;
  name: string;
  mediaType: MediaType;
  files: QueuedFile[];
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function suggestCode() {
  const word = CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)];
  const number = Math.floor(10 + Math.random() * 90);
  return `${word}${number}`;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  return `${(bytes / Math.pow(1024, index)).toFixed(
    index === 0 ? 0 : 1
  )} ${units[index]}`;
}

function mediaLabel(type: MediaType) {
  switch (type) {
    case "PHOTO":
      return "Images";
    case "VIDEO":
      return "Videos";
    case "PDF":
      return "PDFs";
    case "DOCUMENT":
      return "Documents";
  }
}

function mediaDescription(type: MediaType) {
  switch (type) {
    case "PHOTO":
      return "Photos, renders, mockups";
    case "VIDEO":
      return "Films, walkthroughs, reels";
    case "PDF":
      return "Proposals, decks, contracts";
    case "DOCUMENT":
      return "Guides and Word documents";
  }
}

function mediaAccept(type: MediaType) {
  switch (type) {
    case "PHOTO":
      return IMAGE_FILE_ACCEPT;
    case "VIDEO":
      return VIDEO_FILE_ACCEPT;
    case "PDF":
      return "application/pdf";
    case "DOCUMENT":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
}

function iconFor(type: MediaType) {
  switch (type) {
    case "PHOTO":
      return <ImageIcon />;
    case "VIDEO":
      return <VideoIcon />;
    case "PDF":
      return <PdfIcon />;
    case "DOCUMENT":
      return <DocumentIcon />;
  }
}

function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (loaded: number, total: number) => void
): Promise<void> {
  return putFileWithProgress(url, file, {
    contentType: getFileContentType(file),
    onProgress: ({ loaded, total }) => onProgress(loaded, total),
  }).then(() => undefined);
}

/* -------------------------------------------------------------------------- */
/* Main page                                                                  */
/* -------------------------------------------------------------------------- */

export default function StartPage() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("form");

  const [clientName, setClientName] = useState("");
  const [password, setPassword] = useState("");
  const [tagline, setTagline] = useState("");
  const [heroLocalId, setHeroLocalId] = useState<string | null>(null);

  const [sections, setSections] = useState<PendingSection[]>([]);

  const [builderStep, setBuilderStep] =
    useState<BuilderStep>("closed");

  const [builderType, setBuilderType] =
    useState<MediaType | null>(null);

  const [builderName, setBuilderName] = useState("");
  const [builderFiles, setBuilderFiles] = useState<QueuedFile[]>([]);

  const builderFileInputRef = useRef<HTMLInputElement>(null);
  const addMoreFilesInputRef = useRef<HTMLInputElement>(null);

  const [addingToSectionId, setAddingToSectionId] =
    useState<string | null>(null);

  const [dragging, setDragging] = useState(false);

  /* Authentication */

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");

  const [authMode, setAuthMode] =
    useState<"signup" | "login">("signup");

  /* State */

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendStatus, setResendStatus] =
    useState<string | null>(null);

  const [statusMap, setStatusMap] =
    useState<Record<string, FileStatus>>({});

  const [loadedMap, setLoadedMap] =
    useState<Record<string, number>>({});

  /* ---------------------------------------------------------------------- */
  /* Preview URLs                                                           */
  /* ---------------------------------------------------------------------- */

  const allFilesForPreview = sections.flatMap(
    (section) => section.files
  );

  const previewKey = allFilesForPreview
    .map((file) => file.localId)
    .join("|");

  const [previewUrls, setPreviewUrls] =
    useState<Record<string, string>>({});

  useEffect(() => {
    const urls: Record<string, string> = {};

    for (const queuedFile of allFilesForPreview) {
      urls[queuedFile.localId] = URL.createObjectURL(
        queuedFile.file
      );
    }

    setPreviewUrls(urls);

    return () => {
      Object.values(urls).forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };

    // previewKey intentionally controls regeneration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey]);

  /* ---------------------------------------------------------------------- */
  /* Derived state                                                          */
  /* ---------------------------------------------------------------------- */

  const allFiles = sections.flatMap(
    (section) => section.files
  );

  const totalBytes = allFiles.reduce(
    (total, queuedFile) => total + queuedFile.file.size,
    0
  );

  const loadedBytes = allFiles.reduce(
    (total, queuedFile) =>
      total + (loadedMap[queuedFile.localId] ?? 0),
    0
  );

  const overallPercent =
    totalBytes > 0
      ? Math.min(
          100,
          Math.round((loadedBytes / totalBytes) * 100)
        )
      : 0;

  const doneCount = allFiles.filter(
    (file) => statusMap[file.localId] === "done"
  ).length;

  const imageSections = sections.filter(
    (section) =>
      section.mediaType === "PHOTO" ||
      section.mediaType === "VIDEO"
  );

  const bannerFiles = imageSections.flatMap(
    (section) => section.files
  );

  const videoBannerExists = sections.some(
    (section) =>
      section.mediaType === "VIDEO" &&
      section.files.length > 0
  );

  /* ---------------------------------------------------------------------- */
  /* Builder                                                                */
  /* ---------------------------------------------------------------------- */

  const startBuilder = () => {
    setError(null);
    setBuilderStep("type");
    setBuilderType(null);
    setBuilderName("");
    setBuilderFiles([]);
  };

  const cancelBuilder = () => {
    setBuilderStep("closed");
    setBuilderType(null);
    setBuilderName("");
    setBuilderFiles([]);
    setError(null);

    if (builderFileInputRef.current) {
      builderFileInputRef.current.value = "";
    }
  };

  const chooseBuilderType = (type: MediaType) => {
    setError(null);
    setBuilderType(type);
    setBuilderStep("details");
  };

  const createQueuedFiles = (files: File[]) =>
    files.map((file) => ({
      file,
      localId: `${file.name}-${file.size}-${file.lastModified}-${Math.random()
        .toString(36)
        .slice(2)}`,
    }));

  const handleBuilderFileSelect = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    if (!event.target.files) return;

    const selected = createQueuedFiles(
      Array.from(event.target.files)
    );

    setBuilderFiles(selected);
  };

  const handleBuilderDrop = (
    event: DragEvent<HTMLLabelElement>
  ) => {
    event.preventDefault();
    setDragging(false);

    if (!builderType) return;

    const files = Array.from(event.dataTransfer.files);

    const allowed = files.filter((file) => {
      if (builderType === "PHOTO") {
        return getFileContentType(file).startsWith("image/");
      }

      if (builderType === "VIDEO") {
        return getFileContentType(file).startsWith("video/");
      }

      if (builderType === "PDF") {
        return getFileContentType(file) === "application/pdf";
      }

      return (
        getFileContentType(file) ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
    });

    setBuilderFiles(createQueuedFiles(allowed));
  };

  const confirmSection = () => {
    if (!builderType) return;

    if (!builderName.trim()) {
      setError("Give this collection a name.");
      return;
    }

    if (builderFiles.length === 0) {
      setError("Choose at least one file.");
      return;
    }

    const newSection: PendingSection = {
      sectionLocalId: `section-${Math.random()
        .toString(36)
        .slice(2)}`,
      name: builderName.trim(),
      mediaType: builderType,
      files: builderFiles,
    };

    setSections((current) => {
      const next = [...current, newSection];

      if (!heroLocalId) {
        setHeroLocalId(
          newSection.files[0]?.localId ?? null
        );
      }

      return next;
    });

    setBuilderStep("closed");
    setBuilderType(null);
    setBuilderName("");
    setBuilderFiles([]);
    setError(null);

    if (builderFileInputRef.current) {
      builderFileInputRef.current.value = "";
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Section manipulation                                                   */
  /* ---------------------------------------------------------------------- */

  const removeSection = (sectionLocalId: string) => {
    setSections((current) => {
      const removed = current.find(
        (section) =>
          section.sectionLocalId === sectionLocalId
      );

      const next = current.filter(
        (section) =>
          section.sectionLocalId !== sectionLocalId
      );

      if (
        removed?.files.some(
          (file) => file.localId === heroLocalId
        )
      ) {
        setHeroLocalId(
          next.flatMap((section) => section.files)[0]
            ?.localId ?? null
        );
      }

      return next;
    });
  };

  const triggerAddMoreFiles = (
    sectionLocalId: string
  ) => {
    setAddingToSectionId(sectionLocalId);

    window.setTimeout(() => {
      addMoreFilesInputRef.current?.click();
    }, 0);
  };

  const handleAddMoreFiles = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    if (!addingToSectionId || !event.target.files) {
      return;
    }

    const section = sections.find(
      (item) =>
        item.sectionLocalId === addingToSectionId
    );

    if (!section) return;

    const newFiles = createQueuedFiles(
      Array.from(event.target.files)
    );

    setSections((current) =>
      current.map((item) =>
        item.sectionLocalId === addingToSectionId
          ? {
              ...item,
              files: [...item.files, ...newFiles],
            }
          : item
      )
    );

    setAddingToSectionId(null);

    if (addMoreFilesInputRef.current) {
      addMoreFilesInputRef.current.value = "";
    }
  };

  const removeFileFromSection = (
    sectionLocalId: string,
    fileLocalId: string
  ) => {
    setSections((current) => {
      const next = current
        .map((section) =>
          section.sectionLocalId === sectionLocalId
            ? {
                ...section,
                files: section.files.filter(
                  (file) => file.localId !== fileLocalId
                ),
              }
            : section
        )
        .filter((section) => section.files.length > 0);

      if (heroLocalId === fileLocalId) {
        setHeroLocalId(
          next.flatMap((section) => section.files)[0]
            ?.localId ?? null
        );
      }

      return next;
    });
  };

  /* ---------------------------------------------------------------------- */
  /* Project creation                                                       */
  /* ---------------------------------------------------------------------- */

  const attemptCreateProject = async (): Promise<{
    id: string;
  } | null> => {
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clientName,
        password,
      }),
    });

    if (response.status === 401) {
      return null;
    }

    if (!response.ok) {
      const data = await response.json();
      throw new Error(
        data.error ?? "We couldn't create your project."
      );
    }

    const data = await response.json();

    return data.project;
  };

  /* ---------------------------------------------------------------------- */
  /* Upload                                                                  */
  /* ---------------------------------------------------------------------- */

  const runUpload = async (project: { id: string }) => {
    setPhase("uploading");

    setStatusMap(
      Object.fromEntries(
        allFiles.map((file) => [
          file.localId,
          "pending" as FileStatus,
        ])
      )
    );

    setLoadedMap({});

    let heroMediaId: string | null = null;

    for (const section of sections) {
      const sectionResponse = await fetch(
        `/api/projects/${project.id}/sections`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: section.name,
            mediaType: section.mediaType,
          }),
        }
      );

      if (!sectionResponse.ok) {
        const data = await sectionResponse.json();

        throw new Error(
          data.error ?? "We couldn't create this collection."
        );
      }

      const { section: createdSection } =
        await sectionResponse.json();

      for (const { file, localId } of section.files) {
        setStatusMap((current) => ({
          ...current,
          [localId]: "uploading",
        }));

        try {
          const presignResponse = await fetch(
            "/api/upload/presign",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                projectId: project.id,
                filename: file.name,
                contentType: getFileContentType(file),
                fileSizeMb:
                  file.size / (1024 * 1024),
              }),
            }
          );

          if (!presignResponse.ok) {
            const data =
              await presignResponse.json();

            throw new Error(
              data.error ??
                "We couldn't prepare this upload."
            );
          }

          const {
            uploadUrl,
            fileKey,
          } = await presignResponse.json();

          await uploadWithProgress(
            uploadUrl,
            file,
            (loaded) => {
              setLoadedMap((current) => ({
                ...current,
                [localId]: loaded,
              }));
            }
          );

          const completeResponse = await fetch(
            "/api/upload/complete",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                projectId: project.id,
                fileKey,
                type: section.mediaType,
                sectionId: createdSection.id,
              }),
            }
          );

          if (!completeResponse.ok) {
            throw new Error(
              "We couldn't save this file."
            );
          }

          const { media } =
            await completeResponse.json();

          if (localId === heroLocalId) {
            heroMediaId = media.id;
          }

          setStatusMap((current) => ({
            ...current,
            [localId]: "done",
          }));

          setLoadedMap((current) => ({
            ...current,
            [localId]: file.size,
          }));
        } catch (uploadError) {
          setStatusMap((current) => ({
            ...current,
            [localId]: "error",
          }));

          throw uploadError;
        }
      }
    }

    if (heroMediaId || tagline) {
      await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(heroMediaId
            ? { heroMediaId }
            : {}),
          ...(tagline
            ? { heroTagline: tagline }
            : {}),
        }),
      });
    }

    setPhase("done");

    window.setTimeout(() => {
      router.push(`/dashboard/${project.id}`);
    }, 800);
  };

  /* ---------------------------------------------------------------------- */
  /* Main form                                                              */
  /* ---------------------------------------------------------------------- */

  const handleFormSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setError(null);

    if (!clientName.trim()) {
      setError("Tell us who this delivery is for.");
      return;
    }

    if (!password.trim()) {
      setError("Add an access code for your client.");
      return;
    }

    setLoading(true);

    try {
      const project = await attemptCreateProject();

      if (project) {
        await runUpload(project);
      } else {
        setPhase("auth");
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Authentication                                                         */
  /* ---------------------------------------------------------------------- */

  const handleAuthSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (authMode === "login") {
        const response = await fetch(
          "/api/auth/login",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email,
              password: authPassword,
            }),
          }
        );

        if (!response.ok) {
          const data = await response.json();

          throw new Error(
            data.error ?? "Invalid email or password."
          );
        }

        const project =
          await attemptCreateProject();

        if (!project) {
          throw new Error(
            "We couldn't finish signing you in."
          );
        }

        await runUpload(project);
      } else {
        const response = await fetch(
          "/api/auth/signup",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email,
              password: authPassword,
              name,
              phone,
            }),
          }
        );

        if (!response.ok) {
          const data = await response.json();

          throw new Error(
            data.error ??
              "We couldn't create your account."
          );
        }

        setPhase("verify");
      }
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(
        "/api/auth/verify-otp",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            code: otpCode,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();

        throw new Error(
          data.error ?? "That code isn't valid."
        );
      }

      const project =
        await attemptCreateProject();

      if (!project) {
        throw new Error(
          "We couldn't finish setting up your project."
        );
      }

      await runUpload(project);
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : "Invalid verification code."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendStatus("Sending...");

    try {
      const response = await fetch(
        "/api/auth/signup",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password: authPassword,
            name,
            phone,
          }),
        }
      );

      setResendStatus(
        response.ok
          ? "New code sent"
          : "Couldn't resend"
      );
    } catch {
      setResendStatus("Couldn't resend");
    }

    window.setTimeout(() => {
      setResendStatus(null);
    }, 3000);
  };

  /* ---------------------------------------------------------------------- */
  /* Upload screen                                                          */
  /* ---------------------------------------------------------------------- */

  if (phase === "uploading" || phase === "done") {
    return (
      <main
        className={`${jakarta.variable} min-h-screen bg-[#0A0A0A] text-white`}
        style={{
          fontFamily: "var(--font-jakarta)",
        }}
      >
        <div className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-5 py-12 sm:px-8">
          <div className="w-full">
            <div className="mb-10 flex items-center justify-between">
              <Logo dark />

              <div className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-white/50">
                Project delivery
              </div>
            </div>

            <div className="mx-auto max-w-2xl">
              <div className="mb-10">
                <div className="mb-4 flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      background:
                        phase === "done"
                          ? COLOR.green
                          : COLOR.yellow,
                    }}
                  />
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/45">
                    {phase === "done"
                      ? "Ready"
                      : "Uploading"}
                  </span>
                </div>

                <h1 className="text-3xl font-extrabold tracking-[-0.04em] sm:text-5xl">
                  {phase === "done"
                    ? "Your delivery is ready."
                    : "We’re preparing your delivery."}
                </h1>

                <p className="mt-4 max-w-xl text-sm leading-7 text-white/50 sm:text-base">
                  {phase === "done"
                    ? "Everything has been uploaded. Taking you to your new Showwork workspace."
                    : `${doneCount} of ${allFiles.length} files are safely uploaded.`}
                </p>
              </div>

              <div className="mb-8 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full transition-[width] duration-300"
                  style={{
                    width:
                      phase === "done"
                        ? "100%"
                        : `${overallPercent}%`,
                    background:
                      phase === "done"
                        ? COLOR.green
                        : COLOR.yellow,
                  }}
                />
              </div>

              <div className="mb-8 flex items-center justify-between text-xs text-white/40">
                <span>
                  {phase === "done"
                    ? "Complete"
                    : "Upload progress"}
                </span>
                <span>
                  {phase === "done"
                    ? "100%"
                    : `${overallPercent}%`}
                </span>
              </div>

              <div className="space-y-3">
                {sections.map((section) => (
                  <div
                    key={section.sectionLocalId}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-white/70">
                          {iconFor(section.mediaType)}
                        </span>

                        <span className="text-sm font-semibold">
                          {section.name}
                        </span>
                      </div>

                      <span className="text-xs text-white/35">
                        {section.files.length}{" "}
                        {section.files.length === 1
                          ? "file"
                          : "files"}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {section.files.map((queuedFile) => {
                        const status =
                          statusMap[
                            queuedFile.localId
                          ] ?? "pending";

                        const loaded =
                          loadedMap[
                            queuedFile.localId
                          ] ?? 0;

                        const percent =
                          queuedFile.file.size > 0
                            ? Math.round(
                                (loaded /
                                  queuedFile.file.size) *
                                  100
                              )
                            : 0;

                        return (
                          <div
                            key={queuedFile.localId}
                            className="rounded-xl bg-white/[0.04] p-3"
                          >
                            <div className="mb-2 flex items-center justify-between gap-4">
                              <span className="min-w-0 truncate text-xs text-white/60">
                                {queuedFile.file.name}
                              </span>

                              <span className="shrink-0 text-xs font-semibold">
                                {status === "done" ||
                                phase === "done" ? (
                                  <span
                                    style={{
                                      color: COLOR.green,
                                    }}
                                  ><>{" "}<UiSymbol name="check" />{" Done "}</></span>
                                ) : status ===
                                  "error" ? (
                                  <span className="text-red-400">
                                    Failed
                                  </span>
                                ) : (
                                  <span className="text-white/40">
                                    {percent}%
                                  </span>
                                )}
                              </span>
                            </div>

                            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full transition-[width] duration-200"
                                style={{
                                  width:
                                    status === "done" ||
                                    phase === "done"
                                      ? "100%"
                                      : `${percent}%`,
                                  background:
                                    status === "error"
                                      ? COLOR.red
                                      : status ===
                                          "done" ||
                                        phase === "done"
                                      ? COLOR.green
                                      : COLOR.yellow,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {error && (
                <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Auth screens                                                           */
  /* ---------------------------------------------------------------------- */

  if (phase === "auth" || phase === "verify") {
    return (
      <main
        className={`${jakarta.variable} min-h-screen bg-[#F7F7F5] text-[#0A0A0A]`}
        style={{
          fontFamily: "var(--font-jakarta)",
        }}
      >
        <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8">
          <header className="flex items-center justify-between">
            <Link href="/" aria-label="Showwork home">
              <Logo />
            </Link>

            <button
              type="button"
              onClick={() => setPhase("form")}
              className="text-sm font-semibold text-black/45 transition-colors hover:text-black"
            >
              Back to project
            </button>
          </header>

          <div className="flex flex-1 items-center justify-center py-12">
            <div className="w-full max-w-md">
              {phase === "auth" ? (
                <>
                  <div className="mb-8">
                    <StepBadge number="03" label="Your account" />

                    <h1 className="mt-5 text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">
                      Save your workspace.
                    </h1>

                    <p className="mt-3 text-sm leading-6 text-black/50">
                      Your project is ready. Create a Showwork
                      account so your delivery is saved and
                      accessible whenever you need it.
                    </p>
                  </div>

                  <form
                    onSubmit={handleAuthSubmit}
                    className="rounded-3xl border border-[#E4E4E0] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)] sm:p-8"
                  >
                    {authMode === "signup" && (
                      <Field
                        label="Your name"
                        value={name}
                        onChange={setName}
                        placeholder="Ada Obi"
                      />
                    )}

                    <Field
                      label="Email address"
                      type="email"
                      value={email}
                      onChange={setEmail}
                      placeholder="you@studio.com"
                      required
                    />

                    {authMode === "signup" && (
                      <>
                        <Field
                          label="Phone number"
                          type="tel"
                          value={phone}
                          onChange={setPhone}
                          placeholder="+2348012345678"
                          required
                        />

                        <p className="-mt-2 mb-4 text-xs text-black/35">
                          Use +234 followed by 10 digits.
                        </p>
                      </>
                    )}

                    <Field
                      label="Password"
                      type="password"
                      value={authPassword}
                      onChange={setAuthPassword}
                      placeholder={
                        authMode === "signup"
                          ? "Minimum 8 characters"
                          : "Your password"
                      }
                      required
                      minLength={
                        authMode === "signup"
                          ? 8
                          : undefined
                      }
                    />

                    {error && (
                      <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0A0A0A] px-5 py-4 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loading
                        ? "Please wait..."
                        : authMode === "signup"
                        ? "Create account & continue"
                        : "Log in & continue"}

                      {!loading && (
                        <ArrowRightIcon />
                      )}
                    </button>

                    <div className="mt-6 text-center text-xs text-black/40">
                      {authMode === "signup" ? (
                        <>
                          Already have an account?{" "}
                          <button
                            type="button"
                            onClick={() => {
                              setAuthMode("login");
                              setError(null);
                            }}
                            className="font-bold text-black underline underline-offset-2"
                          >
                            Log in
                          </button>
                        </>
                      ) : (
                        <>
                          New to Showwork?{" "}
                          <button
                            type="button"
                            onClick={() => {
                              setAuthMode("signup");
                              setError(null);
                            }}
                            className="font-bold text-black underline underline-offset-2"
                          >
                            Create an account
                          </button>
                        </>
                      )}
                    </div>
                  </form>

                  <div className="mt-5 text-center text-xs text-black/35">
                    Your project details stay with you while you
                    complete this step.
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-8 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF7D6]">
                      <MailIcon />
                    </div>

                    <h1 className="mt-5 text-3xl font-extrabold tracking-[-0.04em]">
                      Check your email.
                    </h1>

                    <p className="mt-3 text-sm leading-6 text-black/50">
                      We sent a 6-digit verification code to{" "}
                      <span className="font-semibold text-black/75">
                        {email}
                      </span>
                      .
                    </p>
                  </div>

                  <form
                    onSubmit={handleVerifySubmit}
                    className="rounded-3xl border border-[#E4E4E0] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)] sm:p-8"
                  >
                    <label
                      htmlFor="otp"
                      className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-black/40"
                    >
                      Verification code
                    </label>

                    <input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      required
                      value={otpCode}
                      onChange={(event) =>
                        setOtpCode(
                          event.target.value.replace(
                            /\D/g,
                            ""
                          )
                        )
                      }
                      placeholder="000000"
                      className="w-full rounded-xl border border-black/10 bg-[#F7F7F5] px-4 py-4 text-center text-2xl font-bold tracking-[0.35em] outline-none transition-colors focus:border-black/30"
                    />

                    {error && (
                      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={
                        loading ||
                        otpCode.length !== 6
                      }
                      className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0A0A0A] px-5 py-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {loading
                        ? "Verifying..."
                        : "Verify & continue"}

                      {!loading && (
                        <ArrowRightIcon />
                      )}
                    </button>

                    <div className="mt-5 flex items-center justify-between text-xs text-black/40">
                      <button
                        type="button"
                        onClick={() => {
                          setPhase("auth");
                          setError(null);
                        }}
                        className="font-semibold underline underline-offset-2"
                      >
                        Change email
                      </button>

                      <button
                        type="button"
                        onClick={handleResend}
                        className="font-semibold underline underline-offset-2"
                      >
                        {resendStatus ??
                          "Resend code"}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Main builder                                                           */
  /* ---------------------------------------------------------------------- */

  return (
    <main
      className={`${jakarta.variable} min-h-screen bg-[#F7F7F5] text-[#0A0A0A]`}
      style={{
        fontFamily: "var(--font-jakarta)",
      }}
    >
      <header className="sticky top-0 z-40 border-b border-black/[0.07] bg-[#F7F7F5]/95">
        <div className="mx-auto flex h-[72px] max-w-[1400px] items-center justify-between px-5 sm:px-8 lg:px-10">
          <Link
            href="/"
            aria-label="Showwork home"
            className="shrink-0"
          >
            <Logo />
          </Link>

          <div className="hidden items-center gap-5 text-xs font-semibold text-black/40 sm:flex">
            <span className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0A0A0A] text-[10px] font-bold text-white">
                1
              </span>
              Project
            </span>

            <span className="h-px w-8 bg-black/10" />

            <span className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/10 text-[10px] font-bold">
                2
              </span>
              Deliverables
            </span>

            <span className="h-px w-8 bg-black/10" />

            <span className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/10 text-[10px] font-bold">
                3
              </span>
              Launch
            </span>
          </div>

          <Link
            href="/"
            className="text-xs font-bold text-black/40 transition-colors hover:text-black"
          >
            Exit
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-14">
        {/* Hero */}
        <section className="mb-10 grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <div className="mb-5 flex items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-black/55">
                <span className="h-1.5 w-1.5 rounded-full bg-[#F5C842]" />
                Project Delivery
              </span>

              <span className="text-xs font-medium text-black/30">
                Built for creative work
              </span>
            </div>

            <h1 className="max-w-4xl text-4xl font-extrabold leading-[0.98] tracking-[-0.055em] sm:text-5xl md:text-6xl lg:text-7xl">
              Deliver work your
              <br />
              clients will{" "}
              <span className="relative inline-block">
                remember.
                <span className="absolute bottom-[-5px] left-0 h-[5px] w-full rounded-full bg-[#F5C842]" />
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-sm leading-7 text-black/50 sm:text-base">
              Create a private project delivery page, organize your files
              and share them with your client through one Showwork link.
            </p>
          </div>

          <div className="hidden lg:block">
            <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-[0_15px_45px_rgba(0,0,0,0.05)]">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-black/35">
                  Your delivery
                </span>

                <span className="flex items-center gap-1.5 text-[10px] font-semibold text-[#1E9E5A]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#1E9E5A]" />
                  Private
                </span>
              </div>

              <div className="rounded-2xl bg-[#F7F7F5] p-4">
                <div className="mb-3 h-24 rounded-xl bg-[#0A0A0A] p-4">
                  <div className="flex h-full flex-col justify-end">
                    <div className="h-1.5 w-16 rounded bg-white/30" />
                    <div className="mt-2 h-2 w-32 rounded bg-white/90" />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">
                    {clientName ||
                      "Your client project"}
                  </span>

                  <span className="rounded-full bg-[#F5C842] px-2 py-1 text-[9px] font-bold">
                    SHOWWORK
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <form
          onSubmit={handleFormSubmit}
          className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_350px]"
        >
          {/* Main column */}
          <div className="space-y-6">
            {/* Project */}
            <section className="rounded-3xl border border-black/[0.08] bg-white p-6 shadow-[0_12px_40px_rgba(0,0,0,0.035)] sm:p-8">
              <SectionHeading
                number="01"
                eyebrow="The project"
                title="Start with the client."
                description="Give this delivery a name your client will recognise."
              />

              <div className="mt-7">
                <label
                  htmlFor="client-name"
                  className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-black/40"
                >
                  Client or project name
                </label>

                <input
                  id="client-name"
                  type="text"
                  required
                  value={clientName}
                  onChange={(event) =>
                    setClientName(event.target.value)
                  }
                  placeholder="e.g. Showwork"
                  className="w-full rounded-2xl border border-black/10 bg-[#F7F7F5] px-5 py-4 text-base font-semibold outline-none transition-colors placeholder:text-black/25 focus:border-black/30"
                />
              </div>
            </section>

            {/* Security */}
            <section className="rounded-3xl border border-black/[0.08] bg-white p-6 shadow-[0_12px_40px_rgba(0,0,0,0.035)] sm:p-8">
              <SectionHeading
                number="02"
                eyebrow="Private by default"
                title="Give your client the key."
                description="Every Showwork delivery can be protected with an access code. The link alone isn't enough to open it."
              />

              <div className="mt-7 rounded-2xl border border-[#F0D76A] bg-[#FFFBEA] p-5">
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F5C842]">
                    <LockIcon />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">
                      Client access code
                    </p>

                    <p className="mt-1 text-xs leading-5 text-black/45">
                      Create something simple enough to
                      share, but private enough to protect
                      the work.
                    </p>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        required
                        value={password}
                        onChange={(event) =>
                          setPassword(event.target.value)
                        }
                        placeholder="e.g. sunrise42"
                        className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-black/30"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setPassword(suggestCode())
                        }
                        className="rounded-xl border border-black/10 bg-white px-4 py-3 text-xs font-bold transition-colors hover:border-black/25 hover:bg-black/[0.02]"
                      >
                        Suggest a code
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Deliverables */}
            <section className="rounded-3xl border border-black/[0.08] bg-white p-6 shadow-[0_12px_40px_rgba(0,0,0,0.035)] sm:p-8">
              <SectionHeading
                number="03"
                eyebrow="Your work"
                title="Build the delivery."
                description="Group related work into collections so your client can move through it naturally."
              />

              <input
                ref={addMoreFilesInputRef}
                type="file"
                multiple
                accept={
                  sections.find(
                    (section) =>
                      section.sectionLocalId ===
                      addingToSectionId
                  )?.mediaType
                    ? mediaAccept(
                        sections.find(
                          (section) =>
                            section.sectionLocalId ===
                            addingToSectionId
                        )!.mediaType
                      )
                    : undefined
                }
                onChange={handleAddMoreFiles}
                className="hidden"
              />

              {sections.length > 0 && (
                <div className="mt-7 space-y-3">
                  {sections.map((section, index) => (
                    <div
                      key={section.sectionLocalId}
                      className="group rounded-2xl border border-black/[0.08] bg-[#F7F7F5] p-4 transition-colors hover:border-black/15"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                            {iconFor(section.mediaType)}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-bold">
                                {section.name}
                              </span>

                              {index === 0 && (
                                <span className="rounded-full bg-[#FFF1A8] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide">
                                  First
                                </span>
                              )}
                            </div>

                            <p className="mt-0.5 text-xs text-black/35">
                              {mediaLabel(
                                section.mediaType
                              )}{" "}
                              · {section.files.length}{" "}
                              {section.files.length === 1
                                ? "file"
                                : "files"}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              triggerAddMoreFiles(
                                section.sectionLocalId
                              )
                            }
                            className="text-xs font-bold text-black/45 transition-colors hover:text-black"
                          >
                            + Add files
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              removeSection(
                                section.sectionLocalId
                              )
                            }
                            className="text-xs font-semibold text-black/25 transition-colors hover:text-red-500"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
                        {section.files.map((queuedFile) => {
                          const previewUrl =
                            previewUrls[
                              queuedFile.localId
                            ];

                          return (
                            <div
                              key={queuedFile.localId}
                              className="group/file relative aspect-square overflow-hidden rounded-xl border border-black/5 bg-white"
                            >
                              {previewUrl &&
                              section.mediaType ===
                                "VIDEO" ? (
                                <video
                                  src={previewUrl}
                                  muted
                                  playsInline
                                  className="h-full w-full object-cover"
                                />
                              ) : previewUrl &&
                                section.mediaType ===
                                  "PHOTO" ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={previewUrl}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full flex-col items-center justify-center gap-2 p-2 text-center">
                                  {iconFor(
                                    section.mediaType
                                  )}

                                  <span className="max-w-full truncate px-1 text-[9px] font-semibold text-black/45">
                                    {queuedFile.file.name}
                                  </span>
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={() =>
                                  removeFileFromSection(
                                    section.sectionLocalId,
                                    queuedFile.localId
                                  )
                                }
                                aria-label={`Remove ${queuedFile.file.name}`}
                                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/75 text-xs font-bold text-white opacity-0 transition-opacity group-hover/file:opacity-100"
                              >
                                ×
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {builderStep === "closed" && (
                <button
                  type="button"
                  onClick={startBuilder}
                  className={`mt-6 flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                    sections.length > 0
                      ? "border-black/10 bg-[#F7F7F5] hover:border-black/25 hover:bg-white"
                      : "border-[#E7C936] bg-[#FFFBEA] hover:bg-[#FFF8DC]"
                  }`}
                >
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-2xl"
                    style={{
                      background:
                        sections.length > 0
                          ? "#FFFFFF"
                          : COLOR.yellow,
                    }}
                  >
                    <PlusIcon />
                  </span>

                  <span className="mt-4 text-sm font-bold">
                    {sections.length > 0
                      ? "Add another collection"
                      : "Add your first collection"}
                  </span>

                  <span className="mt-1 max-w-md text-xs leading-5 text-black/40">
                    {sections.length > 0
                      ? "Add another set of files to keep the delivery organised."
                      : 'For example: "Brand Identity", "Campaign Assets", "Room Renders" or "Final Film".'}
                  </span>
                </button>
              )}

              {builderStep === "type" && (
                <div className="mt-6 rounded-2xl border border-black/10 bg-[#F7F7F5] p-5">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold">
                        What are you delivering?
                      </p>
                      <p className="mt-1 text-xs text-black/40">
                        Choose the type of work you want to add.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={cancelBuilder}
                      className="text-xs font-semibold text-black/35 hover:text-black"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {(
                      [
                        "PHOTO",
                        "VIDEO",
                        "DOCUMENT",
                        "PDF",
                      ] as MediaType[]
                    ).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() =>
                          chooseBuilderType(type)
                        }
                        className="group rounded-2xl border border-black/10 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-black/25 hover:shadow-[0_8px_25px_rgba(0,0,0,0.05)]"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F7F7F5] transition-colors group-hover:bg-[#FFF7D6]">
                          {iconFor(type)}
                        </div>

                        <p className="mt-4 text-sm font-bold">
                          {mediaLabel(type)}
                        </p>

                        <p className="mt-1 text-[11px] leading-4 text-black/35">
                          {mediaDescription(type)}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {builderStep === "details" &&
                builderType && (
                  <div className="mt-6 rounded-2xl border border-black/10 bg-[#F7F7F5] p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F5C842]">
                          {iconFor(builderType)}
                        </div>

                        <div>
                          <p className="text-sm font-bold">
                            {mediaLabel(
                              builderType
                            )}
                          </p>

                          <p className="mt-1 text-xs text-black/40">
                            Name this collection and add
                            the files.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={cancelBuilder}
                        className="text-xs font-semibold text-black/35 hover:text-black"
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="mt-5">
                      <label
                        htmlFor="collection-name"
                        className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-black/40"
                      >
                        Collection name
                      </label>

                      <input
                        id="collection-name"
                        type="text"
                        value={builderName}
                        onChange={(event) =>
                          setBuilderName(
                            event.target.value
                          )
                        }
                        placeholder={
                          builderType === "PHOTO"
                            ? "e.g. Room Renders"
                            : builderType === "VIDEO"
                            ? "e.g. Campaign Film"
                            : builderType === "PDF"
                            ? "e.g. Final Proposal"
                            : "e.g. Brand Guidelines"
                        }
                        className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-black/30"
                      />
                    </div>

                    <input
                      ref={builderFileInputRef}
                      type="file"
                      multiple
                      accept={mediaAccept(
                        builderType
                      )}
                      onChange={
                        handleBuilderFileSelect
                      }
                      className="hidden"
                    />

                    <label
                      htmlFor="builder-upload"
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragging(true);
                      }}
                      onDragLeave={() =>
                        setDragging(false)
                      }
                      onDrop={handleBuilderDrop}
                      className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-8 text-center transition-colors ${
                        dragging
                          ? "border-black bg-white"
                          : "border-black/10 bg-white hover:border-black/25"
                      }`}
                    >
                      <input
                        id="builder-upload"
                        type="file"
                        multiple
                        accept={mediaAccept(
                          builderType
                        )}
                        onChange={
                          handleBuilderFileSelect
                        }
                        className="hidden"
                      />

                      <UploadIcon />

                      <p className="mt-3 text-sm font-bold">
                        {builderFiles.length > 0
                          ? `${builderFiles.length} file${
                              builderFiles.length ===
                              1
                                ? ""
                                : "s"
                            } selected`
                          : "Choose files or drag them here"}
                      </p>

                      <p className="mt-1 text-xs text-black/35">
                        {mediaDescription(
                          builderType
                        )}
                      </p>
                    </label>

                    {builderFiles.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {builderFiles
                          .slice(0, 4)
                          .map((queuedFile) => (
                            <div
                              key={queuedFile.localId}
                              className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="shrink-0 text-black/40">
                                  {iconFor(
                                    builderType
                                  )}
                                </span>

                                <span className="truncate text-xs font-semibold text-black/60">
                                  {
                                    queuedFile.file
                                      .name
                                  }
                                </span>
                              </div>

                              <span className="shrink-0 text-[10px] text-black/30">
                                {formatBytes(
                                  queuedFile.file
                                    .size
                                )}
                              </span>
                            </div>
                          ))}

                        {builderFiles.length > 4 && (
                          <p className="text-center text-[11px] text-black/35">
                            +{" "}
                            {builderFiles.length - 4}{" "}
                            more files
                          </p>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={confirmSection}
                      className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0A0A0A] px-5 py-3.5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
                    >
                      Add collection
                      <ArrowRightIcon />
                    </button>
                  </div>
                )}
            </section>

            {/* Presentation */}
            <section className="rounded-3xl border border-black/[0.08] bg-white p-6 shadow-[0_12px_40px_rgba(0,0,0,0.035)] sm:p-8">
              <SectionHeading
                number="04"
                eyebrow="First impression"
                title="Make the opening moment yours."
                description="Add a short headline to the top of your client delivery. You can change this later."
                optional
              />

              <div className="mt-7">
                <label
                  htmlFor="tagline"
                  className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-black/40"
                >
                  Delivery headline
                </label>

                <input
                  id="tagline"
                  type="text"
                  maxLength={80}
                  value={tagline}
                  onChange={(event) =>
                    setTagline(event.target.value)
                  }
                  placeholder="Three months of work. One night to remember."
                  className="w-full rounded-2xl border border-black/10 bg-[#F7F7F5] px-5 py-4 text-sm font-semibold outline-none transition-colors placeholder:text-black/25 focus:border-black/30"
                />

                <div className="mt-2 flex justify-end text-[10px] text-black/25">
                  {tagline.length}/80
                </div>
              </div>
            </section>

            {/* Banner */}
            {bannerFiles.length > 0 && (
              <section className="rounded-3xl border border-black/[0.08] bg-white p-6 shadow-[0_12px_40px_rgba(0,0,0,0.035)] sm:p-8">
                <SectionHeading
                  number="05"
                  eyebrow="Presentation"
                  title="Choose what they see first."
                  description={
                    videoBannerExists
                      ? "Because this delivery contains video, choose the video that should lead the experience."
                      : "Choose the image that should introduce your delivery."
                  }
                />

                <div className="mt-7 grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {imageSections.flatMap(
                    (section) =>
                      section.files.map(
                        (queuedFile) => ({
                          section,
                          queuedFile,
                        })
                      )
                  ).map(
                    ({
                      section,
                      queuedFile,
                    }) => {
                      const previewUrl =
                        previewUrls[
                          queuedFile.localId
                        ];

                      const selectable =
                        !videoBannerExists ||
                        section.mediaType ===
                          "VIDEO";

                      const selected =
                        heroLocalId ===
                        queuedFile.localId;

                      return (
                        <button
                          type="button"
                          key={
                            queuedFile.localId
                          }
                          disabled={!selectable}
                          onClick={() =>
                            setHeroLocalId(
                              queuedFile.localId
                            )
                          }
                          className={`relative aspect-[4/3] overflow-hidden rounded-2xl border-2 bg-[#F7F7F5] text-left transition-all ${
                            selected
                              ? "border-[#F5C842] shadow-[0_0_0_4px_rgba(245,200,66,0.16)]"
                              : "border-black/5 hover:border-black/20"
                          } ${
                            !selectable
                              ? "cursor-not-allowed opacity-25"
                              : ""
                          }`}
                        >
                          {previewUrl &&
                          section.mediaType ===
                            "VIDEO" ? (
                            <video
                              src={previewUrl}
                              muted
                              playsInline
                              className="h-full w-full object-cover"
                            />
                          ) : previewUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={previewUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : null}

                          {selected && (
                            <div className="absolute inset-x-2 bottom-2">
                              <span className="inline-flex rounded-full bg-[#F5C842] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wide">
                                Selected
                              </span>
                            </div>
                          )}

                          {section.mediaType ===
                            "VIDEO" && (
                            <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[9px] font-bold text-white">
                              VIDEO
                            </span>
                          )}
                        </button>
                      );
                    }
                  )}
                </div>
              </section>
            )}

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-600">
                {error}
              </div>
            )}

            {/* Mobile CTA */}
            <div className="lg:hidden">
              <SubmitCard
                sections={sections}
                allFiles={allFiles}
                clientName={clientName}
                loading={loading}
                onSubmit={() => undefined}
                mobile
              />
            </div>
          </div>

          {/* Desktop summary */}
          <aside className="hidden lg:block">
            <div className="sticky top-[96px]">
              <SubmitCard
                sections={sections}
                allFiles={allFiles}
                clientName={clientName}
                loading={loading}
                onSubmit={() => undefined}
              />

              <div className="mt-5 rounded-2xl border border-black/5 bg-white px-5 py-4">
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FFF7D6]">
                    <ShieldIcon />
                  </div>

                  <div>
                    <p className="text-xs font-bold">
                      Private client delivery
                    </p>

                    <p className="mt-1 text-[11px] leading-5 text-black/35">
                      Your client receives a dedicated,
                      password-protected Showwork experience.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </form>
      </div>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* Components                                                                 */
/* -------------------------------------------------------------------------- */

function Logo({ dark = false }: { dark?: boolean }) {
  return <ShowworkLogo tone={dark ? "white" : "dark"} width={112}/>;
}

function StepBadge({
  number,
  label,
}: {
  number: string;
  label: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1.5">
      <span className="text-[10px] font-extrabold">
        {number}
      </span>

      <span className="h-3 w-px bg-black/10" />

      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-black/45">
        {label}
      </span>
    </div>
  );
}

function SectionHeading({
  number,
  eyebrow,
  title,
  description,
  optional = false,
}: {
  number: string;
  eyebrow: string;
  title: string;
  description: string;
  optional?: boolean;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0A0A0A] text-[10px] font-extrabold text-white">
        {number}
      </div>

      <div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-black/35">
            {eyebrow}
          </span>

          {optional && (
            <span className="rounded-full bg-[#F7F7F5] px-2 py-0.5 text-[9px] font-bold text-black/30">
              Optional
            </span>
          )}
        </div>

        <h2 className="mt-1 text-xl font-extrabold tracking-[-0.03em] sm:text-2xl">
          {title}
        </h2>

        <p className="mt-2 max-w-xl text-xs leading-5 text-black/40 sm:text-sm">
          {description}
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  minLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <div className="mb-4">
      <label className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-black/40">
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        className="w-full rounded-xl border border-black/10 bg-[#F7F7F5] px-4 py-3.5 text-sm font-medium outline-none transition-colors placeholder:text-black/25 focus:border-black/30"
      />
    </div>
  );
}

function SubmitCard({
  sections,
  allFiles,
  clientName,
  loading,
  mobile = false,
}: {
  sections: PendingSection[];
  allFiles: QueuedFile[];
  clientName: string;
  loading: boolean;
  onSubmit: () => void;
  mobile?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border border-black/10 bg-[#0A0A0A] p-6 text-white shadow-[0_20px_60px_rgba(0,0,0,0.14)] ${
        mobile ? "mt-2" : ""
      }`}
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
            Ready when you are
          </p>

          <h2 className="mt-1 text-xl font-extrabold tracking-[-0.03em]">
            Create your delivery
          </h2>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5C842] text-black">
          <ArrowUpRightIcon />
        </div>
      </div>

      <div className="space-y-2 border-y border-white/10 py-4">
        <SummaryRow
          label="Client"
          value={clientName || "Not added yet"}
        />

        <SummaryRow
          label="Collections"
          value={`${sections.length}`}
        />

        <SummaryRow
          label="Files"
          value={`${allFiles.length}`}
        />

        <SummaryRow
          label="Protection"
          value="Password protected"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#F5C842] px-5 py-4 text-sm font-extrabold text-black transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? "Preparing..."
          : "Create client delivery"}

        {!loading && <ArrowRightIcon />}
      </button>

      <p className="mt-4 text-center text-[10px] leading-4 text-white/30">
        You’ll create or sign in to your Showwork account
        before your files are uploaded.
      </p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs">
      <span className="text-white/35">
        {label}
      </span>

      <span className="max-w-[190px] truncate text-right font-semibold text-white/75">
        {value}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Icons                                                                      */
/* -------------------------------------------------------------------------- */

function ArrowRightIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowUpRightIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 13 13 5M7 5h6v6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10 4v12M4 10h12"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3.5"
        y="7.5"
        width="11"
        height="7"
        rx="1.8"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M6 7.5V5.8a4 4 0 0 1 8 0v1.7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 2.2 13 4v3.7c0 3-2 5.1-5 6.1-3-1-5-3.1-5-6.1V4l5-1.8Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="m5.8 8 1.5 1.5L10.5 6.3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 15V4M8 8l4-4 4 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="4.5"
        width="14"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="m4.5 6 5.5 4 5.5-4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="2.5"
        y="3"
        width="13"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle
        cx="6.5"
        cy="6.5"
        r="1.2"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="m4 13 3.5-3 2.3 2 1.7-1.5L14 13"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="2.5"
        y="4"
        width="9"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="m11.5 7 4-2v8l-4-2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 2.5h5l3.5 3.5v9.5H5v-13Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M10 2.5V6h3.5M7 9h4M7 12h4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 2.5h5l3.5 3.5v9.5H5v-13Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M10 2.5V6h3.5"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M7 12h4M7 9h2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
