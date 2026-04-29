import type { TrustMode } from "./types";

export type StateHelperOutput = {
  // Display-only guidance; never used to imply "formation"
  guidanceBanner: {
    title: string;
    body: string;
  };

  // Clauses are suggestions for documents / certificates
  suggestedClauses: Array<{
    id: string;
    title: string;
    text: string;
  }>;
};

/**
 * Advisory-only: returns suggestions. Never requires a state.
 * If governingState is undefined, we provide neutral language.
 */
export function buildStateHelperOutput(params: {
  trustMode: TrustMode;
  governingState?: string;
}): StateHelperOutput {
  const { trustMode, governingState } = params;

  const lawPhrase = governingState
    ? `the laws of ${governingState}`
    : "the applicable laws of the chosen governing jurisdiction";

  if (trustMode === "private_safe") {
    return {
      guidanceBanner: {
        title: "Private Trust Safe Mode (Advisory)",
        body:
          "This workspace memorializes and administers a private trust. It does not register, file, or create the trust under state authority. Governing law selection is optional and used only for construction and dispute-resolution language.",
      },
      suggestedClauses: [
        {
          id: "private-non-statutory-posture",
          title: "Private trust posture",
          text:
            "This instrument evidences a private trust relationship established by the Settlor/Grantor and accepted by the Trustee(s). Nothing herein shall be construed as a request for, or dependence upon, state creation, registration, or licensing of the trust.",
        },
        {
          id: "governing-law-construction",
          title: "Governing law (construction only)",
          text:
            `For purposes of interpretation and construction only, this trust shall be construed in accordance with ${lawPhrase}, without limiting any private rights or remedies otherwise available.`,
        },
        {
          id: "venue-dispute-resolution",
          title: "Venue and dispute resolution (optional)",
          text:
            governingState
              ? `Any dispute arising under this instrument shall be heard in a court of competent jurisdiction located in ${governingState}, unless the parties agree otherwise in writing.`
              : "Any dispute arising under this instrument shall be heard in a court of competent jurisdiction in a mutually agreed venue, unless the parties agree otherwise in writing.",
        },
        {
          id: "savings-severability",
          title: "Severability / savings",
          text:
            "If any provision is deemed unenforceable, the remaining provisions shall remain in full force and effect to the maximum extent permitted, and the provision shall be reformed narrowly to preserve intent.",
        },
      ],
    };
  }

  // Standard mode can be more statute-aware, still advisory.
  return {
    guidanceBanner: {
      title: "State helper (Advisory)",
      body:
        "These suggestions help align governing-law and construction clauses with common state practice. They do not constitute legal advice.",
    },
    suggestedClauses: [
      {
        id: "governing-law",
        title: "Governing law",
        text: `This trust shall be governed by and construed in accordance with ${lawPhrase}.`,
      },
      {
        id: "severability",
        title: "Severability",
        text:
          "If any provision of this trust is held invalid or unenforceable, the remaining provisions shall continue in full force and effect.",
      },
    ],
  };
}




