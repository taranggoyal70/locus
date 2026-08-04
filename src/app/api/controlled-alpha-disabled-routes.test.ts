import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const serviceClientMock = vi.hoisted(() => vi.fn());

vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));
vi.mock("@/lib/supabase", () => ({ serviceClient: serviceClientMock }));

import { GET as githubStatus } from "@/app/api/github/status/route";
import { GET as billingStatus } from "@/app/api/billing/status/route";
import { DELETE as deleteTeam, GET as listTeams, POST as createTeam } from "@/app/api/teams/route";
import {
  DELETE as deleteTeamMember,
  GET as listTeamMembers,
  POST as createTeamMember,
} from "@/app/api/teams/members/route";

describe("controlled-alpha disabled APIs", () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ userId: "user_123" });
    serviceClientMock.mockReset();
  });

  it("does not inspect legacy GitHub connections", async () => {
    const response = await githubStatus();

    expect(response.status).toBe(403);
    expect(serviceClientMock).not.toHaveBeenCalled();
  });

  it("does not inspect legacy billing records", async () => {
    const response = await billingStatus();

    expect(response.status).toBe(403);
    expect(serviceClientMock).not.toHaveBeenCalled();
  });

  it.each([
    ["list teams", () => listTeams()],
    ["create a team", () => createTeam(new Request("http://localhost/api/teams", { method: "POST" }))],
    ["delete a team", () => deleteTeam(new Request("http://localhost/api/teams?id=team_1", { method: "DELETE" }))],
    ["list team members", () => listTeamMembers(new Request("http://localhost/api/teams/members?teamId=team_1"))],
    ["create a team member", () => createTeamMember(new Request("http://localhost/api/teams/members", { method: "POST" }))],
    ["delete a team member", () => deleteTeamMember(new Request("http://localhost/api/teams/members?teamId=team_1&memberId=member_1", { method: "DELETE" }))],
  ])("blocks attempts to %s before database access", async (_name, callRoute) => {
    const response = await callRoute();

    expect(response.status).toBe(403);
    expect(serviceClientMock).not.toHaveBeenCalled();
  });
});
