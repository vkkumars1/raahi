import { MemoryKV, setKV } from "../src/lib/kv";

const sent: { to: string; code: string }[] = [];
jest.mock("../src/lib/mailer", () => ({ sendOtpMail: async (to: string, code: string) => void sent.push({ to, code }) }));
jest.mock("../src/repositories/users.repo", () => ({
  usersRepo: { upsertByEmail: async (email: string) => ({ user: { id: "00000000-0000-4000-8000-000000000001", email }, isNew: true }) },
}));

import { authService } from "../src/services/auth.service";

const last = () => sent[sent.length - 1].code;

beforeEach(() => { setKV(new MemoryKV()); sent.length = 0; });

describe("OTP auth", () => {
  it("issues a token for the right code and the code is single use", async () => {
    await authService.requestOtp("A@Example.com");
    const out = await authService.verifyOtp("a@example.com", last());
    expect(out.token).toBeTruthy();
    await expect(authService.verifyOtp("a@example.com", last())).rejects.toMatchObject({ code: "otp_expired" });
  });

  it("rejects a wrong code and locks after 5 attempts", async () => {
    await authService.requestOtp("b@example.com");
    const wrong = last() === "000000" ? "111111" : "000000";
    for (let i = 0; i < 4; i++) await expect(authService.verifyOtp("b@example.com", wrong)).rejects.toMatchObject({ code: "otp_invalid" });
    await expect(authService.verifyOtp("b@example.com", wrong)).rejects.toMatchObject({ status: 429 });
    // even the right code no longer works after lockout
    await expect(authService.verifyOtp("b@example.com", last())).rejects.toMatchObject({ code: "otp_expired" });
  });

  it("enforces the 30 second resend cooldown", async () => {
    await authService.requestOtp("c@example.com");
    await expect(authService.requestOtp("c@example.com")).rejects.toMatchObject({ status: 429 });
  });

  it("limits to 5 requests per hour", async () => {
    const kv = new MemoryKV();
    setKV(kv);
    for (let i = 0; i < 5; i++) {
      await authService.requestOtp("d@example.com");
      await kv.del("otp:cd:d@example.com"); // skip cooldown to test the hourly cap
    }
    await expect(authService.requestOtp("d@example.com")).rejects.toMatchObject({ status: 429 });
  });

  it("never stores the plain code", async () => {
    const kv = new MemoryKV();
    setKV(kv);
    await authService.requestOtp("e@example.com");
    expect(await kv.get("otp:e@example.com")).not.toContain(last());
  });
});
