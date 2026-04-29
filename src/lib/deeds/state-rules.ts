export type Citation = { label: string; url: string };

export type DeedRule = {
  available: boolean;
  citations: Citation[];
  citationsPending?: boolean;
  notes?: string[];
};

export type StateDeedRules = {
  stateCode: string;
  todDeed: DeedRule;
  ladyBirdDeed: DeedRule;
  trustTransferDeed: DeedRule;
  recorderDirectoryUrl?: string;
  recorderLinkPending?: boolean;
};

const TOD_CITATIONS: Citation[] = [
  {
    label: "Uniform Real Property Transfer on Death Act (ULC draft, 2008)",
    url: "https://www.uniformlaws.org/HigherLogic/System/DownloadDocumentFile.ashx?DocumentFileKey=bf7aa64c-a421-44c6-a14e-75d969b39384&forceDialog=0",
  },
];

const LADY_BIRD_CITATIONS: Citation[] = [
  {
    label: "Florida Bar Journal – Lady Bird Deeds (overview)",
    url: "https://www.floridabar.org/the-florida-bar-journal/lady-bird-deeds/",
  },
];

const TRUST_TRANSFER_CITATIONS: Citation[] = [];

const LADY_BIRD_STATES = new Set(["FL", "MI", "TX", "VT", "WV"]);

const TOD_DEED_STATES = new Set([
  "AZ",
  "AR",
  "CA",
  "CO",
  "DC",
  "HI",
  "ID",
  "IL",
  "IN",
  "KS",
  "MN",
  "MO",
  "MT",
  "NE",
  "NV",
  "NM",
  "ND",
  "OH",
  "OK",
  "OR",
  "SD",
  "TX",
  "UT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
]);

const DEFAULT_NOTES = [
  "State law, county form, and recording requirements vary.",
  "Confirm local recorder requirements and lender/title policies before recording.",
];
const DEFAULT_RECORDER_DIRECTORY = "https://www.usa.gov/local-governments";

export const STATE_DEED_RULES: Record<string, StateDeedRules> = Array.from(
  new Set([...LADY_BIRD_STATES, ...TOD_DEED_STATES])
).reduce((acc, stateCode) => {
  acc[stateCode] = {
    stateCode,
    todDeed: {
      available: TOD_DEED_STATES.has(stateCode),
      citations: TOD_DEED_STATES.has(stateCode) ? TOD_CITATIONS : [],
      citationsPending: TOD_DEED_STATES.has(stateCode),
      notes: DEFAULT_NOTES,
    },
    ladyBirdDeed: {
      available: LADY_BIRD_STATES.has(stateCode),
      citations: LADY_BIRD_STATES.has(stateCode) ? LADY_BIRD_CITATIONS : [],
      citationsPending: LADY_BIRD_STATES.has(stateCode),
      notes: DEFAULT_NOTES,
    },
    trustTransferDeed: {
      available: true,
      citations: TRUST_TRANSFER_CITATIONS,
      notes: DEFAULT_NOTES,
    },
    recorderDirectoryUrl: DEFAULT_RECORDER_DIRECTORY,
    recorderLinkPending: true,
  };
  return acc;
}, {} as Record<string, StateDeedRules>);

export const DEFAULT_STATE_DEED_RULES: StateDeedRules = {
  stateCode: "",
  todDeed: { available: false, citations: TOD_CITATIONS, citationsPending: true, notes: DEFAULT_NOTES },
  ladyBirdDeed: { available: false, citations: LADY_BIRD_CITATIONS, citationsPending: true, notes: DEFAULT_NOTES },
  trustTransferDeed: { available: true, citations: TRUST_TRANSFER_CITATIONS, notes: DEFAULT_NOTES },
  recorderDirectoryUrl: DEFAULT_RECORDER_DIRECTORY,
  recorderLinkPending: true,
};

const STATE_CITATIONS_OVERRIDES: Record<string, Partial<StateDeedRules>> = {
  AZ: {
    todDeed: {
      available: true,
      citations: [
        {
          label: "Arizona Revised Statutes § 33-405 – Beneficiary deed",
          url: "https://law.justia.com/codes/arizona/title-33/section-33-405/",
        },
      ],
      citationsPending: false,
    },
    recorderDirectoryUrl: "https://my.arizona.vote/CountyOfficials.aspx?Type=R",
    recorderLinkPending: false,
  },
  AR: {
    todDeed: {
      available: true,
      citations: [
        {
          label: "Arkansas Code § 18-12-608 – Beneficiary deed",
          url: "https://law.justia.com/codes/arkansas/title-18/subtitle-2/chapter-12/subchapter-6/section-18-12-608/",
        },
      ],
      citationsPending: false,
    },
    recorderDirectoryUrl: "https://arcourts.gov/directories/circuit-clerks",
    recorderLinkPending: false,
  },
  AK: {
    todDeed: {
      available: true,
      citations: [
        {
          label: "Alaska Statutes Title 13, Chapter 48 – Uniform Real Property Transfer on Death Act",
          url: "https://law.justia.com/codes/alaska/title-13/chapter-48/",
        },
      ],
      citationsPending: false,
    },
    recorderDirectoryUrl: "https://dnr.alaska.gov/ssd/recoff/",
    recorderLinkPending: false,
  },
  CA: {
    todDeed: {
      available: true,
      citations: [
        {
          label: "California Probate Code § 5600 et seq. – Revocable Transfer on Death Deed",
          url: "https://law.justia.com/codes/california/2022/probate-code/part-2/chapter-2/",
        },
      ],
      citationsPending: false,
    },
    recorderDirectoryUrl: "https://www.cdph.ca.gov/Programs/CHSI/pages/county-registrars-and-recorders.aspx",
    recorderLinkPending: false,
  },
  CO: {
    todDeed: {
      available: true,
      citations: [
        {
          label: "Colorado Revised Statutes § 15-15-401 – Beneficiary deed",
          url: "https://law.justia.com/codes/colorado/title-15/article-15/part-4/section-15-15-401/",
        },
      ],
      citationsPending: false,
    },
    recorderDirectoryUrl: "https://www.clerkandrecorder.org/find-your-county-clerk",
    recorderLinkPending: false,
  },
  DC: {
    todDeed: {
      available: true,
      citations: [
        {
          label: "D.C. Code § 19-604.01 – Transfer on death deed",
          url: "https://code.dccouncil.gov/us/dc/council/code/sections/19-604.01",
        },
      ],
      citationsPending: false,
    },
    recorderDirectoryUrl: "https://otr.cfo.dc.gov/service/otr-recorder-deeds",
    recorderLinkPending: false,
  },
  ID: {
    todDeed: {
      available: true,
      citations: [
        {
          label: "Idaho Code § 15-6-401 – Transfer on death deed",
          url: "https://law.justia.com/codes/idaho/2020/title-15/chapter-6/part-4/section-15-6-401/",
        },
      ],
      citationsPending: false,
    },
    recorderDirectoryUrl: "https://voteidaho.gov/county-clerk/",
    recorderLinkPending: false,
  },
  IL: {
    todDeed: {
      available: true,
      citations: [
        {
          label: "Illinois Compiled Statutes 755 ILCS 27/1 – Transfer on Death Instrument Act",
          url: "https://law.justia.com/codes/illinois/2022/chapter-755/act-27/",
        },
      ],
      citationsPending: false,
    },
    recorderDirectoryUrl: "https://elections.il.gov/Downloads/ElectionOperations/PDF/coofficers.pdf",
    recorderLinkPending: false,
  },
  IN: {
    todDeed: {
      available: true,
      citations: [
        {
          label: "Indiana Code § 32-17-13-1 – Transfer on death deed",
          url: "https://law.justia.com/codes/indiana/2022/title-32/article-17/chapter-13/section-32-17-13-1/",
        },
      ],
      citationsPending: false,
    },
    recorderDirectoryUrl: "https://indianarecorders.org/about-us/map-of-indiana-counties/",
    recorderLinkPending: false,
  },
  KS: {
    todDeed: {
      available: true,
      citations: [
        {
          label: "Kansas Statutes § 59-3501 – Transfer on death deed",
          url: "https://law.justia.com/codes/kansas/2019/chapter-59/article-35/section-59-3501/",
        },
      ],
      citationsPending: false,
    },
    recorderDirectoryUrl: "https://ksrods.com/contact-information/",
    recorderLinkPending: false,
  },
  HI: {
    todDeed: {
      available: true,
      citations: [
        {
          label: "Hawaii Revised Statutes Title 28, Chapter 527 – Uniform Real Property Transfer on Death Act",
          url: "https://law.justia.com/codes/hawaii/title-28/chapter-527/",
        },
      ],
      citationsPending: false,
    },
    recorderDirectoryUrl: "https://boc.ehawaii.gov/",
    recorderLinkPending: false,
  },
  MN: {
    todDeed: {
      available: true,
      citations: [
        {
          label: "Minnesota Statutes § 507.071 – Transfer on death deed",
          url: "https://law.justia.com/codes/minnesota/2022/507/section-507-071/",
        },
      ],
      citationsPending: false,
    },
    recorderDirectoryUrl: "https://www.mncounty.org/page/15",
    recorderLinkPending: false,
  },
  MO: {
    todDeed: {
      available: true,
      citations: [
        {
          label: "Missouri Revised Statutes § 461.025 – Beneficiary deed",
          url: "https://law.justia.com/codes/missouri/2016/title-xxx/chapter-461/section-461-025/",
        },
      ],
      citationsPending: false,
    },
    recorderDirectoryUrl: "https://www.morecorders.com/county-map",
    recorderLinkPending: false,
  },
  MT: {
    todDeed: {
      available: true,
      citations: [
        {
          label: "Montana Code Annotated Title 72, Chapter 6, Part 4 – Transfer on Death Deed",
          url: "https://archive.legmt.gov/bills/mca/title_0720/chapter_0060/part_0040/sections_index.html",
        },
      ],
      citationsPending: false,
    },
    recorderDirectoryUrl: "https://www.uccsource.com/offices/mt-counties.html",
    recorderLinkPending: false,
  },
  NE: {
    todDeed: {
      available: true,
      citations: [
        {
          label: "Nebraska Revised Statutes § 76-3401 – Transfer on death deed",
          url: "https://law.justia.com/codes/nebraska/2017/chapter-76/statute-76-3401/",
        },
      ],
      citationsPending: false,
    },
    recorderDirectoryUrl: "https://nebraskacounties.org/directory.html",
    recorderLinkPending: false,
  },
  NV: {
    todDeed: {
      available: true,
      citations: [
        {
          label: "Nevada Revised Statutes § 111.655 – Deed upon death",
          url: "https://law.justia.com/codes/nevada/2010/title-10/chapter-111/nrs-111-655/",
        },
      ],
      citationsPending: false,
    },
    recorderDirectoryUrl: "https://recordersassociationofnevada.org/counties",
    recorderLinkPending: false,
  },
  NM: {
    todDeed: {
      available: true,
      citations: [
        {
          label: "New Mexico Statutes § 45-6-401 – Transfer on death deed",
          url: "https://law.justia.com/codes/new-mexico/2014/chapter-45/article-6/part-4/section-45-6-401/",
        },
      ],
      citationsPending: false,
    },
    recorderDirectoryUrl: "https://www.sos.nm.gov/voting-and-elections/voter-information-portal-nmvote-org/county-clerk-information/",
    recorderLinkPending: false,
  },
  ND: {
    todDeed: {
      available: true,
      citations: [
        {
          label: "North Dakota Century Code § 30.1-32-01 – Transfer on death deed",
          url: "https://law.justia.com/codes/north-dakota/2022/title-30-1/chapter-30-1-32/section-30-1-32-01/",
        },
      ],
      citationsPending: false,
    },
    recorderDirectoryUrl: "https://www.ndcountyrecorders.org/nd-county-recorders/",
    recorderLinkPending: false,
  },
  OH: {
    todDeed: {
      available: true,
      citations: [
        {
          label: "Ohio Revised Code § 5302.22 – Transfer on death designation affidavit",
          url: "https://codes.ohio.gov/ohio-revised-code/section-5302.22",
        },
      ],
      citationsPending: false,
    },
    recorderDirectoryUrl: "https://www.ohiorecorders.com/",
    recorderLinkPending: false,
  },
  OK: {
    todDeed: {
      available: true,
      citations: [
        {
          label: "Oklahoma Statutes Title 58, § 1251 – Transfer on death deed",
          url: "https://law.justia.com/codes/oklahoma/title-58/section-58-1251/",
        },
      ],
      citationsPending: false,
    },
    recorderDirectoryUrl: "https://ccdaok.org/index.php/clerks-by-county-alphabetical/",
    recorderLinkPending: false,
  },
  OR: {
    todDeed: {
      available: true,
      citations: [
        {
          label: "Oregon Revised Statutes 93.948 – Transfer on death deed",
          url: "https://law.justia.com/codes/oregon/2022/volume-03/chapter-93/section-93-948/",
        },
      ],
      citationsPending: false,
    },
    recorderDirectoryUrl: "https://sos.oregon.gov/elections/Pages/countyofficials.aspx",
    recorderLinkPending: false,
  },
  SD: {
    todDeed: {
      available: true,
      citations: [
        {
          label: "South Dakota Codified Laws § 29A-6-401 – Transfer on death deed",
          url: "https://law.justia.com/codes/south-dakota/2017/title-29a/article-6/part-4/section-29a-6-401/",
        },
      ],
      citationsPending: false,
    },
    recorderDirectoryUrl: "https://sdsos.gov/contact-us/county-registers-of-deeds.aspx",
    recorderLinkPending: false,
  },
  UT: {
    todDeed: {
      available: true,
      citations: [
        {
          label: "Utah Code § 75-6-401 – Transfer on death deed",
          url: "https://law.justia.com/codes/utah/2013/title-75/chapter-6/part-4/section-401/",
        },
      ],
      citationsPending: false,
    },
    recorderDirectoryUrl: "https://waterrights.utah.gov/proofs/cntyindx.html",
    recorderLinkPending: false,
  },
  VA: {
    todDeed: {
      available: true,
      citations: [
        {
          label: "Virginia Code § 64.2-621 – Transfer on death deed",
          url: "https://law.justia.com/codes/virginia/2022/title-64-2/chapter-6/section-64-2-621/",
        },
      ],
      citationsPending: false,
    },
    recorderDirectoryUrl: "https://www.vacourts.gov/directories/circ.pdf",
    recorderLinkPending: false,
  },
  WA: {
    todDeed: {
      available: true,
      citations: [
        {
          label: "Washington RCW 64.80 – Uniform Real Property Transfer on Death Act",
          url: "https://app.leg.wa.gov/rcw/default.aspx?cite=64.80&full=true",
        },
      ],
      citationsPending: false,
    },
    recorderDirectoryUrl: "https://www.sos.wa.gov/elections/auditors/",
    recorderLinkPending: false,
  },
  WV: {
    todDeed: {
      available: true,
      citations: [
        {
          label: "West Virginia Code § 36-12-1 – Transfer on death deed",
          url: "https://code.wvlegislature.gov/36-12-1/",
        },
      ],
      citationsPending: false,
    },
    ladyBirdDeed: {
      available: true,
      citations: [
        {
          label: "West Virginia overview – enhanced life estate deed (informational)",
          url: "https://www.legalfix.com/topics/wills-trusts-and-estates/lady-bird-deed/wv",
        },
      ],
      citationsPending: false,
    },
    recorderDirectoryUrl: "https://sos.wv.gov/elections/Pages/CountyClerkDirectory.aspx",
    recorderLinkPending: false,
  },
  WI: {
    todDeed: {
      available: true,
      citations: [
        {
          label: "Wisconsin Statutes § 705.15 – Transfer on death deed",
          url: "https://law.justia.com/codes/wisconsin/2022/chapter-705/section-705-15/",
        },
      ],
      citationsPending: false,
    },
    recorderDirectoryUrl: "https://www.wrdaonline.org/",
    recorderLinkPending: false,
  },
  WY: {
    todDeed: {
      available: true,
      citations: [
        {
          label: "Wyoming Statutes § 2-18-101 – Transfer on death deed",
          url: "https://law.justia.com/codes/wyoming/2016/title-2/chapter-18/section-2-18-101/",
        },
      ],
      citationsPending: false,
    },
    recorderDirectoryUrl: "https://sos.wyo.gov/elections/docs/wycountyclerks.pdf",
    recorderLinkPending: false,
  },
  FL: {
    ladyBirdDeed: {
      available: true,
      citations: [
        {
          label: "Florida Bar Journal – Lady Bird Deeds (overview)",
          url: "https://www.floridabar.org/the-florida-bar-journal/lady-bird-deeds/",
        },
      ],
      citationsPending: false,
    },
    recorderDirectoryUrl: "https://www.flclerks.com/page/findaclerk",
    recorderLinkPending: false,
  },
  MI: {
    ladyBirdDeed: {
      available: true,
      citations: [
        {
          label: "Michigan Bar Journal – Ladybird deeds: Key features and uses",
          url: "https://www.michbar.org/journal/Details/Ladybird-deeds-Key-features-and-uses?ArticleID=4796",
        },
      ],
      citationsPending: false,
    },
    recorderDirectoryUrl: "https://www.michigan.gov/taxes/collections/register-of-deeds",
    recorderLinkPending: false,
  },
  TX: {
    todDeed: {
      available: true,
      citations: [
        {
          label: "Texas Estates Code, Chapter 114 – Transfer on Death Deed",
          url: "https://texas.public.law/statutes/tex._est._code_title_2_subtitle_c_chapter_114",
        },
      ],
      citationsPending: false,
    },
    ladyBirdDeed: {
      available: true,
      citations: [
        {
          label: "Texas State Law Library – What is a Lady Bird deed?",
          url: "https://www.sll.texas.gov/faqs/what-is-a-lady-bird-deed/",
        },
      ],
      citationsPending: false,
    },
    recorderDirectoryUrl: "https://www.sos.state.tx.us/elections/voter/cclerks.shtml",
    recorderLinkPending: false,
  },
  VT: {
    ladyBirdDeed: {
      available: true,
      citations: [
        {
          label: "Vermont Statutes Title 27, Chapter 6 – Enhanced Life Estate Deed Act",
          url: "https://legislature.vermont.gov/statutes/fullchapter/27/006",
        },
      ],
      citationsPending: false,
    },
    recorderDirectoryUrl: "https://sos.vermont.gov/elections/town-clerks/",
    recorderLinkPending: false,
  },
};

for (const [stateCode, overrides] of Object.entries(STATE_CITATIONS_OVERRIDES)) {
  const existing = STATE_DEED_RULES[stateCode] ?? DEFAULT_STATE_DEED_RULES;
  STATE_DEED_RULES[stateCode] = {
    ...existing,
    ...overrides,
    todDeed: { ...existing.todDeed, ...overrides.todDeed },
    ladyBirdDeed: { ...existing.ladyBirdDeed, ...overrides.ladyBirdDeed },
    trustTransferDeed: { ...existing.trustTransferDeed, ...overrides.trustTransferDeed },
  };
}
