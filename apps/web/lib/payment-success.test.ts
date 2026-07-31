import { describe, expect, it } from "vitest";
import { paymentSuccessContent } from "./payment-success";

describe("paymentSuccessContent", () => {
  it("sends play-pass buyers to the game without API messaging", () => {
    expect(paymentSuccessContent("play_pass")).toEqual({
      message: "Play access granted. You can now submit posts and play.",
      primaryHref: "/play",
      primaryLabel: "Start playing →",
      showApiDocs: false,
    });
  });

  it("keeps API purchases linked to account and API docs", () => {
    expect(paymentSuccessContent("api_access")).toEqual({
      message: "API access granted. Manage your keys in your account.",
      primaryHref: "/account",
      primaryLabel: "Go to account →",
      showApiDocs: true,
    });
  });

  it("uses neutral account copy for unknown payment purposes", () => {
    expect(paymentSuccessContent("unknown")).toEqual({
      message: "Your purchase is ready.",
      primaryHref: "/account",
      primaryLabel: "Go to account →",
      showApiDocs: false,
    });
  });
});
