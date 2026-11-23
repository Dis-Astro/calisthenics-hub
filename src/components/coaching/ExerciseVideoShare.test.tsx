import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ExerciseVideoShare from "./ExerciseVideoShare";
import { buildExerciseShareText } from "@/lib/exerciseVideoShare";

const toastMocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMocks }));

const video = (name: string) => new File(["x"], name, { type: "video/mp4" });

function pick(files: File[]) {
  const input = screen.getByTestId("exercise-video-input") as HTMLInputElement;
  fireEvent.change(input, { target: { files } });
}

describe("buildExerciseShareText", () => {
  it("uses only the exercise name", () => {
    expect(buildExerciseShareText("  EMOM 4' pull con fermo  ")).toBe("EMOM 4' pull con fermo");
  });

  it("falls back when the exercise has no name", () => {
    expect(buildExerciseShareText(null)).toBe("Video esercizio");
  });
});

describe("ExerciseVideoShare", () => {
  const share = vi.fn(async () => undefined);
  const canShare = vi.fn(() => true);

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, { share, canShare });
  });

  afterEach(() => {
    Object.assign(navigator, { share: undefined, canShare: undefined });
  });

  it("shares every selected video with the exercise text", async () => {
    render(<ExerciseVideoShare shareText="Esercizio 1: Squat" />);
    const files = [video("a.mp4"), video("b.mp4")];
    pick(files);

    expect(await screen.findByText("Invia 2 video al coach")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Invia" }));

    await waitFor(() => expect(share).toHaveBeenCalledWith({
      files,
      text: "Esercizio 1: Squat",
    }));
    expect(toastMocks.success).toHaveBeenCalledWith("Video inviati");
  });

  it("lets the user drop a video picked by mistake", async () => {
    render(<ExerciseVideoShare shareText="t" />);
    pick([video("giusto.mp4"), video("sbagliato.mp4")]);
    fireEvent.click(await screen.findByRole("button", { name: "Rimuovi sbagliato.mp4" }));
    fireEvent.click(screen.getByRole("button", { name: "Invia" }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect((share.mock.calls[0] as unknown as [{ files: File[] }])[0].files.map((f) => f.name)).toEqual(["giusto.mp4"]);
  });

  it("stays quiet when the user closes the share menu", async () => {
    share.mockRejectedValueOnce(Object.assign(new Error("cancel"), { name: "AbortError" }));
    render(<ExerciseVideoShare shareText="t" />);
    pick([video("a.mp4")]);
    fireEvent.click(await screen.findByRole("button", { name: "Invia" }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(toastMocks.error).not.toHaveBeenCalled();
  });

  it("explains when the browser cannot send files", async () => {
    canShare.mockReturnValue(false);
    render(<ExerciseVideoShare shareText="t" />);
    pick([video("a.mp4")]);
    fireEvent.click(await screen.findByRole("button", { name: "Invia" }));
    expect(share).not.toHaveBeenCalled();
    expect(toastMocks.error).toHaveBeenCalled();
  });
});
