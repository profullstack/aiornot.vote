export type PaymentSuccessContent = {
  message: string;
  primaryHref: string;
  primaryLabel: string;
  showApiDocs: boolean;
};

export function paymentSuccessContent(purpose: string): PaymentSuccessContent {
  if (purpose === "lifetime_membership") {
    return {
      message: "You're now a lifetime member. Enjoy your badge and free API keys.",
      primaryHref: "/account",
      primaryLabel: "Go to account →",
      showApiDocs: false,
    };
  }

  if (purpose === "play_pass") {
    return {
      message: "Play access granted. You can now submit posts and play.",
      primaryHref: "/play",
      primaryLabel: "Start playing →",
      showApiDocs: false,
    };
  }

  if (purpose === "api_access") {
    return {
      message: "API access granted. Manage your keys in your account.",
      primaryHref: "/account",
      primaryLabel: "Go to account →",
      showApiDocs: true,
    };
  }

  return {
    message: "Your purchase is ready.",
    primaryHref: "/account",
    primaryLabel: "Go to account →",
    showApiDocs: false,
  };
}
