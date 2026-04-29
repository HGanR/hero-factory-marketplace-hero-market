import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { industry } = await req.json();

    if (!industry || typeof industry !== "string") {
      return NextResponse.json({ error: "Industry is required" }, { status: 400 });
    }

    // Construct the search query as requested by the user
    const query = `site:facebook.com "${industry}" "@gmail.com" OR "@yahoo.com" OR "@hotmail.com" OR "@outlook.com" OR "@aol.com" OR "@msn.com"`;

    // Fetch from DuckDuckGo HTML version to avoid JS rendering issues and heavy blocking
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch search results" }, { status: 502 });
    }

    const html = await response.text();

    // Regex to extract valid email addresses
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const rawEmails = html.match(emailRegex) || [];

    // Deduplicate emails and make lowercase
    const uniqueEmails = Array.from(new Set(rawEmails.map((e) => e.toLowerCase())));

    // Filter out common false positives from duckduckgo/facebook HTML
    const filteredEmails = uniqueEmails.filter(
      (e) => !e.endsWith("duckduckgo.com") && !e.includes("example.com")
    );

    // Format as CSV: platform,email,profile_url
    // We will leave profile_url empty for now since we just extracted the emails from snippets
    const csvLines = ["platform,handle,profile_url,email"];
    for (const email of filteredEmails) {
      csvLines.push(`facebook,,,${email}`);
    }

    const csvText = csvLines.join("\n");

    return NextResponse.json({ success: true, emails: filteredEmails, csvText });
  } catch (error) {
    console.error("Email extraction error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
