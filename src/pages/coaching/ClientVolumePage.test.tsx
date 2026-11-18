import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ClientVolumePage from "./ClientVolumePage";

const mocks = vi.hoisted(() => ({ isAdmin: true, rpc: vi.fn(), from: vi.fn(), profile: vi.fn() }));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "coach" }, isAdmin: mocks.isAdmin }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc, from: mocks.from } }));
vi.mock("@/components/admin/AdminLayout", () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/coach/CoachLayout", () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/admin/VolumeIntensityTable", () => ({ default: ({ clientId }: { clientId: string }) => <div data-testid="volume-tables">{clientId}</div> }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isAdmin = true;
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.profile.mockResolvedValue({ data: { first_name: "Mario", last_name: "Rossi" }, error: null });
  mocks.from.mockImplementation(() => ({ select: () => ({ eq: () => ({ single: mocks.profile }) }) }));
});
afterEach(cleanup);

function openPage() {
  return render(
    <MemoryRouter initialEntries={["/clienti/client/volume-intensita"]}>
      <Routes><Route path="/clienti/:userId/volume-intensita" element={<ClientVolumePage />} /></Routes>
    </MemoryRouter>,
  );
}

describe("ClientVolumePage", () => {
  it("lets an admin work on a client without loading or creating a workout plan", async () => {
    openPage();
    expect(await screen.findByTestId("volume-tables")).toHaveTextContent("client");
    expect(screen.getByRole("heading", { name: "Mario Rossi" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Torna al cliente" })).toHaveAttribute("href", "/admin/utenti/client");
    expect(mocks.from.mock.calls.map(([name]) => name)).toEqual(["profiles"]);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("checks assignment before showing a client's tables to a coach", async () => {
    mocks.isAdmin = false;
    openPage();
    expect(await screen.findByTestId("volume-tables")).toBeInTheDocument();
    expect(mocks.rpc).toHaveBeenCalledWith("coach_manages_client", { coach_uuid: "coach", client_uuid: "client" });
    expect(screen.getByRole("link", { name: "I miei clienti" })).toHaveAttribute("href", "/coach/clienti");
  });

  it("does not load a client's profile or tables for an unassigned coach", async () => {
    mocks.isAdmin = false;
    mocks.rpc.mockResolvedValueOnce({ data: false, error: null });
    openPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Non sei assegnato a questo cliente.");
    expect(screen.queryByTestId("volume-tables")).not.toBeInTheDocument();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
